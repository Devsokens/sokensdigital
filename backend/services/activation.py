"""Ouverture d'une période d'abonnement au paiement complet de sa facture.

Branché sur post_save de finance.Payment (voir services.apps) : couvre tous
les chemins d'encaissement (« Marquer comme payée », versement reçu,
saisie directe) sans toucher au module Finance."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone


def opening_quotas(period) -> dict:
    """Quotas de l'offre (ou surchargés) + report exceptionnel de la période
    précédente, s'il y en a un."""
    quotas = period.subscription.base_quotas()
    previous = (
        period.subscription.periods.filter(period_start__lt=period.period_start)
        .order_by('-period_start').first()
    )
    for key, extra in ((previous.carry_over or {}).get('carried', {}) if previous else {}).items():
        quotas[key] = float(Decimal(str(quotas.get(key, 0))) + Decimal(str(extra)))
    return quotas


def on_invoice_paid(invoice) -> bool:
    """Ouvre la période liée à la facture si elle est entièrement payée.
    Idempotent : ne fait rien si la période est déjà ouverte ou close."""
    from services.models import ServicePeriod

    period = ServicePeriod.objects.filter(invoice=invoice).select_related('subscription__offer').first()
    if not period or period.status != ServicePeriod.Status.EN_ATTENTE_PAIEMENT:
        return False
    # Défense en profondeur : seule une facture validée (écriture passée)
    # et entièrement payée ouvre la période.
    if invoice.status != invoice.Status.VALIDEE or invoice.amount_paid < invoice.amount_ttc:
        return False
    with transaction.atomic():
        locked = ServicePeriod.objects.select_for_update().get(pk=period.pk)
        if locked.status != ServicePeriod.Status.EN_ATTENTE_PAIEMENT:
            return False
        locked.quotas_alloues = opening_quotas(locked)
        locked.status = ServicePeriod.Status.OUVERT
        locked.opened_at = timezone.now()
        locked.save(update_fields=['quotas_alloues', 'status', 'opened_at'])
    _invalidate_dashboard()
    _notify_opening(locked)
    return True


def _invalidate_dashboard():
    from django.core.cache import cache
    from core.views import GLOBAL_DASHBOARD_CACHE_KEY
    cache.delete(GLOBAL_DASHBOARD_CACHE_KEY)


def _notify_opening(period):
    from core.notifications import notify, notify_roles
    from services.permissions import pole_roles

    sub = period.subscription
    title = 'Abonnement : période ouverte'
    message = f'{sub.offer.name} — {sub.client} : facture payée, production du {period.period_start:%d/%m/%Y} ouverte.'
    link = sub.admin_link()
    try:
        if sub.account_manager_id:
            notify(sub.account_manager, title=title, message=message, notification_type='GENERAL', link=link)
        notify_roles(pole_roles(sub.offer.pole), title=title, message=message, notification_type='GENERAL',
                     link=link, exclude=sub.account_manager)
    except Exception:  # noqa: BLE001 — une notification ne doit jamais bloquer un encaissement
        pass
