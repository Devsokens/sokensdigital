from django.contrib import admin
from procurement.models import (
    Supplier,
    ProcurementRequest,
    SupplierQuote,
    CashVoucher,
    SupplierInvoice,
)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'siret', 'email', 'is_active', 'created_at')
    list_filter = ('is_active', 'country', 'created_at')
    search_fields = ('name', 'siret', 'email')
    fieldsets = (
        ('Infos', {'fields': ('name', 'siret', 'email', 'phone', 'contact_person')}),
        ('Adresse', {'fields': ('address', 'city', 'postal_code', 'country')}),
        ('Bancaire', {'fields': ('bank_account', 'bank_name')}),
        ('Statut', {'fields': ('is_active',)}),
    )


@admin.register(ProcurementRequest)
class ProcurementRequestAdmin(admin.ModelAdmin):
    list_display = ('title', 'department', 'estimated_amount', 'status', 'created_at')
    list_filter = ('status', 'department', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at', 'rcf_approved_at', 'manager_approved_at')
    fieldsets = (
        ('Demande', {'fields': ('title', 'description', 'estimated_amount', 'department', 'requested_by')}),
        ('Status', {'fields': ('status', 'rejection_reason')}),
        ('Approbations', {
            'fields': (
                'rcf_approved_by', 'rcf_approved_at',
                'manager_approved_by', 'manager_approved_at'
            )
        }),
    )


@admin.register(SupplierQuote)
class SupplierQuoteAdmin(admin.ModelAdmin):
    list_display = ('quote_number', 'supplier', 'amount_ttc', 'status', 'created_at')
    list_filter = ('status', 'supplier', 'quote_date')
    search_fields = ('quote_number', 'supplier__name')
    readonly_fields = ('quote_number', 'amount_ttc', 'created_at', 'rcf_validated_at', 'manager_validated_at')
    fieldsets = (
        ('Devis', {'fields': ('procurement', 'supplier', 'quote_number', 'quote_date')}),
        ('Montants', {'fields': ('amount_ht', 'vat_rate', 'amount_ttc')}),
        ('Status', {'fields': ('status',)}),
        ('Validations', {
            'fields': (
                'rcf_validated_by', 'rcf_validated_at',
                'manager_validated_by', 'manager_validated_at'
            )
        }),
    )


@admin.register(CashVoucher)
class CashVoucherAdmin(admin.ModelAdmin):
    list_display = ('voucher_number', 'type', 'amount', 'date', 'created_at')
    list_filter = ('type', 'date', 'reconciled_at')
    search_fields = ('voucher_number', 'description')
    readonly_fields = ('voucher_number', 'created_at', 'reconciled_at')
    fieldsets = (
        ('Pièce', {'fields': ('type', 'voucher_number', 'date', 'amount', 'description')}),
        ('Liens', {'fields': ('disbursement', 'created_by')}),
        ('Rapprochement', {'fields': ('reconciled_by', 'reconciled_at')}),
    )


@admin.register(SupplierInvoice)
class SupplierInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'supplier', 'amount_ttc', 'status', 'invoice_date')
    list_filter = ('status', 'supplier', 'invoice_date')
    search_fields = ('invoice_number', 'supplier__name')
    readonly_fields = ('amount_ttc', 'received_at', 'validated_at', 'created_at')
    fieldsets = (
        ('Facture', {'fields': ('supplier', 'procurement', 'quote', 'invoice_number', 'invoice_date', 'due_date')}),
        ('Montants', {'fields': ('amount_ht', 'vat_rate', 'amount_ttc')}),
        ('Status', {'fields': ('status', 'cash_voucher')}),
        ('Historique', {
            'fields': (
                'received_by', 'received_at',
                'validated_by', 'validated_at'
            )
        }),
    )
