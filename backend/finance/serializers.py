from rest_framework import serializers

from core.serializers import UserBriefSerializer
from finance.models import DisbursementRequest
from projects.models import Project


class DisbursementRequestSerializer(serializers.ModelSerializer):
    requested_by = UserBriefSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        source='project', queryset=Project.objects.all(), write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = DisbursementRequest
        fields = [
            'id', 'project', 'project_id', 'requested_by', 'amount',
            'beneficiary', 'reason', 'status', 'created_at',
        ]
        read_only_fields = ['project', 'requested_by', 'status']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant doit être positif.')
        return value
