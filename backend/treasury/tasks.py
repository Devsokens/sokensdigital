from celery import shared_task
from django.utils import timezone
from django.shortcuts import get_object_or_404
from decimal import Decimal
import logging

from treasury.models import CashEntry, BankEntry, CapitalContribution
from finance.models import JournalEntry, Account, FinanceSettings
from finance.accounting_helpers import get_or_create_account, resolve_open_period_for_date, post_balanced_entry
from core.celery_utils import safe_dispatch

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def post_cash_entry_journal_entry(self, cash_entry_id):
    """
    Post JournalEntry quand CashEntry reconcilée.

    Mappings:
    - ENTREE CLIENT_ESPECES → Débit Caisse (530) / Crédit Client (411)
    - ENTREE RETRAIT_BANQUE → Débit Caisse (530) / Crédit Banque (512)
    - SORTIE DEPOT_BANQUE → Débit Banque (512) / Crédit Caisse (530)
    """
    try:
        entry = get_object_or_404(CashEntry, id=cash_entry_id)
        if entry.reconciled_at is None:
            return

        period = resolve_open_period_for_date(entry.date)
        if not period:
            logger.warning(f'No open accounting period for cash entry {cash_entry_id}')
            return

        settings = FinanceSettings.load()
        account_cash = get_or_create_account(settings.default_cash_account_code, 'Caisse physique', Account.AccountClass.ACTIF)
        account_bank = get_or_create_account(settings.default_bank_account_code, 'Compte bancaire', Account.AccountClass.ACTIF)

        lines = None

        if entry.type == CashEntry.Type.ENTREE:
            if entry.source == CashEntry.Source.CLIENT_ESPECES:
                account_client = get_or_create_account(settings.default_client_account_code, 'Clients', Account.AccountClass.ACTIF)
                lines = [
                    {'account': account_cash, 'label': 'Entrée caisse client espèces', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_client, 'label': 'Paiement client espèces', 'debit': Decimal('0'), 'credit': entry.amount},
                ]
            elif entry.source == CashEntry.Source.RETRAIT_BANQUE:
                lines = [
                    {'account': account_cash, 'label': 'Retrait espèces banque', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_bank, 'label': 'Retrait compte bancaire', 'debit': Decimal('0'), 'credit': entry.amount},
                ]
        else:  # SORTIE
            if entry.source == CashEntry.Source.DEPOT_BANQUE:
                lines = [
                    {'account': account_bank, 'label': 'Dépôt espèces caisse', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_cash, 'label': 'Dépôt à la banque', 'debit': Decimal('0'), 'credit': entry.amount},
                ]
            elif entry.source == CashEntry.Source.FOURNISSEUR_ESPECES:
                account_supplier = get_or_create_account(settings.default_supplier_account_code, 'Fournisseurs', Account.AccountClass.PASSIF)
                lines = [
                    {'account': account_supplier, 'label': 'Paiement fournisseur espèces', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_cash, 'label': 'Sortie caisse fournisseur', 'debit': Decimal('0'), 'credit': entry.amount},
                ]

        if not lines:
            logger.info(f'CashEntry {cash_entry_id}: source {entry.source} sans mapping comptable, rien à poster')
            return

        journal_entry = post_balanced_entry(
            period=period,
            journal_code=JournalEntry.JournalCode.OPERATIONS_DIVERSES,
            date=entry.date,
            label=f'Mouvement caisse: {entry.get_source_display()}',
            lines=lines,
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

        period = resolve_open_period_for_date(entry.date)
        if not period:
            logger.warning(f'No open accounting period for bank entry {bank_entry_id}')
            return

        settings = FinanceSettings.load()
        account_bank = get_or_create_account(settings.default_bank_account_code, 'Compte bancaire', Account.AccountClass.ACTIF)
        account_cash = get_or_create_account(settings.default_cash_account_code, 'Caisse physique', Account.AccountClass.ACTIF)

        lines = None

        if entry.type == BankEntry.Type.ENTREE:
            if entry.source == BankEntry.Source.APPORT_CAPITAL:
                account_capital = get_or_create_account(settings.default_capital_account_code, 'Capital social', Account.AccountClass.PASSIF)
                lines = [
                    {'account': account_bank, 'label': 'Apport capital', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_capital, 'label': 'Augmentation capital', 'debit': Decimal('0'), 'credit': entry.amount},
                ]
            elif entry.source in [BankEntry.Source.CLIENT_CHEQUE, BankEntry.Source.CLIENT_VIREMENT]:
                account_client = get_or_create_account(settings.default_client_account_code, 'Clients', Account.AccountClass.ACTIF)
                lines = [
                    {'account': account_bank, 'label': f'Paiement client {entry.source}', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_client, 'label': 'Paiement reçu', 'debit': Decimal('0'), 'credit': entry.amount},
                ]
            elif entry.source == BankEntry.Source.CAISSE_DEPOT:
                lines = [
                    {'account': account_bank, 'label': 'Dépôt espèces', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_cash, 'label': 'Dépôt caisse à banque', 'debit': Decimal('0'), 'credit': entry.amount},
                ]
        else:  # SORTIE
            if entry.source in [BankEntry.Source.FOURNISSEUR_CHEQUE, BankEntry.Source.FOURNISSEUR_VIREMENT]:
                account_supplier = get_or_create_account(settings.default_supplier_account_code, 'Fournisseurs', Account.AccountClass.PASSIF)
                lines = [
                    {'account': account_supplier, 'label': f'Paiement fournisseur {entry.source}', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_bank, 'label': 'Paiement fournisseur', 'debit': Decimal('0'), 'credit': entry.amount},
                ]
            elif entry.source == BankEntry.Source.RETRAIT_ESPECES:
                lines = [
                    {'account': account_cash, 'label': 'Retrait espèces', 'debit': entry.amount, 'credit': Decimal('0')},
                    {'account': account_bank, 'label': 'Retrait compte', 'debit': Decimal('0'), 'credit': entry.amount},
                ]

        if not lines:
            logger.info(f'BankEntry {bank_entry_id}: source {entry.source} sans mapping comptable, rien à poster')
            return

        journal_entry = post_balanced_entry(
            period=period,
            journal_code=JournalEntry.JournalCode.BANQUE,
            date=entry.date,
            label=f'Mouvement banque: {entry.get_source_display()}',
            lines=lines,
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

        period = resolve_open_period_for_date(contribution.contribution_date)
        if not period:
            logger.warning(f'No open accounting period for capital contribution {capital_contribution_id}')
            return

        settings = FinanceSettings.load()
        account_bank = get_or_create_account(settings.default_bank_account_code, 'Compte bancaire', Account.AccountClass.ACTIF)
        account_capital = get_or_create_account(settings.default_capital_account_code, 'Capital social', Account.AccountClass.PASSIF)

        lines = [
            {'account': account_bank, 'label': 'Apport capital associés', 'debit': contribution.amount, 'credit': Decimal('0')},
            {'account': account_capital, 'label': 'Augmentation capital', 'debit': Decimal('0'), 'credit': contribution.amount},
        ]

        journal_entry = post_balanced_entry(
            period=period,
            journal_code=JournalEntry.JournalCode.OPERATIONS_DIVERSES,
            date=contribution.contribution_date,
            label=f'Augmentation capital {contribution.amount}',
            lines=lines,
        )

        contribution.status = CapitalContribution.Status.COMPTABILISEE
        contribution.posted_at = timezone.now()
        contribution.save()

        logger.info(f'✓ JournalEntry créé pour CapitalContribution {capital_contribution_id}: {journal_entry.id}')

    except Exception as exc:
        logger.error(f'✗ post_capital_contribution_journal_entry error: {exc}')
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
