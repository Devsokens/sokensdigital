import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

from core.models import LoggedModel, User, DocumentAttachment
from finance.models import Payment, DisbursementRequest


class CashEntry(LoggedModel):
    """Pièce d'entrée/sortie caisse physique.

    Tracks mouvements trésorerie caisse:
    - ENTREE: Client espèces, Retrait bancaire
    - SORTIE: Dépôt banque, Dépenses opérationnelles
    """

    class Type(models.TextChoices):
        ENTREE = 'ENTREE', 'Entrée'
        SORTIE = 'SORTIE', 'Sortie'

    class Source(models.TextChoices):
        # Entrées
        CLIENT_ESPECES = 'CLIENT_ESPECES', 'Client paie en espèces'
        RETRAIT_BANQUE = 'RETRAIT_BANQUE', 'Retrait compte bancaire'
        # Sorties
        DEPOT_BANQUE = 'DEPOT_BANQUE', 'Dépôt espèces → banque'
        DEPENSE_OPERATIONNELLE = 'DEPENSE_OPERATIONNELLE', 'Dépense opérationnelle'
        FOURNISSEUR_ESPECES = 'FOURNISSEUR_ESPECES', 'Paiement fournisseur en espèces'

    # Numéro de pièce auto-généré (PC-YYYY-00001) — unifie l'ancien
    # procurement.CashVoucher (fusionné ici, cf. audit AUDIT_LOGIQUE_METIER_
    # TRESORERIE_2026-08.md §H3) et le nouveau treasury.CashEntry : un seul
    # modèle, un seul solde de caisse, un seul état de caisse mensuel fiable.
    voucher_number = models.CharField(max_length=20, unique=True, editable=False, blank=True)

    type = models.CharField(max_length=10, choices=Type.choices)
    source = models.CharField(max_length=30, choices=Source.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(default=timezone.now)
    reference = models.CharField(max_length=255, blank=True, help_text='N° pièce caisse, etc.')
    description = models.TextField(blank=True)

    # Liens
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_entries')
    disbursement = models.ForeignKey(DisbursementRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_entries')
    # Facture fournisseur réglée en espèces (procurement app) — string ref
    # pour éviter toute dépendance d'import circulaire entre les deux apps.
    supplier_invoice = models.ForeignKey('procurement.SupplierInvoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_entries')

    # Audit
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_cash_entries')
    reconciled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reconciled_cash_entries')
    reconciled_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-date', '-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['type', 'source']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f'{self.voucher_number} — {self.type} {self.source} ({self.amount})'

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({'amount': 'Montant doit être positif'})

    def save(self, *args, **kwargs):
        if not self.voucher_number:
            year = timezone.now().year
            count = CashEntry.objects.filter(voucher_number__startswith=f'PC-{year}').count() + 1
            self.voucher_number = f'PC-{year}-{count:05d}'
        super().save(*args, **kwargs)


class BankEntry(LoggedModel):
    """Entrée/sortie compte bancaire.

    Tracks mouvements banque:
    - ENTREE: Apport capital, Paiement client chèque/virement, Dépôt caisse
    - SORTIE: Paiement fournisseur, Retrait espèces
    """

    class Type(models.TextChoices):
        ENTREE = 'ENTREE', 'Crédit'
        SORTIE = 'SORTIE', 'Débit'

    class Source(models.TextChoices):
        # Entrées
        APPORT_CAPITAL = 'APPORT_CAPITAL', 'Apport capital'
        CLIENT_CHEQUE = 'CLIENT_CHEQUE', 'Client paie chèque'
        CLIENT_VIREMENT = 'CLIENT_VIREMENT', 'Client paie virement'
        CAISSE_DEPOT = 'CAISSE_DEPOT', 'Dépôt espèces caisse'
        # Sorties
        FOURNISSEUR_CHEQUE = 'FOURNISSEUR_CHEQUE', 'Paiement fournisseur chèque'
        FOURNISSEUR_VIREMENT = 'FOURNISSEUR_VIREMENT', 'Paiement fournisseur virement'
        RETRAIT_ESPECES = 'RETRAIT_ESPECES', 'Retrait espèces'
        # Fourre-tout pour les mouvements qui ne rentrent dans aucune des
        # catégories ci-dessus (frais bancaires, intérêts, régularisation...).
        # Volontairement SANS mapping comptable auto dans treasury/tasks.py :
        # le comptable saisit l'écriture à la main au Grand Livre, plutôt que
        # de deviner un compte de contrepartie qui serait faux une fois sur deux.
        AUTRE = 'AUTRE', 'Autre'

    type = models.CharField(max_length=10, choices=Type.choices)
    source = models.CharField(max_length=30, choices=Source.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(default=timezone.now)
    reference = models.CharField(max_length=255, help_text='N° chèque, N° virement, etc.')
    description = models.TextField(blank=True)

    # Liens
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_entries')
    capital_contribution = models.ForeignKey('CapitalContribution', on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_entries')
    disbursement = models.ForeignKey(DisbursementRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_entries')
    cash_entry = models.ForeignKey(CashEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_entries')

    # Rapprochement bancaire
    bank_transaction = models.OneToOneField('finance.BankTransaction', on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_entry')

    # Audit
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_bank_entries')
    reconciled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reconciled_bank_entries')
    reconciled_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-date', '-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['type', 'source']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f'{self.type} {self.source} — {self.amount} ({self.date})'

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({'amount': 'Montant doit être positif'})


class CapitalContribution(LoggedModel):
    """Augmentation capital — apports en numéraire des associés."""

    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        DOCUMENTS_TRANSMIS = 'DOCUMENTS_TRANSMIS', 'Documents transmis'
        VALIDEE = 'VALIDEE', 'Validée (Finance)'
        ENREGISTREE = 'ENREGISTREE', 'Enregistrée légalement'
        COMPTABILISEE = 'COMPTABILISEE', 'Comptabilisée'

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.BROUILLON)
    contribution_date = models.DateField(default=timezone.now, help_text='Date préévue apport')

    # Justificatifs (via DocumentAttachment GenericForeignKey)
    # - Procès-verbal AGE
    # - Attestation dépôt banque
    # - Statuts mis à jour
    # - Annonce légale publication

    # Liens
    bank_entry = models.OneToOneField(BankEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='linked_capital_contribution')

    # Validation
    validated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_capital_contributions')
    validated_at = models.DateTimeField(null=True, blank=True)

    # Comptabilité
    posted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_capital_contributions')
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-contribution_date']

    def __str__(self):
        return f'Apport capital {self.amount} ({self.status})'

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({'amount': 'Montant doit être positif'})
