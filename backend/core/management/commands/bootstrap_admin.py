from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import User, hash_email


class Command(BaseCommand):
    help = (
        "Creates (or promotes) a pre-provisioned Django-side user row, "
        "granting Django admin access (is_staff/is_superuser). This does "
        "NOT set the application role — that lives in Firestore "
        "(profiles/{uid}.role, see docs/backend-specifications.md §3.1) and "
        "must be set separately, currently by hand in the Firebase Console. "
        "The user still authenticates via Firebase — this command sets no "
        "local password."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--email', required=True, help='Email of the account to create/promote.'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        if not email:
            raise CommandError('--email is required.')

        user = User.objects.filter(email_hash=hash_email(email)).first()
        created = user is None
        if created:
            user = User(email=email, is_active=True, is_staff=True, is_superuser=True)
            # No local password — this account only ever logs in via Firebase.
            user.set_unusable_password()
            user.save()
        else:
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            user.save(update_fields=['is_active', 'is_staff', 'is_superuser'])

        verb = 'Created' if created else 'Promoted existing'
        self.stdout.write(self.style.SUCCESS(f'{verb} Django user "{email}" (is_staff/is_superuser).'))
        self.stdout.write(
            'Remember: this only grants Django admin access. The '
            'application-level role (SUPER_ADMIN, etc.) must be set on '
            'this person\'s Firestore profiles/{uid} document separately.'
        )
        if created:
            self.stdout.write(
                'This user has no usable password (Firebase-only login). '
                'Sign in from the frontend with this email via Firebase once, '
                'and the firebase_uid will link automatically on first request.'
            )
