import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone

from core.models import LoggedModel, User
from projects.models import Project

# Default VAT rate — peut être modifié dynamiquement via FinanceSettings.
# Placeholder: 18% (OHADA/CEMAC), mais doit être confirmé pour juridiction
# réelle de Soken's Digital. Ce constant sert de fallback si la base est vide.
DEFAULT_VAT_RATE = Decimal('0.18')


class DisbursementRequest(LoggedModel):
    """docs/backend-specifications.md §3.1/§4.1/§4.2/§6.3 + cahier des
    charges §4.3. Chef de Projet initiates; which validation tier is
    required is decided by `amount` (see THRESHOLD_N2/THRESHOLD_N3 and
    `initial_status_for_amount`) — under 10 000 FCFA a Comptable can give
    final approval alone (N1), 10 000-50 000 needs the Directeur Financier
    (N2), above 50 000 needs Super-Admin as "direction générale" (N3, no
    dedicated role exists for that in this codebase or the spec's own
    §4.8 role list). A higher tier can always approve a lower one (the
    `approve` action's role check in finance/views.py is cumulative, not
    exclusive). Comptable marks it EXECUTE once the money has actually
    moved (`execute` action)."""

    class Status(models.TextChoices):
        EN_ATTENTE_N1 = 'EN_ATTENTE_N1', 'En attente (N1)'
        EN_ATTENTE_N2 = 'EN_ATTENTE_N2', 'En attente (N2)'
        EN_ATTENTE_N3 = 'EN_ATTENTE_N3', 'En attente (N3)'
        APPROUVE = 'APPROUVE', 'Approuvé'
        REJETE = 'REJETE', 'Rejeté'
        EXECUTE = 'EXECUTE', 'Exécuté'

    PENDING_STATUSES = (Status.EN_ATTENTE_N1, Status.EN_ATTENTE_N2, Status.EN_ATTENTE_N3)

    # Cahier des charges §4.3 — bornes exactes.
    THRESHOLD_N2 = Decimal('10000')
    THRESHOLD_N3 = Decimal('50000')

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='disbursement_requests')
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='disbursement_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    beneficiary = models.CharField(max_length=255)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_ATTENTE_N1)
    rejection_reason = models.TextField(blank=True)
    decided_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='decided_disbursements')
    decided_at = models.DateTimeField(null=True, blank=True)
    executed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='executed_disbursements')
    executed_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['project']),
        ]

    def __str__(self):
        return f'{self.beneficiary} — {self.amount} ({self.status})'

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({'amount': 'Le montant doit être positif.'})

    @classmethod
    def initial_status_for_amount(cls, amount: Decimal) -> str:
        if amount > cls.THRESHOLD_N3:
            return cls.Status.EN_ATTENTE_N3
        if amount >= cls.THRESHOLD_N2:
            return cls.Status.EN_ATTENTE_N2
        return cls.Status.EN_ATTENTE_N1


class AccountingPeriod(LoggedModel):
    """§4.1 "Clôture comptable": Directeur Financier + Super-Admin only.
    Gates Grand Livre writes (§4.2 "à condition que la période financière
    soit ouverte") — a locked period's JournalEntry rows become read-only."""

    class Status(models.TextChoices):
        OUVERTE = 'OUVERTE', 'Ouverte'
        CLOTUREE = 'CLOTUREE', 'Clôturée'

    label = models.CharField(max_length=20, unique=True, help_text='Ex: 2026-07')
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OUVERTE)
    closed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_periods')
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-start_date']
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['status'])]

    def __str__(self):
        return self.label

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({'end_date': 'La date de fin doit être postérieure à la date de début.'})


class Account(LoggedModel):
    """Simplified chart of accounts (plan comptable) — just enough
    structure (code + class) to post balanced journal entries and compute
    TVA collectée/déductible. Not a full OHADA/PCG plan comptable."""

    class AccountClass(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        PASSIF = 'PASSIF', 'Passif'
        CHARGE = 'CHARGE', 'Charge'
        PRODUIT = 'PRODUIT', 'Produit'
        TVA = 'TVA', 'TVA'

    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    account_class = models.CharField(max_length=10, choices=AccountClass.choices)

    class Meta(LoggedModel.Meta):
        ordering = ['code']
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['code'])]

    def __str__(self):
        return f'{self.code} — {self.name}'


class JournalEntry(LoggedModel):
    """Grand Livre (§4.2): a balanced group of TransactionLine rows. Balance
    (sum(debit) == sum(credit)) is enforced in the serializer at creation
    time, not per-line, since it's only meaningful across the whole entry."""

    class JournalCode(models.TextChoices):
        VENTES = 'VE', 'Ventes'
        ACHATS = 'AC', 'Achats'
        BANQUE = 'BQ', 'Banque'
        OPERATIONS_DIVERSES = 'OD', 'Opérations diverses'

    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name='entries')
    journal_code = models.CharField(max_length=2, choices=JournalCode.choices)
    date = models.DateField(default=timezone.now)
    label = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_entries')
    # Set when this entry was auto-generated by Invoice validation rather
    # than typed directly into the Grand Livre — informational only.
    source_invoice = models.ForeignKey('finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_entries')

    class Meta(LoggedModel.Meta):
        ordering = ['-date', '-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['period']),
            models.Index(fields=['journal_code']),
        ]

    def __str__(self):
        return f'{self.journal_code} — {self.label}'

    @property
    def is_locked(self):
        return self.period.status == AccountingPeriod.Status.CLOTUREE


class TransactionLine(LoggedModel):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='lines')
    label = models.CharField(max_length=255, blank=True)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    # Set once matched to a BankTransaction during rapprochement bancaire —
    # shared between the two matched rows, not a foreign key, since a bank
    # transaction can in principle net multiple lines (simplified 1:1 here).
    lettrage_code = models.CharField(max_length=40, blank=True)

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['account'])]

    def __str__(self):
        return f'{self.account.code} D{self.debit}/C{self.credit}'

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.debit and self.credit:
            raise ValidationError('Une ligne ne peut être à la fois débitrice et créditrice.')


class Invoice(LoggedModel):
    """§4.2 "Facturation": Comptable validates + triggers the regularization
    entry automatically (`validate` action creates a balanced JournalEntry:
    debit client (411) for total TTC, credit sales (706) for HT, credit VAT
    collectée (4457) for the VAT amount)."""

    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        VALIDEE = 'VALIDEE', 'Validée'

    invoice_number = models.CharField(max_length=20, unique=True, editable=False)
    # Client link (nullable pour backward compat legacy client_name). Si client
    # est renseigné, utiliser client.company_name; sinon client_name texte libre.
    client = models.ForeignKey(
        'administration.Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices',
    )
    client_name = models.CharField(max_length=255, blank=True, help_text='Utilisé si pas de client FK (legacy)')
    # Cahier des charges §4.7 "Conversion — devis -> facture en un clic".
    # Nullable: invoices created directly (not from a quote) stay valid.
    quote = models.ForeignKey(
        'marketing.Quote', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices',
    )
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    amount_ht = models.DecimalField(max_digits=12, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=4, decimal_places=2, default=DEFAULT_VAT_RATE)
    amount_ttc = models.DecimalField(max_digits=12, decimal_places=2, editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.BROUILLON)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    validated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_invoices')
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-issue_date', '-created_at']
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['status'])]

    def __str__(self):
        return self.invoice_number

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            year = timezone.now().year
            last = Invoice.objects.filter(invoice_number__startswith=f'FAC-{year}-').order_by('-invoice_number').first()
            seq = int(last.invoice_number.split('-')[2]) + 1 if last else 1
            self.invoice_number = f'FAC-{year}-{seq:05d}'
        self.amount_ttc = (self.amount_ht * (1 + self.vat_rate)).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)


class BankStatementImport(LoggedModel):
    """§4.2 "Rapprochement Bancaire": metadata for one CSV import batch.
    The CSV itself isn't stored (no file storage backend configured yet) —
    only the parsed rows it produced (BankTransaction), same reasoning as
    other simplifications flagged in docs/backend-specifications.md."""

    filename = models.CharField(max_length=255)
    imported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_imports')

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.filename} ({self.created_at:%Y-%m-%d})'


class BankTransaction(LoggedModel):
    class Status(models.TextChoices):
        NON_LETTRE = 'NON_LETTRE', 'Non lettré'
        LETTRE = 'LETTRE', 'Lettré'

    statement_import = models.ForeignKey(BankStatementImport, on_delete=models.CASCADE, related_name='transactions')
    date = models.DateField()
    label = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    matched_line = models.OneToOneField(TransactionLine, on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_bank_transaction')
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NON_LETTRE)

    class Meta(LoggedModel.Meta):
        ordering = ['-date']
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['status'])]

    def __str__(self):
        return f'{self.label} — {self.amount}'


class TaxDeclaration(LoggedModel):
    """§4.1 "Gouvernance fiscale" (Directeur Financier signs/validates) +
    §4.2 "Fiscalité" (Comptable generates the BROUILLON and exports the
    FEC). `collected_vat`/`deductible_vat` are computed from TransactionLine
    rows posted to the TVA-class accounts within the period, not typed by
    hand."""

    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        VALIDEE = 'VALIDEE', 'Validée'

    period = models.OneToOneField(AccountingPeriod, on_delete=models.CASCADE, related_name='tax_declaration')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.BROUILLON)
    collected_vat = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    deductible_vat = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    net_vat = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_tax_declarations')
    validated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_tax_declarations')
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']

    def __str__(self):
        return f'TVA {self.period.label} ({self.status})'


class Payment(LoggedModel):
    """Versement partiel d'une facture — workflow paiements partiels.

    Étapes: PENDING (en attente réception) → RECEIVED (reçu) → RECORDED (enregistré compta).
    À chaque versement: créer PaymentReceipt (reçu client).
    """

    class Status(models.TextChoices):
        EN_ATTENTE = 'EN_ATTENTE', 'En attente'
        RECU = 'RECU', 'Reçu'
        ENREGISTRE = 'ENREGISTRE', 'Enregistré'

    class PaymentMethod(models.TextChoices):
        CHEQUE = 'CHEQUE', 'Chèque'
        VIREMENT = 'VIREMENT', 'Virement'
        ESPECES = 'ESPECES', 'Espèces'
        CARTE = 'CARTE', 'Carte bancaire'
        AUTRE = 'AUTRE', 'Autre'

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_ATTENTE)

    # Réception du versement
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_payments')
    received_at = models.DateTimeField(null=True, blank=True)

    # Notes interne (n°chèque, n°virement, etc.)
    notes = models.TextField(blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-payment_date', '-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['invoice', 'status']),
            models.Index(fields=['payment_date']),
        ]

    def __str__(self):
        return f'{self.invoice.invoice_number} — {self.amount} ({self.status})'

    def clean(self):
        from django.core.exceptions import ValidationError

        # Vérifier que montant ne dépasse pas facture
        total_existing = self.invoice.payments.exclude(pk=self.pk).aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0')

        if total_existing + self.amount > self.invoice.amount_ttc:
            raise ValidationError(
                f'Versement dépasse montant facture. Déjà payé: {total_existing}, '
                f'Versement: {self.amount}, Total facture: {self.invoice.amount_ttc}'
            )

    @property
    def is_fully_paid(self):
        """Check si facture 100% payée après ce versement."""
        total = self.invoice.payments.filter(status=self.Status.RECU).aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0')
        return (total + (self.amount if self.status == self.Status.RECU else Decimal('0'))) >= self.invoice.amount_ttc


class PaymentReceipt(LoggedModel):
    """Reçu de versement — un reçu par Payment.

    Numérotation auto: REC-{année}-{seq:05d}
    """

    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name='receipt')
    receipt_number = models.CharField(max_length=20, unique=True, editable=False)
    issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_receipts')

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']

    def __str__(self):
        return self.receipt_number

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            year = timezone.now().year
            count = PaymentReceipt.objects.filter(
                receipt_number__startswith=f'REC-{year}'
            ).count() + 1
            self.receipt_number = f'REC-{year}-{count:05d}'
        super().save(*args, **kwargs)


class FinanceSettings(models.Model):
    """Configuration Finance éditable (singleton pattern — une seule instance).

    TVA, seuils d'approbation, comptes par défaut, etc. édités via Django admin
    par le Directeur Financier."""

    vat_rate = models.DecimalField(
        max_digits=4, decimal_places=2, default=DEFAULT_VAT_RATE,
        help_text='Taux TVA appliqué par défaut aux nouvelles factures (ex: 0.18 = 18%)',
    )

    # Comptes par défaut pour écritures auto (factures, décaissements)
    default_client_account_code = models.CharField(
        max_length=20, default='411', blank=True,
        help_text='Code compte Client (ex: 411 = Clients en France)',
    )
    default_sales_account_code = models.CharField(
        max_length=20, default='706', blank=True,
        help_text='Code compte Prestations (ex: 706 = Prestations de services)',
    )
    default_vat_collected_account_code = models.CharField(
        max_length=20, default='4457', blank=True,
        help_text='Code compte TVA collectée (ex: 4457)',
    )

    # Comptes par défaut — achats/trésorerie (procurement + treasury apps).
    default_purchases_account_code = models.CharField(
        max_length=20, default='601', blank=True,
        help_text='Code compte Achats (ex: 601 = Achats de marchandises)',
    )
    default_vat_deductible_account_code = models.CharField(
        max_length=20, default='4456', blank=True,
        help_text='Code compte TVA déductible (ex: 4456)',
    )
    default_supplier_account_code = models.CharField(
        max_length=20, default='401', blank=True,
        help_text='Code compte Fournisseurs (ex: 401)',
    )
    default_cash_account_code = models.CharField(
        max_length=20, default='530', blank=True,
        help_text='Code compte Caisse physique (ex: 530)',
    )
    default_bank_account_code = models.CharField(
        max_length=20, default='512', blank=True,
        help_text='Code compte Banque (ex: 512)',
    )
    default_capital_account_code = models.CharField(
        max_length=20, default='101', blank=True,
        help_text='Code compte Capital social (ex: 101)',
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Finance Settings'

    def __str__(self):
        return 'Finance Settings (Global)'

    @classmethod
    def load(cls):
        """Get or create singleton instance."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        """Enforce singleton: always id=1."""
        self.pk = 1
        super().save(*args, **kwargs)
