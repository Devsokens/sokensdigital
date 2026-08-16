from rest_framework import serializers
from decimal import Decimal

from procurement.models import (
    Supplier,
    ProcurementRequest,
    SupplierQuote,
    CashVoucher,
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
            'rcf_approved_at', 'rcf_approved_by', 'manager_approved_at',
            'manager_approved_by', 'requested_by_name', 'rcf_approved_by_name',
            'manager_approved_by_name', 'department_name', 'status_display'
        ]


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


class CashVoucherSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    reconciled_by_name = serializers.CharField(source='reconciled_by.get_full_name', read_only=True)

    class Meta:
        model = CashVoucher
        fields = [
            'id', 'type', 'type_display', 'voucher_number', 'date', 'amount',
            'description', 'disbursement', 'created_by', 'created_by_name',
            'reconciled_by', 'reconciled_by_name', 'reconciled_at', 'created_at'
        ]
        read_only_fields = [
            'voucher_number', 'created_by_name', 'reconciled_by_name',
            'type_display'
        ]


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
            'status', 'status_display', 'cash_voucher',
            'received_by', 'received_by_name', 'received_at',
            'validated_by', 'validated_by_name', 'validated_at', 'created_at'
        ]
        read_only_fields = [
            'amount_ttc', 'received_by_name', 'validated_by_name',
            'supplier_name', 'status_display', 'received_at'
        ]

    def get_vat_amount(self, obj):
        return obj.amount_ht * obj.vat_rate
