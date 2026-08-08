from django.test import TestCase
from administration.serializers import ClientInteractionSerializer, LeaveRequestSerializer
from .factories import ClientInteractionFactory, UserFactory, LeaveRequestFactory
from django.utils import timezone
from datetime import timedelta

class ClientInteractionSerializerTest(TestCase):
    def test_locked_interaction_validation(self):
        interaction = ClientInteractionFactory()
        interaction.created_at = timezone.now() - timedelta(hours=25)
        interaction.save()

        serializer = ClientInteractionSerializer(instance=interaction, data={"subject": "New"}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn("Cette interaction est verrouillée", str(serializer.errors))

class LeaveRequestSerializerTest(TestCase):
    def test_overlap_validation(self):
        user = UserFactory()
        leave1 = LeaveRequestFactory(user=user)
        
        data = {
            "user": user.id,
            "leave_type": "CONGE_PAYE",
            "start_date": leave1.start_date.date(),
            "end_date": leave1.end_date.date(),
        }
        serializer = LeaveRequestSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("Une demande de congé existe déjà", str(serializer.errors))
