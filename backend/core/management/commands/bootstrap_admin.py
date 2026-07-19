from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Role, User, hash_email

SUPER_ADMIN_ROLE_NAME = 'Super-Administrateur'


class Command(BaseCommand):
    help = (
        "Creates (or promotes) the very first Super-Administrateur account. "
        "There is no public sign-up by design (see docs/backend-specifications.md "
        "§3.1), so this is the only way to bootstrap the system on a fresh "
        "database. The user still authenticates via Firebase — this command "
        "just grants the business-level Role, it does not set a local password."
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

        role, _ = Role.objects.get_or_create(
            name=SUPER_ADMIN_ROLE_NAME,
            defaults={
                'description': 'Accès complet à toutes les ressources de la plateforme.',
                'permissions': {'*': True},
            },
        )

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

        user.roles.add(role)

        verb = 'Created' if created else 'Promoted existing'
        self.stdout.write(
            self.style.SUCCESS(f'{verb} user "{email}" as {SUPER_ADMIN_ROLE_NAME}.')
        )
        if created:
            self.stdout.write(
                'This user has no usable password (Firebase-only login). '
                'Sign in from the frontend with this email via Firebase once, '
                'and the firebase_uid will link automatically on first request.'
            )
