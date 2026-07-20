from rest_framework import serializers

from core.models import User
from core.serializers import UserBriefSerializer
from hr.models import Contract, EmployeeProfile, Payslip


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = [
            'id', 'employee', 'contract_type', 'start_date', 'end_date',
            'signed_at', 'file_url', 'status', 'created_at',
        ]
        read_only_fields = ['employee']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'La date de fin ne peut pas précéder la date de début.'}
            )
        return attrs


class PayslipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payslip
        fields = ['id', 'employee', 'period_month', 'period_year', 'file_url', 'created_at']
        read_only_fields = ['employee']

    def validate_period_month(self, value):
        if not (1 <= value <= 12):
            raise serializers.ValidationError('Le mois doit être compris entre 1 et 12.')
        return value


class EmployeeProfileSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        source='user', queryset=User.objects.all(), write_only=True
    )
    contracts = ContractSerializer(many=True, read_only=True)
    payslips = PayslipSerializer(many=True, read_only=True)

    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'user', 'user_id', 'position', 'hire_date',
            'gross_monthly_salary', 'base_hourly_cost', 'status',
            'contracts', 'payslips', 'created_at',
        ]
        read_only_fields = ['base_hourly_cost']


class EmployeeProfileSelfSerializer(serializers.ModelSerializer):
    """What a non-HR employee sees of their own record — no salary data."""

    user = UserBriefSerializer(read_only=True)
    contracts = ContractSerializer(many=True, read_only=True)
    payslips = PayslipSerializer(many=True, read_only=True)

    class Meta:
        model = EmployeeProfile
        fields = ['id', 'user', 'position', 'hire_date', 'status', 'contracts', 'payslips', 'created_at']
