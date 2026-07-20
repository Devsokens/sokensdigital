from django.contrib import admin

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


@admin.register(DisbursementRequest)
class DisbursementRequestAdmin(admin.ModelAdmin):
    list_display = ('beneficiary', 'amount', 'status', 'project', 'requested_by', 'created_at')
    list_filter = ('status',)
    search_fields = ('beneficiary', 'reason')


@admin.register(AccountingPeriod)
class AccountingPeriodAdmin(admin.ModelAdmin):
    list_display = ('label', 'start_date', 'end_date', 'status', 'closed_by')
    list_filter = ('status',)


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'account_class')
    list_filter = ('account_class',)
    search_fields = ('code', 'name')


class TransactionLineInline(admin.TabularInline):
    model = TransactionLine
    extra = 0


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('label', 'journal_code', 'date', 'period', 'created_by')
    list_filter = ('journal_code', 'period')
    inlines = [TransactionLineInline]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'client_name', 'amount_ttc', 'status', 'issue_date')
    list_filter = ('status',)
    search_fields = ('invoice_number', 'client_name')


@admin.register(BankStatementImport)
class BankStatementImportAdmin(admin.ModelAdmin):
    list_display = ('filename', 'imported_by', 'created_at')


@admin.register(BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = ('label', 'amount', 'date', 'status', 'statement_import')
    list_filter = ('status',)


@admin.register(TaxDeclaration)
class TaxDeclarationAdmin(admin.ModelAdmin):
    list_display = ('period', 'status', 'collected_vat', 'deductible_vat', 'net_vat')
    list_filter = ('status',)
