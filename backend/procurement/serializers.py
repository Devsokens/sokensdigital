from rest_framework import serializers
from decimal import Decimal

from procurement.models import (
    Supplier,
    ProcurementRequest,
    SupplierQuote,
    SupplierInvoice,
)
from core.models import User


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'siret', 'email', 'phone', 'address', 'city',
            'postal_code', 'country', 'bank_account', 'bank_name',
            'contact_person', 'is_active', 'created_at'
        ]


class ProcurementRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    rcf_approved_by_name = serializers.CharField(source='rcf_approved_by.get_full_name', read_only=True)
    manager_approved_by_name = serializers.CharField(source='manager_approved_by.get_full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ProcurementRequest
        fields = [
            'id', 'title', 'description', 'estimated_amount', 'department',
            'department_name', 'requested_by', 'requested_by_name',
            'status', 'status_display', 'rejection_reason',
            'rcf_approved_at', 'rcf_approved_by', 'rcf_approved_by_name',
            'manager_approved_at', 'manager_approved_by', 'manager_approved_by_name',
            'created_at'
        ]
        read_only_fields = [
            # 'status' ajouté ici suite au pentest du 24/09/2026 (faille P1/P2) :
            # n'importe quel utilisateur authentifié pouvait créer une fiche
            # directement au statut APPROUVEE, ou PATCHer celle de quelqu'un
            # d'autre pour l'approuver soi-même, en envoyant simplement
            # `status` dans le payload. Le statut ne bouge désormais que via
            # les actions dédiées (approve_rcf/approve_manager/...) ci-dessous.
            'status', 'rcf_approved_at', 'rcf_approved_by', 'manager_approved_at',
            'manager_approved_by', 'requested_by_name', 'rcf_approved_by_name',
            'manager_approved_by_name', 'department_name', 'status_display'
        ]

    def validate_estimated_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant doit être positif.')
        return value


class SupplierQuoteSerializer(serializers.ModelSerializer):
    rcf_validated_by_name = serializers.CharField(source='rcf_validated_by.get_full_name', read_only=True)
    manager_validated_by_name = serializers.CharField(source='manager_validated_by.get_full_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    vat_amount = serializers.SerializerMethodField()

    class Meta:
        model = SupplierQuote
        fields = [
            'id', 'procurement', 'supplier', 'supplier_name', 'quote_number',
            'quote_date', 'amount_ht', 'vat_rate', 'vat_amount', 'amount_ttc',
            'status', 'status_display',
            'rcf_validated_at', 'rcf_validated_by', 'rcf_validated_by_name',
            'manager_validated_at', 'manager_validated_by', 'manager_validated_by_name',
            'created_at'
        ]
        read_only_fields = [
            'quote_number', 'amount_ttc', 'rcf_validated_at', 'rcf_validated_by',
            'manager_validated_at', 'manager_validated_by', 'supplier_name',
            'rcf_validated_by_name', 'manager_validated_by_name', 'status_display'
        ]

    def get_vat_amount(self, obj):
        return obj.amount_ht * obj.vat_rate

    def validate_amount_ht(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant HT doit être positif.')
        return value

    def validate_vat_rate(self, value):
        if not (0 <= value <= 1):
            raise serializers.ValidationError('Le taux de TVA doit être compris entre 0 et 1.')
        return value


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.get_full_name', read_only=True)
    validated_by_name = serializers.CharField(source='validated_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    vat_amount = serializers.SerializerMethodField()

    class Meta:
        model = SupplierInvoice
        fields = [
            'id', 'supplier', 'supplier_name', 'procurement', 'quote',
            'invoice_number', 'invoice_date', 'due_date',
            'amount_ht', 'vat_rate', 'vat_amount', 'amount_ttc',
            'status', 'status_display', 'cash_entry',
            'received_by', 'received_by_name', 'received_at',
            'validated_by', 'validated_by_name', 'validated_at', 'created_at'
        ]
        read_only_fields = [
            # 'status' ajouté suite au pentest du 24/09/2026 (P6) : sans ça,
            # une facture fournisseur pouvait être créée directement au
            # statut souhaité par le client plutôt que RECUE (le statut de
            # départ voulu — validate() ci-dessous est l'unique porte vers
            # VALIDEE, qui poste une écriture au Grand Livre).
            'status', 'amount_ttc', 'received_by_name', 'validated_by_name',
            'supplier_name', 'status_display', 'received_at'
        ]

    def get_vat_amount(self, obj):
        return obj.amount_ht * obj.vat_rate

    def validate_amount_ht(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant HT doit être positif.')
        return value

    def validate_vat_rate(self, value):
        if not (0 <= value <= 1):
            raise serializers.ValidationError('Le taux de TVA doit être compris entre 0 et 1.')
        return value
