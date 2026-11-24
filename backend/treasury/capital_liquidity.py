"""Conversion d'apport capital en liquidité de caisse (et retour).

Le capital social (compte 101) n'est JAMAIS modifié : une conversion ne fait
que déplacer des fonds issus de l'apport vers la caisse, pour régler les
charges en espèces. Le suivi distingue :

- capital apporté : apports validés + apports bancaires directs ;
- converti : pièces de caisse ENTREE « conversion d'apport capital » ;
- retourné : pièces de caisse SORTIE « retour vers l'apport capital » ;
- disponible = apporté − converti + retourné (ce qui peut encore être converti) ;
- en caisse = converti − retourné (ce qui peut être retourné, dans la limite
  du solde réel de la caisse).

Écritures (au rapprochement de la pièce) : conversion = Débit Caisse (530) /
Crédit Banque (512) ; retour = Débit Banque (512) / Crédit Caisse (530)."""
from decimal import Decimal

from django.db.models import Q, Sum

ZERO = Decimal('0')


def _sum(qs):
    return qs.aggregate(total=Sum('amount'))['total'] or ZERO


def capital_liquidity(exclude_entry_id=None) -> dict:
    from treasury.models import BankEntry, CapitalContribution, CashEntry

    cash = CashEntry.objects.all()
    if exclude_entry_id:
        cash = cash.exclude(pk=exclude_entry_id)
    contributed = _sum(CapitalContribution.objects.filter(status__in=[
        CapitalContribution.Status.VALIDEE, CapitalContribution.Status.ENREGISTREE,
        CapitalContribution.Status.COMPTABILISEE,
    ])) + _sum(BankEntry.objects.filter(
        type=BankEntry.Type.ENTREE, source=BankEntry.Source.APPORT_CAPITAL, capital_contribution__isnull=True,
    ).filter(Q(linked_capital_contribution__isnull=True)))
    converted = _sum(cash.filter(type=CashEntry.Type.ENTREE, source=CashEntry.Source.CONVERSION_APPORT_CAPITAL))
    returned = _sum(cash.filter(type=CashEntry.Type.SORTIE, source=CashEntry.Source.RETOUR_APPORT_CAPITAL))
    cash_balance = _sum(cash.filter(type=CashEntry.Type.ENTREE)) - _sum(cash.filter(type=CashEntry.Type.SORTIE))
    return {
        'capital_contributed': contributed,
        'converted': converted,
        'returned': returned,
        'available': contributed - converted + returned,
        'in_cash': converted - returned,
        'cash_balance': cash_balance,
    }
