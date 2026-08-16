from celery import shared_task
from django.utils import timezone
from django.shortcuts import get_object_or_404
from decimal import Decimal
import logging

from treasury.models import CashEntry, BankEntry, CapitalContribution
from finance.models import JournalEntry, TransactionLine, FinanceSettings, AccountingPeriod
from core.utils import safe_dispatch

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def post_cash_entry_journal_entry(self, cash_entry_id):
    """
    Post JournalEntry quand CashEntry reconcilée.

    Mappings:
    - ENTREE CLIENT_ESPECES → Débit Caisse (530) / Crédit Client (411)
    - ENTREE RETRAIT_BANQUE → Débit Caisse (530) / Crédit Banque (512)
    - SORTIE DEPOT_BANQUE → Débit Banque (512) / Crédit Caisse (530)
    - SORTIE DEPENSE → Débit Dépense / Crédit Caisse (530)
    """
    try:
        entry = get_object_or_404(CashEntry, id=cash_entry_id)
        if entry.reconciled_at is None:
            return

        settings = FinanceSettings.load()

        # Récupérer compte Client par défaut
        account_client = settings.default_client_account_code or '411'
        account_cash = '530'  # Caisse physique
        account_bank = '512'  # Banque

        # Période comptable courante
        try:
            period = AccountingPeriod.objects.get(status=AccountingPeriod.Status.OUVERTE)
        except AccountingPeriod.DoesNotExist:
            logger.warning(f'No open accounting period for cash entry {cash_entry_id}')
            return

        # Créer JournalEntry
        journal_code = JournalEntry.JournalCode.OPERATIONS_DIVERSES
        reference = f'CASH-{entry.reference or entry.id}'

        journal_entry = JournalEntry.objects.create(
            period=period,
            journal_code=journal_code,
            date=entry.date,
            label=f'Mouvement caisse: {entry.get_source_display()}',
        )

        if entry.type == CashEntry.Type.ENTREE:
            if entry.source == CashEntry.Source.CLIENT_ESPECES:
                # Débit Caisse / Crédit Client
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_cash,
                    account_name='Caisse physique',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description=f'Entrée caisse client espèces'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_client,
                    account_name='Clients',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description=f'Paiement client espèces'
                )
            elif entry.source == CashEntry.Source.RETRAIT_BANQUE:
                # Débit Caisse / Crédit Banque
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_cash,
                    account_name='Caisse physique',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description='Retrait espèces banque'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_bank,
                    account_name='Compte bancaire',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description='Retrait compte bancaire'
                )
        else:  # SORTIE
            if entry.source == CashEntry.Source.DEPOT_BANQUE:
                # Débit Banque / Crédit Caisse
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_bank,
                    account_name='Compte bancaire',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description='Dépôt espèces caisse'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_cash,
                    account_name='Caisse physique',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description='Dépôt à la banque'
                )

        logger.info(f'✓ JournalEntry créé pour CashEntry {cash_entry_id}: {journal_entry.id}')

    except Exception as exc:
        logger.error(f'✗ post_cash_entry_journal_entry error: {exc}')
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def post_bank_entry_journal_entry(self, bank_entry_id):
    """
    Post JournalEntry quand BankEntry reconcilée.

    Mappings:
    - ENTREE CAPITAL → Débit Banque (512) / Crédit Capital (101)
    - ENTREE CLIENT_CHEQUE/VIREMENT → Débit Banque (512) / Crédit Client (411)
    - ENTREE CAISSE_DEPOT → Débit Banque (512) / Crédit Caisse (530)
    - SORTIE FOURNISSEUR_CHEQUE/VIREMENT → Débit Fournisseur (401) / Crédit Banque (512)
    - SORTIE RETRAIT_ESPECES → Débit Caisse (530) / Crédit Banque (512)
    """
    try:
        entry = get_object_or_404(BankEntry, id=bank_entry_id)
        if entry.reconciled_at is None:
            return

        settings = FinanceSettings.load()
        account_client = settings.default_client_account_code or '411'
        account_supplier = '401'  # Fournisseurs
        account_bank = '512'
        account_cash = '530'
        account_capital = '101'

        # Période comptable
        try:
            period = AccountingPeriod.objects.get(status=AccountingPeriod.Status.OUVERTE)
        except AccountingPeriod.DoesNotExist:
            logger.warning(f'No open accounting period for bank entry {bank_entry_id}')
            return

        journal_code = JournalEntry.JournalCode.BANQUE
        reference = f'BANK-{entry.reference or entry.id}'

        journal_entry = JournalEntry.objects.create(
            period=period,
            journal_code=journal_code,
            date=entry.date,
            label=f'Mouvement banque: {entry.get_source_display()}',
        )

        if entry.type == BankEntry.Type.ENTREE:
            if entry.source == BankEntry.Source.CAPITAL_CONTRIBUTION:
                # Débit Banque / Crédit Capital
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_bank,
                    account_name='Compte bancaire',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description='Apport capital'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_capital,
                    account_name='Capital social',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description='Augmentation capital'
                )
            elif entry.source in [BankEntry.Source.CLIENT_CHEQUE, BankEntry.Source.CLIENT_VIREMENT]:
                # Débit Banque / Crédit Client
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_bank,
                    account_name='Compte bancaire',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description=f'Paiement client {entry.source}'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_client,
                    account_name='Clients',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description=f'Paiement reçu'
                )
            elif entry.source == BankEntry.Source.CAISSE_DEPOT:
                # Débit Banque / Crédit Caisse
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_bank,
                    account_name='Compte bancaire',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description='Dépôt espèces'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_cash,
                    account_name='Caisse physique',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description='Dépôt caisse à banque'
                )
        else:  # SORTIE
            if entry.source in [BankEntry.Source.FOURNISSEUR_CHEQUE, BankEntry.Source.FOURNISSEUR_VIREMENT]:
                # Débit Fournisseur / Crédit Banque
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_supplier,
                    account_name='Fournisseurs',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description=f'Paiement fournisseur {entry.source}'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_bank,
                    account_name='Compte bancaire',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description='Paiement fournisseur'
                )
            elif entry.source == BankEntry.Source.RETRAIT_ESPECES:
                # Débit Caisse / Crédit Banque
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_cash,
                    account_name='Caisse physique',
                    debit=entry.amount,
                    credit=Decimal('0'),
                    line_description='Retrait espèces'
                )
                TransactionLine.objects.create(
                    entry=journal_entry,
                    account_code=account_bank,
                    account_name='Compte bancaire',
                    debit=Decimal('0'),
                    credit=entry.amount,
                    line_description='Retrait compte'
                )

        logger.info(f'✓ JournalEntry créé pour BankEntry {bank_entry_id}: {journal_entry.id}')

    except Exception as exc:
        logger.error(f'✗ post_bank_entry_journal_entry error: {exc}')
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def post_capital_contribution_journal_entry(self, capital_contribution_id):
    """
    Post JournalEntry quand CapitalContribution validée et enregistrée légalement.
    Débit Banque (512) / Crédit Capital (101)
    """
    try:
        contribution = get_object_or_404(CapitalContribution, id=capital_contribution_id)

        # Période comptable
        try:
            period = AccountingPeriod.objects.get(status=AccountingPeriod.Status.OUVERTE)
        except AccountingPeriod.DoesNotExist:
            logger.warning(f'No open accounting period for capital contribution {capital_contribution_id}')
            return

        account_bank = '512'
        account_capital = '101'

        journal_entry = JournalEntry.objects.create(
            period=period,
            journal_code=JournalEntry.JournalCode.OPERATIONS_DIVERSES,
            date=contribution.contribution_date,
            label=f'Augmentation capital {contribution.amount}',
        )

        # Débit Banque
        TransactionLine.objects.create(
            entry=journal_entry,
            account_code=account_bank,
            account_name='Compte bancaire',
            debit=contribution.amount,
            credit=Decimal('0'),
            line_description='Apport capital associés'
        )

        # Crédit Capital
        TransactionLine.objects.create(
            entry=journal_entry,
            account_code=account_capital,
            account_name='Capital social',
            debit=Decimal('0'),
            credit=contribution.amount,
            line_description='Augmentation capital'
        )

        contribution.status = CapitalContribution.Status.COMPTABILISEE
        contribution.posted_at = timezone.now()
        contribution.save()

        logger.info(f'✓ JournalEntry créé pour CapitalContribution {capital_contribution_id}: {journal_entry.id}')

    except Exception as exc:
        logger.error(f'✗ post_capital_contribution_journal_entry error: {exc}')
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
