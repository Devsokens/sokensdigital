from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from core.sanitize import sanitize_html
from core.storage import sign_private_path
from core.serializers import UserBriefSerializer
from marketing.conversion import create_converted_lead_for_client
from marketing.models import Lead
from .models import (
    Client, Contact, ClientInteraction, ClientDocument, EmployeeDocument,
    LeaveRequest, CompanyAsset, AdministrativeRecord, ContractGenerator, Appointment,
    Meeting, MeetingNote,
)

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'
        read_only_fields = ['client', 'created_by']


class ContactDirectorySerializer(serializers.ModelSerializer):
    """Contact vu depuis l'annuaire : le client est modifiable (rattacher,
    changer ou détacher) et son nom est joint pour l'affichage."""
    client = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(), required=False, allow_null=True,
    )
    client_name = serializers.CharField(source='client.company_name', read_only=True, default=None)

    class Meta:
        model = Contact
        fields = [
            'id', 'client', 'client_name', 'first_name', 'last_name', 'email', 'phone',
            'role', 'is_primary', 'notes', 'created_at',
        ]

class ClientListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            'id', 'company_name', 'siret', 'sector', 'email', 'phone', 'city', 'rating',
            'status', 'assigned_to', 'created_at',
        ]

class ClientContactInputSerializer(serializers.Serializer):
    """Un contact du formulaire client (même bloc que le formulaire lead).
    `id` présent = contact existant de ce client à modifier ; absent ou
    inconnu = nouveau contact."""
    id = serializers.CharField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    role = serializers.CharField(max_length=255, required=False, allow_blank=True)


# Champs du formulaire lead que le formulaire client reprend : ils ne
# vivent pas sur Client mais sur son lead converti (marketing.Lead).
CLIENT_LEAD_FIELDS = ('lead_source', 'qualification_score', 'estimated_value')


def _sync_client_contacts(client, contacts, delete_missing):
    """Aligne les contacts du client sur la liste du formulaire. Le premier
    est le contact principal, comme dans le formulaire lead."""
    existing = {str(c.id): c for c in client.contacts.all()}
    kept = set()
    for index, data in enumerate(contacts):
        fields = {
            'first_name': data['first_name'].strip(),
            'last_name': data['last_name'].strip(),
            'email': (data.get('email') or '').strip(),
            'phone': (data.get('phone') or '').strip(),
            'role': (data.get('role') or '').strip(),
            'is_primary': index == 0,
        }
        contact = existing.get(data.get('id') or '')
        if contact:
            for key, value in fields.items():
                setattr(contact, key, value)
            contact.save()
            kept.add(str(contact.id))
        else:
            Contact.objects.create(client=client, **fields)
    if delete_missing:
        for contact_id, contact in existing.items():
            if contact_id not in kept:
                contact.delete()


class ClientSerializer(serializers.ModelSerializer):
    contacts = ClientContactInputSerializer(many=True, write_only=True, required=False)
    lead_source = serializers.ChoiceField(choices=Lead.Source.choices, write_only=True, required=False)
    qualification_score = serializers.IntegerField(min_value=0, max_value=100, write_only=True, required=False)
    estimated_value = serializers.DecimalField(
        max_digits=12, decimal_places=2, write_only=True, required=False, allow_null=True,
    )
    # Lead converti rattaché (source, score, valeur) — pour pré-remplir le
    # formulaire client en modification.
    lead = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'
        # 'status' en lecture seule — suite au pentest du 24/09/2026 : un
        # Commercial autorisé à PATCHer son propre client pouvait envoyer
        # {"status": "ARCHIVE"} et contourner ainsi l'action `archive`,
        # réservée au Super-Admin. Le statut par défaut (CLIENT_ACTIF) couvre
        # déjà la création ; toute transition passe désormais par une
        # action dédiée, jamais par une écriture directe du champ.
        read_only_fields = ['status']

    def get_lead(self, obj):
        lead = obj.leads.order_by('created_at').first()
        if not lead:
            return None
        return {
            'id': str(lead.id),
            'source': lead.source,
            'qualification_score': lead.qualification_score,
            'estimated_value': str(lead.estimated_value) if lead.estimated_value is not None else None,
        }

    def validate(self, data):
        # We can run model clean for validation
        model_data = {k: v for k, v in data.items() if k not in CLIENT_LEAD_FIELDS and k != 'contacts'}
        instance = Client(**model_data)
        instance.clean()
        return data

    def _pop_lead_fields(self, validated_data):
        """Champs lead retirés du payload, renommés comme sur marketing.Lead.
        Lus ensuite par la vue (création) ou appliqués ici (modification)."""
        extras = {k: validated_data.pop(k) for k in CLIENT_LEAD_FIELDS if k in validated_data}
        if 'lead_source' in extras:
            extras['source'] = extras.pop('lead_source')
        return extras

    def create(self, validated_data):
        contacts = validated_data.pop('contacts', None) or []
        self.lead_extras = self._pop_lead_fields(validated_data)
        with transaction.atomic():
            client = super().create(validated_data)
            _sync_client_contacts(client, contacts, delete_missing=False)
        return client

    def update(self, instance, validated_data):
        contacts = validated_data.pop('contacts', None)
        lead_extras = self._pop_lead_fields(validated_data)
        with transaction.atomic():
            client = super().update(instance, validated_data)
            # Absent du payload = contacts non touchés (PATCH partiel).
            if contacts is not None:
                _sync_client_contacts(client, contacts, delete_missing=True)
            if lead_extras:
                lead = client.leads.order_by('created_at').first() or create_converted_lead_for_client(client)
                for key, value in lead_extras.items():
                    setattr(lead, key, value)
                lead.save(update_fields=list(lead_extras))
        return client

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
            'kind', 'video_url', 'client', 'client_name', 'attendees', 'attendees_detail',
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
        fields = ['id', 'appointment', 'title', 'agenda_items', 'agenda', 'minutes_summary', 'notes', 'created_at']
        read_only_fields = ['appointment']

    def validate_agenda_items(self, value):
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise serializers.ValidationError("L'ordre du jour doit être une liste de points.")
        items = [item.strip()[:500] for item in value if item.strip()]
        if len(items) > 100:
            raise serializers.ValidationError("100 points maximum.")
        return items

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
