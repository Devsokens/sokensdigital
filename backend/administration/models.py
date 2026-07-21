from django.db import models
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
import re
from django.utils import timezone
from datetime import timedelta

# Assuming core models are importable from core.models
# We mock them here for the sake of tests if they don't exist, 
# but the prompt says they are in core.models
from core.models import LoggedModel, User

class Client(LoggedModel):
    class Status(models.TextChoices):
        PROSPECT = 'PROSPECT', _('Prospect')
        CLIENT_ACTIF = 'CLIENT_ACTIF', _('Client Actif')
        CLIENT_INACTIF = 'CLIENT_INACTIF', _('Client Inactif')
        ARCHIVE = 'ARCHIVE', _('Archivé')

    company_name = models.CharField(max_length=255)
    siret = models.CharField(max_length=14, unique=True, null=True, blank=True)
    sector = models.CharField(max_length=255, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    website = models.URLField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROSPECT)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True, blank=True
    )
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='assigned_clients')

    def clean(self):
        super().clean()
        if self.siret and not re.match(r'^\d{14}$', self.siret):
            raise ValidationError({'siret': 'Le SIRET doit contenir exactement 14 chiffres.'})
        # Email format is handled by EmailField, but we could add custom logic here if needed.

    def __str__(self):
        return self.company_name

class ClientInteraction(LoggedModel):
    class InteractionType(models.TextChoices):
        CALL = 'CALL', _('Appel')
        EMAIL = 'EMAIL', _('Email')
        MEETING = 'MEETING', _('Réunion')
        OTHER = 'OTHER', _('Autre')

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='interactions')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='client_interactions')
    interaction_type = models.CharField(max_length=20, choices=InteractionType.choices)
    subject = models.CharField(max_length=255)
    notes = models.TextField()
    follow_up_date = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_locked(self):
        return timezone.now() > self.created_at + timedelta(hours=24)

class ClientDocument(LoggedModel):
    class FileType(models.TextChoices):
        CONTRAT = 'CONTRAT', _('Contrat')
        DEVIS = 'DEVIS', _('Devis')
        FACTURE = 'FACTURE', _('Facture')
        AUTRE_JURIDIQUE = 'AUTRE_JURIDIQUE', _('Autre juridique')

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='documents')
    name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_type = models.CharField(max_length=20, choices=FileType.choices)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_client_docs')
    is_sensitive = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

class EmployeeDocument(LoggedModel):
    class DocumentType(models.TextChoices):
        CONTRAT_TRAVAIL = 'CONTRAT_TRAVAIL', _('Contrat de travail')
        FICHE_PAIE = 'FICHE_PAIE', _('Fiche de paie')
        ATTESTATION = 'ATTESTATION', _('Attestation')
        DIPLOME = 'DIPLOME', _('Diplôme')
        AUTRE = 'AUTRE', _('Autre')

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='employee_documents')
    document_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    document_type = models.CharField(max_length=20, choices=DocumentType.choices)
    expiry_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

class LeaveRequest(LoggedModel):
    class LeaveType(models.TextChoices):
        CONGE_PAYE = 'CONGE_PAYE', _('Congé payé')
        MALADIE = 'MALADIE', _('Maladie')
        SANS_SOLDE = 'SANS_SOLDE', _('Sans solde')
        RTT = 'RTT', _('RTT')
        EXCEPTIONNEL = 'EXCEPTIONNEL', _('Exceptionnel')
        
    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', _('Brouillon')
        EN_ATTENTE = 'EN_ATTENTE', _('En attente')
        APPROUVE = 'APPROUVE', _('Approuvé')
        REJETE = 'REJETE', _('Rejeté')

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LeaveType.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.BROUILLON)
    reason = models.TextField(blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')

    def clean(self):
        super().clean()
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValidationError("La date de début doit être antérieure ou égale à la date de fin.")
            
            # Check overlap
            overlaps = LeaveRequest.objects.filter(
                user=self.user,
                start_date__lte=self.end_date,
                end_date__gte=self.start_date
            ).exclude(pk=self.pk)
            
            if overlaps.exists():
                raise ValidationError("Une demande de congé existe déjà pour cette période.")

class CompanyAsset(LoggedModel):
    class AssetType(models.TextChoices):
        ORDINATEUR = 'ORDINATEUR', _('Ordinateur')
        TELEPHONE = 'TELEPHONE', _('Téléphone')
        ECRAN = 'ECRAN', _('Ecran')
        CLAVIER = 'CLAVIER', _('Clavier')
        SOURIS = 'SOURIS', _('Souris')
        MOBILIER = 'MOBILIER', _('Mobilier')
        AUTRE = 'AUTRE', _('Autre')

    class ConditionStatus(models.TextChoices):
        NEUF = 'NEUF', _('Neuf')
        BON = 'BON', _('Bon état')
        USAGE = 'USAGE', _('Usagé')
        REPARATION = 'REPARATION', _('En réparation')
        HORS_SERVICE = 'HORS_SERVICE', _('Hors service')

    asset_name = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=255, unique=True)
    asset_type = models.CharField(max_length=20, choices=AssetType.choices)
    current_holder = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='held_assets')
    condition_status = models.CharField(max_length=20, choices=ConditionStatus.choices)
    purchase_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

class AdministrativeRecord(LoggedModel):
    class RecordType(models.TextChoices):
        PV_ASSEMBLEE = 'PV_ASSEMBLEE', _('PV Assemblée')
        NOTE_SERVICE = 'NOTE_SERVICE', _('Note de service')
        DECISION_DIRECTION = 'DECISION_DIRECTION', _('Décision direction')

    title = models.CharField(max_length=255)
    record_type = models.CharField(max_length=30, choices=RecordType.choices)
    event_date = models.DateField(null=True, blank=True)
    file_path = models.CharField(max_length=500, blank=True)
    content = models.TextField(blank=True)
    is_public_internally = models.BooleanField(default=False)
    is_finalized = models.BooleanField(default=False)

    def clean(self):
        super().clean()
        if self.pk:
            old = AdministrativeRecord.objects.get(pk=self.pk)
            if old.is_finalized and self.file_path != old.file_path:
                raise ValidationError({'file_path': 'Le fichier ne peut pas être modifié une fois finalisé.'})

class ContractGenerator(LoggedModel):
    class ContractType(models.TextChoices):
        PRESTATION_SERVICES = 'PRESTATION_SERVICES', _('Prestation de services')
        NDA = 'NDA', _('NDA')
        CDI = 'CDI', _('CDI')
        CDD = 'CDD', _('CDD')

    class SigningStatus(models.TextChoices):
        BROUILLON = 'BROUILLON', _('Brouillon')
        EN_ATTENTE_DE_SIGNATURE = 'EN_ATTENTE_DE_SIGNATURE', _('En attente de signature')
        SIGNE = 'SIGNE', _('Signé')
        EXPIRE = 'EXPIRE', _('Expiré')

    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    employee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_contracts')
    contract_type = models.CharField(max_length=30, choices=ContractType.choices)
    template_data = models.JSONField(default=dict, blank=True)
    generated_file_path = models.CharField(max_length=500, blank=True)
    signing_status = models.CharField(max_length=30, choices=SigningStatus.choices, default=SigningStatus.BROUILLON)
    envelope_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        if self.pk:
            old = ContractGenerator.objects.get(pk=self.pk)
            # block mods after EN_ATTENTE_DE_SIGNATURE except for specific status updates
            if old.signing_status in [self.SigningStatus.EN_ATTENTE_DE_SIGNATURE, self.SigningStatus.SIGNE, self.SigningStatus.EXPIRE]:
                # allow status changes, envelope_id changes, signed_at changes, but not core data
                if self.template_data != old.template_data or self.contract_type != old.contract_type or self.client != old.client or self.employee != old.employee:
                    raise ValidationError("Impossible de modifier les données du contrat une fois envoyé pour signature.")
