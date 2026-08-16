from rest_framework import serializers
from treasury.models import CashEntry, BankEntry, CapitalContribution


class CashEntrySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    reconciled_by_name = serializers.CharField(source='reconciled_by.get_full_name', read_only=True)

    class Meta:
        model = CashEntry
        fields = [
            'id', 'voucher_number', 'type', 'type_display', 'source', 'source_display',
            'amount', 'date', 'reference', 'description',
            'payment', 'disbursement', 'supplier_invoice',
            'created_by', 'created_by_name',
            'reconciled_by', 'reconciled_by_name', 'reconciled_at',
            'created_at'
        ]
        read_only_fields = [
            'voucher_number', 'type_display', 'source_display', 'created_by_name',
            'reconciled_by_name'
        ]


class BankEntrySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    reconciled_by_name = serializers.CharField(source='reconciled_by.get_full_name', read_only=True)

    class Meta:
        model = BankEntry
        fields = [
            'id', 'type', 'type_display', 'source', 'source_display',
            'amount', 'date', 'reference', 'description',
            'payment', 'capital_contribution', 'disbursement', 'cash_entry',
            'bank_transaction',
            'created_by', 'created_by_name',
            'reconciled_by', 'reconciled_by_name', 'reconciled_at',
            'created_at'
        ]
        read_only_fields = [
            'type_display', 'source_display', 'created_by_name',
            'reconciled_by_name', 'bank_transaction'
        ]


class CapitalContributionSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    validated_by_name = serializers.CharField(source='validated_by.get_full_name', read_only=True)
    posted_by_name = serializers.CharField(source='posted_by.get_full_name', read_only=True)

    class Meta:
        model = CapitalContribution
        fields = [
            'id', 'amount', 'status', 'status_display',
            'contribution_date',
            'bank_entry',
            'validated_by', 'validated_by_name', 'validated_at',
            'posted_by', 'posted_by_name', 'posted_at',
            'created_at'
        ]
        read_only_fields = [
            'status_display', 'validated_by_name', 'posted_by_name',
            'validated_at', 'posted_at'
        ]
