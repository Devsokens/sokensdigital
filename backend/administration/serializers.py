from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from core.sanitize import sanitize_html
from core.storage import sign_private_path
from core.serializers import UserBriefSerializer
from .models import (
    Client, Contact, ClientInteraction, ClientDocument, EmployeeDocument,
    LeaveRequest, CompanyAsset, AdministrativeRecord, ContractGenerator, Appointment,
    Meeting, MeetingNote,
)

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'
        read_only_fields = ['client']

class ClientListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'company_name', 'siret', 'status', 'assigned_to', 'created_at']

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'
        # 'status' en lecture seule — suite au pentest du 24/09/2026 : un
        # Commercial autorisé à PATCHer son propre client pouvait envoyer
        # {"status": "ARCHIVE"} et contourner ainsi l'action `archive`,
        # réservée au Super-Admin. Le statut par défaut (PROSPECT) couvre
        # déjà la création ; toute transition passe désormais par une
        # action dédiée, jamais par une écriture directe du champ.
        read_only_fields = ['status']

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
    # Signée à chaque lecture plutôt que stockée : voir
    # ClientDocument.file_path / core.storage.upload_client_document.
    # file_path lui-même n'est jamais exposé (chemin de stockage interne,
    # pas une URL utilisable côté client).
    url = serializers.SerializerMethodField()

    class Meta:
        model = ClientDocument
        fields = ['id', 'client', 'name', 'file_type', 'uploaded_by', 'is_sensitive', 'url', 'created_at', 'updated_at']
        # 'client'/'uploaded_by' sont fixés par la vue nested (create()),
        # jamais attendus dans le payload.
        read_only_fields = ['uploaded_by', 'client']

    def get_url(self, obj):
        return sign_private_path(obj.file_path)

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

class AppointmentSerializer(serializers.ModelSerializer):
    attendees_detail = UserBriefSerializer(source='attendees', many=True, read_only=True)
    created_by_detail = UserBriefSerializer(source='created_by', read_only=True)
    client_name = serializers.CharField(source='client.company_name', read_only=True, default=None)

    class Meta:
        model = Appointment
        fields = [
            'id', 'title', 'description', 'start_at', 'end_at', 'location',
            'client', 'client_name', 'attendees', 'attendees_detail',
            'created_by', 'created_by_detail', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by']

    def validate(self, data):
        start_at = data.get('start_at', getattr(self.instance, 'start_at', None))
        end_at = data.get('end_at', getattr(self.instance, 'end_at', None))
        if start_at and end_at and start_at > end_at:
            raise serializers.ValidationError("La date de début doit être antérieure à la date de fin.")
        return data


class MeetingNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = MeetingNote
        fields = ['id', 'author', 'author_name', 'body', 'updated_at']
        read_only_fields = ['author']

    def get_author_name(self, obj):
        return f'{obj.author.first_name} {obj.author.last_name}'.strip()

    def validate_body(self, value):
        # Rendu en HTML chez les AUTRES participants — même défense XSS
        # stockée que ProjectSerializer.validate_description.
        return sanitize_html(value)


class MeetingSerializer(serializers.ModelSerializer):
    notes = MeetingNoteSerializer(many=True, read_only=True)
    title = serializers.CharField(source='appointment.title', read_only=True)

    class Meta:
        model = Meeting
        fields = ['id', 'appointment', 'title', 'agenda', 'minutes_summary', 'notes', 'created_at']
        read_only_fields = ['appointment']

    def validate_agenda(self, value):
        return sanitize_html(value)

    def validate_minutes_summary(self, value):
        return sanitize_html(value)


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
