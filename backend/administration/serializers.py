from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import (
    Client, ClientInteraction, ClientDocument, EmployeeDocument,
    LeaveRequest, CompanyAsset, AdministrativeRecord, ContractGenerator
)

class ClientListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'company_name', 'siret', 'status', 'assigned_to', 'created_at']

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'
    
    def validate(self, data):
        # We can run model clean for validation
        instance = Client(**data)
        instance.clean()
        return data

class ClientInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientInteraction
        fields = '__all__'
        # 'client' est fixé par la vue nested (perform_create), jamais
        # attendu dans le payload — sinon POST échoue en 400 "champ requis".
        read_only_fields = ['user', 'is_locked', 'client']

    def validate(self, data):
        if self.instance and self.instance.is_locked:
            raise serializers.ValidationError("Cette interaction est verrouillée (>24h).")
        return data

class ClientDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientDocument
        fields = '__all__'
        # 'client' est fixé par la vue nested (perform_create), jamais
        # attendu dans le payload — sinon POST échoue en 400 "champ requis".
        read_only_fields = ['uploaded_by', 'client']

    def to_representation(self, instance):
        # We handle hiding CONTRAT in views, but we can also handle it here if needed
        return super().to_representation(instance)

class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = '__all__'

class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = '__all__'
        read_only_fields = ['status', 'approved_by']

    def validate(self, data):
        instance = LeaveRequest(**data)
        if self.instance:
            instance.pk = self.instance.pk
            # If partially updating, merge with existing
            instance.user = data.get('user', self.instance.user)
            instance.start_date = data.get('start_date', self.instance.start_date)
            instance.end_date = data.get('end_date', self.instance.end_date)
        instance.clean()
        return data

class CompanyAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyAsset
        fields = '__all__'

class AdministrativeRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdministrativeRecord
        fields = '__all__'
        read_only_fields = ['is_finalized']

    def validate(self, data):
        if self.instance:
            instance = AdministrativeRecord(**data)
            instance.pk = self.instance.pk
            instance.file_path = data.get('file_path', self.instance.file_path)
            instance.clean()
        return data

class ContractGeneratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractGenerator
        fields = '__all__'
        read_only_fields = ['signing_status', 'envelope_id', 'signed_at']

    def validate(self, data):
        if self.instance:
            instance = ContractGenerator(**data)
            instance.pk = self.instance.pk
            instance.client = data.get('client', self.instance.client)
            instance.employee = data.get('employee', self.instance.employee)
            instance.contract_type = data.get('contract_type', self.instance.contract_type)
            instance.template_data = data.get('template_data', self.instance.template_data)
            instance.clean()
        return data
