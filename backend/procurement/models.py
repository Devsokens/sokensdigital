import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

from core.models import LoggedModel, User, DocumentAttachment
from core.constants import ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN


class Supplier(LoggedModel):
    """Fournisseur — partenaire externe pour achats."""

    name = models.CharField(max_length=255)
    siret = models.CharField(max_length=14, unique=True, null=True, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=50)
    address = models.TextField()
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default='Sénégal')

    # Coordonnées bancaires
    bank_account = models.CharField(max_length=50, help_text='IBAN ou compte local')
    bank_name = models.CharField(max_length=255, blank=True)

    contact_person = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta(LoggedModel.Meta):
        ordering = ['name']
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['name'])]

    def __str__(self):
        return self.name


class ProcurementRequest(LoggedModel):
    """Fiche état des besoins — initie cycle achat."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Brouillon'
        PENDING_RCF = 'PENDING_RCF', 'En attente RCF'
        PENDING_MANAGER = 'PENDING_MANAGER', 'En attente Gérant'
        APPROVED = 'APPROVED', 'Approuvé'
        REJECTED = 'REJECTED', 'Rejeté'
        IN_PROGRESS = 'IN_PROGRESS', 'En cours (devis/décaissement)'
        COMPLETED = 'COMPLETED', 'Complété (achat fait)'

    title = models.CharField(max_length=255)
    description = models.TextField()  # Besoins détaillés
    estimated_amount = models.DecimalField(max_digits=12, decimal_places=2)

    department = models.ForeignKey('core.Department', on_delete=models.CASCADE, related_name='procurement_requests')
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='procurement_requests')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    rejection_reason = models.TextField(blank=True)

    # Approbations
    rcf_approved_at = models.DateTimeField(null=True, blank=True)
    rcf_approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_procurements_rcf')
    manager_approved_at = models.DateTimeField(null=True, blank=True)
    manager_approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_procurements_manager')

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['status'])]

    def __str__(self):
        return f'{self.title} ({self.status})'

    def clean(self):
        if self.estimated_amount <= 0:
            raise ValidationError({'estimated_amount': 'Montant doit être positif'})


class SupplierQuote(LoggedModel):
    """Devis fournisseur — validation RCF + Gérant."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Brouillon'
        PENDING = 'PENDING', 'En attente validation'
        VALIDATED = 'VALIDATED', 'Validé'
        REJECTED = 'REJECTED', 'Rejeté'

    procurement = models.ForeignKey(ProcurementRequest, on_delete=models.CASCADE, related_name='quotes')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='quotes')

    quote_number = models.CharField(max_length=20, unique=True, editable=False)
    quote_date = models.DateField(default=timezone.now)

    amount_ht = models.DecimalField(max_digits=12, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal('0.18'))
    amount_ttc = models.DecimalField(max_digits=12, decimal_places=2, editable=False)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    rcf_validated_at = models.DateTimeField(null=True, blank=True)
    rcf_validated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_quotes_rcf')
    manager_validated_at = models.DateTimeField(null=True, blank=True)
    manager_validated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_quotes_manager')

    class Meta(LoggedModel.Meta):
        ordering = ['-quote_date']

    def __str__(self):
        return f'{self.quote_number} — {self.supplier.name}'

    def save(self, *args, **kwargs):
        if not self.quote_number:
            year = timezone.now().year
            count = SupplierQuote.objects.filter(quote_number__contains=str(year)).count() + 1
            self.quote_number = f'QUOTE-{year}-{count:05d}'

        # Calculate TTC
        self.amount_ttc = self.amount_ht * (1 + self.vat_rate)
        super().save(*args, **kwargs)


class CashVoucher(LoggedModel):
    """Pièce de caisse (sortie) — constatation décaissement."""

    class Type(models.TextChoices):
        RECEIPT = 'RECEIPT', 'Reçu caisse (entrée)'
        VOUCHER = 'VOUCHER', 'Pièce de sortie'

    type = models.CharField(max_length=20, choices=Type.choices, default=Type.VOUCHER)
    voucher_number = models.CharField(max_length=20, unique=True, editable=False)
    date = models.DateField(default=timezone.now)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)

    # Lien à DisbursementRequest (décaissement approuvé)
    disbursement = models.OneToOneField('finance.DisbursementRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_voucher')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_vouchers')
    reconciled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reconciled_vouchers')
    reconciled_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-date']

    def __str__(self):
        return f'{self.voucher_number} ({self.amount})'

    def save(self, *args, **kwargs):
        if not self.voucher_number:
            year = timezone.now().year
            count = CashVoucher.objects.filter(voucher_number__contains=str(year)).count() + 1
            self.voucher_number = f'BON-{year}-{count:05d}'
        super().save(*args, **kwargs)


class SupplierInvoice(LoggedModel):
    """Facture fournisseur — reçue après achat."""

    class Status(models.TextChoices):
        RECEIVED = 'RECEIVED', 'Reçue'
        VALIDATED = 'VALIDATED', 'Validée'
        PAID = 'PAID', 'Payée'

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='invoices')
    procurement = models.ForeignKey(ProcurementRequest, on_delete=models.CASCADE, related_name='invoices')
    quote = models.ForeignKey(SupplierQuote, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')

    invoice_number = models.CharField(max_length=20, unique=True)  # N° fournisseur
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)

    amount_ht = models.DecimalField(max_digits=12, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal('0.18'))
    amount_ttc = models.DecimalField(max_digits=12, decimal_places=2, editable=False)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)

    # Pièce caisse liée
    cash_voucher = models.OneToOneField(CashVoucher, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_invoice')

    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='received_invoices')
    received_at = models.DateTimeField(auto_now_add=True)
    validated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_supplier_invoices')
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-invoice_date']

    def __str__(self):
        return f'{self.invoice_number} — {self.supplier.name}'

    def save(self, *args, **kwargs):
        self.amount_ttc = self.amount_ht * (1 + self.vat_rate)
        super().save(*args, **kwargs)
