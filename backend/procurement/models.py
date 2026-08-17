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
        BROUILLON = 'BROUILLON', 'Brouillon'
        EN_ATTENTE_RCF = 'EN_ATTENTE_RCF', 'En attente RCF'
        EN_ATTENTE_MANAGER = 'EN_ATTENTE_MANAGER', 'En attente Gérant'
        APPROUVEE = 'APPROUVEE', 'Approuvée'
        REJETEE = 'REJETEE', 'Rejetée'
        EN_COURS = 'EN_COURS', 'En cours (devis/décaissement)'
        TERMINEE = 'TERMINEE', 'Terminée (achat fait)'

    title = models.CharField(max_length=255)
    description = models.TextField()  # Besoins détaillés
    estimated_amount = models.DecimalField(max_digits=12, decimal_places=2)

    department = models.ForeignKey('core.Department', on_delete=models.CASCADE, related_name='procurement_requests')
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='procurement_requests')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.BROUILLON)
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
        BROUILLON = 'BROUILLON', 'Brouillon'
        EN_ATTENTE = 'EN_ATTENTE', 'En attente validation'
        VALIDE = 'VALIDE', 'Validé'
        REJETE = 'REJETE', 'Rejeté'

    procurement = models.ForeignKey(ProcurementRequest, on_delete=models.CASCADE, related_name='quotes')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='quotes')

    quote_number = models.CharField(max_length=20, unique=True, editable=False)
    quote_date = models.DateField(default=timezone.now)

    amount_ht = models.DecimalField(max_digits=12, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal('0.18'))
    amount_ttc = models.DecimalField(max_digits=12, decimal_places=2, editable=False)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.BROUILLON)

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


class SupplierInvoice(LoggedModel):
    """Facture fournisseur — reçue après achat."""

    class Status(models.TextChoices):
        RECUE = 'RECUE', 'Reçue'
        VALIDEE = 'VALIDEE', 'Validée'
        PAYEE = 'PAYEE', 'Payée'

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='invoices')
    procurement = models.ForeignKey(ProcurementRequest, on_delete=models.CASCADE, related_name='invoices')
    quote = models.ForeignKey(SupplierQuote, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')

    invoice_number = models.CharField(max_length=20, unique=True)  # N° fournisseur
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)

    amount_ht = models.DecimalField(max_digits=12, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal('0.18'))
    amount_ttc = models.DecimalField(max_digits=12, decimal_places=2, editable=False)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECUE)

    # Pièce caisse liée — si réglée en espèces. Pointe vers treasury.CashEntry
    # (modèle unifié depuis fusion avec l'ancien procurement.CashVoucher, cf.
    # audit AUDIT_LOGIQUE_METIER_TRESORERIE_2026-08.md §H3).
    cash_entry = models.OneToOneField('treasury.CashEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='paid_supplier_invoice')

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
