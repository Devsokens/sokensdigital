from decimal import Decimal

from rest_framework import serializers

from core.serializers import UserBriefSerializer
from finance.models import (
    Account,
    AccountingPeriod,
    BankStatementImport,
    BankTransaction,
    DisbursementRequest,
    Invoice,
    JournalEntry,
    TaxDeclaration,
    TransactionLine,
)
from projects.models import Project


class DisbursementRequestSerializer(serializers.ModelSerializer):
    requested_by = UserBriefSerializer(read_only=True)
    decided_by = UserBriefSerializer(read_only=True)
    executed_by = UserBriefSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        source='project', queryset=Project.objects.all(), write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = DisbursementRequest
        fields = [
            'id', 'project', 'project_id', 'requested_by', 'amount',
            'beneficiary', 'reason', 'status', 'rejection_reason', 'decided_by', 'decided_at',
            'executed_by', 'executed_at', 'created_at',
        ]
        read_only_fields = [
            'project', 'requested_by', 'status', 'rejection_reason', 'decided_by', 'decided_at',
            'executed_by', 'executed_at',
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant doit être positif.')
        return value


class AccountingPeriodSerializer(serializers.ModelSerializer):
    closed_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = AccountingPeriod
        fields = ['id', 'label', 'start_date', 'end_date', 'status', 'closed_by', 'closed_at', 'created_at']
        read_only_fields = ['status', 'closed_by', 'closed_at']


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'code', 'name', 'account_class']


class TransactionLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = TransactionLine
        fields = ['id', 'account', 'account_code', 'account_name', 'label', 'debit', 'credit', 'lettrage_code']
        read_only_fields = ['lettrage_code']

    def validate(self, attrs):
        debit = attrs.get('debit') or Decimal('0')
        credit = attrs.get('credit') or Decimal('0')
        if debit and credit:
            raise serializers.ValidationError('Une ligne ne peut être à la fois débitrice et créditrice.')
        if not debit and not credit:
            raise serializers.ValidationError('Une ligne doit avoir un débit ou un crédit non nul.')
        return attrs


class JournalEntrySerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)
    lines = TransactionLineSerializer(many=True)
    is_locked = serializers.BooleanField(read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            'id', 'period', 'journal_code', 'date', 'label', 'created_by',
            'source_invoice', 'is_locked', 'lines', 'created_at',
        ]
        read_only_fields = ['created_by', 'source_invoice']

    def validate(self, attrs):
        period = attrs.get('period') or getattr(self.instance, 'period', None)
        if period and period.status == period.Status.CLOTUREE:
            raise serializers.ValidationError("La période comptable est clôturée : aucune écriture n'est autorisée.")
        lines = attrs.get('lines')
        if lines is not None:
            if len(lines) < 2:
                raise serializers.ValidationError({'lines': "Une écriture doit comporter au moins deux lignes."})
            total_debit = sum((line['debit'] or Decimal('0') for line in lines), Decimal('0'))
            total_credit = sum((line['credit'] or Decimal('0') for line in lines), Decimal('0'))
            if total_debit != total_credit:
                raise serializers.ValidationError({'lines': f"L'écriture n'est pas équilibrée (débit {total_debit} ≠ crédit {total_credit})."})
        return attrs

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        entry = JournalEntry.objects.create(**validated_data)
        for line_data in lines_data:
            TransactionLine.objects.create(entry=entry, **line_data)
        return entry


class InvoiceSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)
    validated_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'client_name', 'issue_date', 'due_date',
            'amount_ht', 'vat_rate', 'amount_ttc', 'status', 'created_by',
            'validated_by', 'validated_at', 'created_at',
        ]
        read_only_fields = ['invoice_number', 'amount_ttc', 'status', 'created_by', 'validated_by', 'validated_at']

    def validate_amount_ht(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant HT doit être positif.')
        return value


class BankTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankTransaction
        fields = ['id', 'date', 'label', 'amount', 'matched_line', 'status']
        read_only_fields = ['matched_line', 'status']


class BankStatementImportRowSerializer(serializers.Serializer):
    date = serializers.DateField()
    label = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class BankStatementImportSerializer(serializers.ModelSerializer):
    imported_by = UserBriefSerializer(read_only=True)
    transactions = BankTransactionSerializer(many=True, read_only=True)
    rows = BankStatementImportRowSerializer(many=True, write_only=True)

    class Meta:
        model = BankStatementImport
        fields = ['id', 'filename', 'imported_by', 'transactions', 'rows', 'created_at']
        read_only_fields = ['imported_by']

    def create(self, validated_data):
        rows = validated_data.pop('rows')
        statement = BankStatementImport.objects.create(**validated_data)
        BankTransaction.objects.bulk_create([
            BankTransaction(statement_import=statement, **row) for row in rows
        ])
        return statement


class TaxDeclarationSerializer(serializers.ModelSerializer):
    generated_by = UserBriefSerializer(read_only=True)
    validated_by = UserBriefSerializer(read_only=True)
    period_label = serializers.CharField(source='period.label', read_only=True)

    class Meta:
        model = TaxDeclaration
        fields = [
            'id', 'period', 'period_label', 'status', 'collected_vat',
            'deductible_vat', 'net_vat', 'generated_by', 'validated_by',
            'validated_at', 'created_at',
        ]
        read_only_fields = [
            'status', 'collected_vat', 'deductible_vat', 'net_vat',
            'generated_by', 'validated_by', 'validated_at',
        ]
