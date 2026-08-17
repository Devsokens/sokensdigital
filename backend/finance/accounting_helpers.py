"""
Helpers partagés pour poster des écritures comptables équilibrées depuis
n'importe quelle app (finance, procurement, treasury).

Existe pour éviter que chaque task réécrive à la main la résolution
Account.objects.get_or_create(code=...) + TransactionLine(account=<objet>, ...)
— le seul pattern valide pour ces deux modèles (voir finance/models.py:
TransactionLine.account est une FK vers Account, pas une string).
"""
from decimal import Decimal

from finance.models import Account, AccountingPeriod, JournalEntry, TransactionLine


def get_or_create_account(code, name, account_class):
    """Résout un compte du plan comptable simplifié, le crée s'il manque."""
    account, _ = Account.objects.get_or_create(
        code=code,
        defaults={'name': name, 'account_class': account_class},
    )
    return account


def resolve_open_period_for_date(date):
    """Période comptable ouverte qui couvre `date`.

    Aligné sur finance/views.py InvoiceViewSet.validate — filtre par date
    couverte, pas juste "la" période ouverte (il peut y en avoir plusieurs
    en même temps, rien ne l'empêche côté modèle).
    """
    return AccountingPeriod.objects.filter(
        start_date__lte=date, end_date__gte=date,
        status=AccountingPeriod.Status.OUVERTE,
    ).first()


def post_balanced_entry(period, journal_code, date, label, lines, created_by=None, source_invoice=None):
    """Crée un JournalEntry + ses TransactionLine, vérifie l'équilibre.

    `lines`: liste de dicts {account: Account, label: str, debit: Decimal, credit: Decimal}.
    Lève ValueError si la somme des débits != somme des crédits (jamais
    silencieux — une écriture déséquilibrée est un bug comptable, pas un
    cas à logger et ignorer).
    """
    total_debit = sum((line['debit'] for line in lines), Decimal('0'))
    total_credit = sum((line['credit'] for line in lines), Decimal('0'))
    if total_debit != total_credit:
        raise ValueError(
            f'Écriture déséquilibrée: débit={total_debit} crédit={total_credit} ({label})'
        )

    entry = JournalEntry.objects.create(
        period=period,
        journal_code=journal_code,
        date=date,
        label=label,
        created_by=created_by,
        source_invoice=source_invoice,
    )
    for line in lines:
        if line['debit'] or line['credit']:
            TransactionLine.objects.create(
                entry=entry,
                account=line['account'],
                label=line.get('label', ''),
                debit=line['debit'],
                credit=line['credit'],
            )
    return entry
