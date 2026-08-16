from django.contrib import admin
from treasury.models import CashEntry, BankEntry, CapitalContribution


@admin.register(CashEntry)
class CashEntryAdmin(admin.ModelAdmin):
    list_display = ('voucher_number', 'type', 'source', 'amount', 'date', 'created_by', 'reconciled_at')
    list_filter = ('type', 'source', 'date', 'reconciled_at')
    search_fields = ('voucher_number', 'reference', 'description')
    readonly_fields = ('voucher_number', 'created_at', 'reconciled_at')
    fieldsets = (
        ('Mouvement', {'fields': ('voucher_number', 'type', 'source', 'amount', 'date', 'reference', 'description')}),
        ('Liens', {'fields': ('payment', 'disbursement', 'supplier_invoice')}),
        ('Audit', {'fields': ('created_by', 'created_at', 'reconciled_by', 'reconciled_at')}),
    )


@admin.register(BankEntry)
class BankEntryAdmin(admin.ModelAdmin):
    list_display = ('type', 'source', 'amount', 'date', 'reference', 'reconciled_at')
    list_filter = ('type', 'source', 'date', 'reconciled_at')
    search_fields = ('reference', 'description')
    readonly_fields = ('created_at', 'reconciled_at', 'bank_transaction')
    fieldsets = (
        ('Mouvement', {'fields': ('type', 'source', 'amount', 'date', 'reference', 'description')}),
        ('Liens', {'fields': ('payment', 'capital_contribution', 'disbursement', 'cash_entry')}),
        ('Rapprochement', {'fields': ('bank_transaction', 'reconciled_by', 'reconciled_at')}),
        ('Audit', {'fields': ('created_by', 'created_at')}),
    )


@admin.register(CapitalContribution)
class CapitalContributionAdmin(admin.ModelAdmin):
    list_display = ('amount', 'status', 'contribution_date', 'validated_at', 'posted_at')
    list_filter = ('status', 'contribution_date')
    readonly_fields = ('validated_at', 'posted_at', 'created_at')
    fieldsets = (
        ('Apport', {'fields': ('amount', 'contribution_date', 'status')}),
        ('Liens', {'fields': ('bank_entry',)}),
        ('Validation', {'fields': ('validated_by', 'validated_at')}),
        ('Comptabilité', {'fields': ('posted_by', 'posted_at')}),
        ('Audit', {'fields': ('created_at',)}),
    )
