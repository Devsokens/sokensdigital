"""Facture d'une période d'abonnement, dans le module Facture existant.

Les prix de la grille sont TTC : on retrouve le HT avec les taux en vigueur
(TVA, CSS et autres taxes actives des paramètres Finance), puis on ajuste
au centime pour que le TTC de la facture soit exactement celui de l'offre."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

CENTS = Decimal('0.01')


def _ttc_from_ht(ht, vat, css, extras):
    total = ht + (ht * vat).quantize(CENTS) + (ht * css).quantize(CENTS)
    for pct in extras:
        total += (ht * pct / 100).quantize(CENTS)
    return total.quantize(CENTS)


def ht_for_ttc(ttc: Decimal, vat: Decimal, css: Decimal, extras) -> Decimal:
    rate = Decimal('1') + vat + css + sum((p / 100 for p in extras), Decimal('0'))
    guess = (ttc / rate).quantize(CENTS)
    for delta in range(0, 6):
        for candidate in (guess + delta * CENTS, guess - delta * CENTS):
            if _ttc_from_ht(candidate, vat, css, extras) == ttc:
                return candidate
    return guess


def create_period_invoice(subscription, user):
    """Crée la période suivante + sa facture BROUILLON. Lève ValueError si
    une période attend encore son paiement (pas deux mois impayés en
    parallèle) ou si l'abonnement n'est pas actif."""
    from finance.models import FinanceSettings, Invoice
    from services.models import ServicePeriod, Subscription

    with transaction.atomic():
        sub = Subscription.objects.select_for_update().select_related('offer', 'client').get(pk=subscription.pk)
        if sub.status != Subscription.Status.ACTIVE:
            raise ValueError("L'abonnement n'est pas actif.")
        if sub.periods.filter(status=ServicePeriod.Status.EN_ATTENTE_PAIEMENT).exists():
            raise ValueError('La facture de la période en cours n’est pas encore réglée.')
        start, end = sub.next_period_bounds()

        settings_obj = FinanceSettings.load()
        extras = [
            {'name': t['name'], 'percent': t['percent']}
            for t in (settings_obj.extra_taxes or []) if t.get('enabled')
        ]
        vat, css = Decimal(str(settings_obj.vat_rate)), Decimal(str(settings_obj.css_rate))
        ttc = Decimal(str(sub.price_ttc())).quantize(CENTS)
        ht = ht_for_ttc(ttc, vat, css, [Decimal(str(t['percent'])) for t in extras])
        label = 'Abonnement annuel' if sub.offer.kind == sub.offer.Kind.ANNUEL else 'Abonnement mensuel'
        invoice = Invoice.objects.create(
            client=sub.client,
            client_name=sub.client.company_name,
            quote=sub.quote,
            amount_ht=ht,
            vat_rate=vat,
            css_rate=css,
            extra_taxes=extras,
            lines=[{
                'description': f'{sub.offer.name} — {label} du {start:%d/%m/%Y} au {end:%d/%m/%Y}',
                'quantity': '1',
                'unit_price': str(ht),
                'note': 'Règlement en une fois, avant le début de la période.',
            }],
            issue_date=timezone.now().date(),
            due_date=start,
            created_by=user,
        )
        period = ServicePeriod.objects.create(subscription=sub, period_start=start, period_end=end, invoice=invoice)
    return period
