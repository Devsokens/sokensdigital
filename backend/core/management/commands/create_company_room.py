from django.core.management.base import BaseCommand

from core.firestore_client import upsert_chat_room


class Command(BaseCommand):
    help = (
        "One-time setup: creates the single COMPANY-wide chatRooms/company "
        "doc (firestore.rules gives every authenticated user read access to "
        "roomType == 'COMPANY', but only SUPER_ADMIN/RESPONSABLE_MARKETING "
        "can post there). Unlike Department/Project rooms, there is no "
        "Django model driving this one, so it isn't created automatically "
        "anywhere else — run this once per environment (local, Render)."
    )

    def handle(self, *args, **options):
        upsert_chat_room('company', {
            'name': "Salon de l'entreprise",
            'roomType': 'COMPANY',
        })
        self.stdout.write(self.style.SUCCESS("chatRooms/company créé (ou déjà à jour)."))
