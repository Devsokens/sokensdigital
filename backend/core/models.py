import hashlib
import uuid
import re
import json
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.forms.models import model_to_dict
from django.core.serializers.json import DjangoJSONEncoder
from django_cryptography.fields import encrypt


def hash_email(email: str) -> str:
    """Deterministic digest of a normalized email.

    `User.email` is encrypted at rest, and that encryption is
    non-deterministic (two encryptions of the same plaintext produce
    different ciphertext) — so it can't be used in a `WHERE email = ...`
    lookup or to enforce uniqueness at the database level. This hash is
    stored alongside the encrypted value specifically so both are possible.
    """
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


class AuditLogManager(models.Manager):
    def log_action(self, user, action, entity_type, entity_id, details=None, ip_address=None):
        # We need to make sure user is actually a User instance and not AnonymousUser
        u = user if user and not getattr(user, 'is_anonymous', False) and isinstance(user, User) else None
        return self.create(
            user=u,
            action=action[:100],
            entity_type=entity_type,
            entity_id=str(entity_id),
            details=details or {},
            ip_address=ip_address
        )

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=255)
    entity_id = models.CharField(max_length=255)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AuditLogManager()

    class Meta:
        indexes = [
            models.Index(fields=['action']),
            models.Index(fields=['entity_type']),
        ]

class LoggedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=['created_at']),
        ]

    def delete(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        ip_address = kwargs.pop('ip_address', None)
        
        # Serialize existing data
        details = model_to_dict(self)
        try:
            details_json = json.loads(json.dumps(details, cls=DjangoJSONEncoder))
        except Exception:
            details_json = {"error": "Could not serialize model data"}

        AuditLog.objects.log_action(
            user=user,
            action="DELETE",
            entity_type=self.__class__.__name__,
            entity_id=str(self.id),
            details={"deleted_data": details_json},
            ip_address=ip_address
        )
        super().delete(*args, **kwargs)

class Department(LoggedModel):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=7, blank=True, null=True)

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name

class Role(LoggedModel):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    permissions = models.JSONField(default=dict)

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        if not isinstance(self.permissions, dict):
            raise ValidationError({'permissions': 'Permissions must be a valid JSON object.'})
        super().clean()

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        # Clean ensures validation runs
        user.clean()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin, LoggedModel):
    # `unique=True` here is declared only because Django's auth system
    # requires USERNAME_FIELD to be unique (auth.E003) — it does NOT
    # translate into a real database guarantee, since encryption is
    # non-deterministic (two rows with the same plaintext email end up with
    # different ciphertext, so a DB-level unique index can't catch the
    # collision). `email_hash` below is the actual uniqueness/lookup key.
    email = encrypt(models.EmailField(unique=True))
    email_hash = models.CharField(max_length=64, unique=True, editable=False)
    firebase_uid = models.CharField(max_length=128, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=255, blank=True)
    last_name = models.CharField(max_length=255, blank=True)
    phone = encrypt(models.CharField(max_length=50, blank=True, null=True))
    avatar_url = models.URLField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    mfa_enabled = models.BooleanField(default=False)
    last_login = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    roles = models.ManyToManyField(Role, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['email_hash']),
        ]

    def get_decrypted_email(self):
        return self.email

    def get_decrypted_phone(self):
        return self.phone

    def save(self, *args, **kwargs):
        if self.email:
            self.email_hash = hash_email(self.email)
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        # Zod-like strict email validation
        email_regex = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        if self.email and not email_regex.match(self.email):
            raise ValidationError({'email': "Format d'email invalide."})

        # Zod-like E.164 phone validation
        phone_regex = re.compile(r'^\+[1-9]\d{1,14}$')
        if self.phone and not phone_regex.match(self.phone):
            raise ValidationError({'phone': 'Le numéro de téléphone doit être au format E.164 (ex: +33612345678).'})

        # Password complexity validation
        # Only validate if the password is plain text (not yet hashed)
        if self.password and not self.password.startswith(('pbkdf2_sha256$', 'argon2')):
            if len(self.password) < 12:
                raise ValidationError({'password': 'Le mot de passe doit contenir au moins 12 caractères.'})
            if not re.search(r'[A-Z]', self.password) or \
               not re.search(r'[a-z]', self.password) or \
               not re.search(r'[0-9]', self.password) or \
               not re.search(r'[\W_]', self.password):
                raise ValidationError({'password': 'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.'})

class Session(LoggedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=64) # SHA-256 length
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    expires_at = models.DateTimeField()

    def clean(self):
        super().clean()
        if self.expires_at and self.expires_at <= timezone.now():
            raise ValidationError({'expires_at': "La date d'expiration doit être dans le futur."})

class Notification(LoggedModel):
    class NotificationType(models.TextChoices):
        TASK_ASSIGNED = 'TASK_ASSIGNED', 'Task Assigned'
        TASK_COMPLETED = 'TASK_COMPLETED', 'Task Completed'
        PROJECT_STATUS = 'PROJECT_STATUS', 'Project Status'
        TICKET_UPDATE = 'TICKET_UPDATE', 'Ticket Update'
        LEAVE_REQUEST = 'LEAVE_REQUEST', 'Leave Request'
        DOCUMENT_EXPIRY = 'DOCUMENT_EXPIRY', 'Document Expiry'
        ADMIN_RECORD = 'ADMIN_RECORD', 'Admin Record'
        BUDGET_ALERT = 'BUDGET_ALERT', 'Budget Alert'
        FOLLOW_UP = 'FOLLOW_UP', 'Follow Up'
        GENERAL = 'GENERAL', 'General'

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NotificationType.choices)
    is_read = models.BooleanField(default=False)
    entity_type = models.CharField(max_length=100, blank=True)
    entity_id = models.CharField(max_length=255, blank=True)
    link = models.CharField(max_length=500, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['notification_type']),
        ]
