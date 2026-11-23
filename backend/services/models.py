"""Abonnements de services (communication digitale, maintenance &
hébergement) adossés aux modules Devis / Facture / Paiement existants.

Cycle : un abonnement produit des périodes (mois, ou année pour
l'hébergement). Chaque période a SA facture ; le quota de la période
s'ouvre quand cette facture est entièrement payée (voir
services.activation). Les livrables consomment le quota à leur publication
(ou livraison), jamais avant. Clôture avec rapport obligatoire ; les quotas
non consommés sont perdus, sauf report manuel tracé dans l'audit."""
from datetime import date, timedelta
from decimal import Decimal

from django.db import models

from core.models import LoggedModel

# Type de livrable -> clé de quota consommée. Les types absents de ce
# tableau (visuel, gestion des messages, couverture d'événement,
# intervention) sont suivis mais ne consomment pas de quota.
KIND_QUOTA_KEY = {
    'PUBLICATION': 'publications',
    'VIDEO': 'videos',
    'CAMPAGNE': 'campagnes',
    'MODIFICATION_HEURES': 'heures_modif',
}

QUOTA_LABELS = {
    'publications': 'publications',
    'videos': 'vidéos courtes',
    'campagnes': 'campagnes pub',
    'heures_modif': 'heures de modification',
}


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    # Jour borné à la fin du mois (31 janvier + 1 mois = 28/29 février).
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError(d)


class Pole(models.TextChoices):
    COMMUNICATION = 'COMMUNICATION', 'Communication digitale'
    MAINTENANCE = 'MAINTENANCE', 'Maintenance & hébergement'


class ServiceOffer(LoggedModel):
    class Kind(models.TextChoices):
        MENSUEL = 'MENSUEL', 'Abonnement mensuel'
        ANNUEL = 'ANNUEL', 'Abonnement annuel'
        PONCTUEL = 'PONCTUEL', 'Prestation ponctuelle'

    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    pole = models.CharField(max_length=20, choices=Pole.choices)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    price_ttc = models.DecimalField(max_digits=12, decimal_places=2)
    # {"publications": 12, "videos": 2, "campagnes": 1, "reseaux": 2, "heures_modif": 2}
    quotas = models.JSONField(default=dict, blank=True)
    response_sla_hours = models.PositiveIntegerField(null=True, blank=True)
    requires_meeting = models.BooleanField(default=False, help_text='Réunion de restitution obligatoire à la clôture.')
    features = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta(LoggedModel.Meta):
        ordering = ['pole', 'sort_order', 'name']

    def __str__(self):
        return self.name


class Subscription(LoggedModel):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Actif'
        SUSPENDU = 'SUSPENDU', 'Suspendu'
        RESILIE = 'RESILIE', 'Résilié'

    client = models.ForeignKey('administration.Client', on_delete=models.PROTECT, related_name='subscriptions')
    offer = models.ForeignKey(ServiceOffer, on_delete=models.PROTECT, related_name='subscriptions')
    quote = models.ForeignKey('marketing.Quote', on_delete=models.SET_NULL, null=True, blank=True, related_name='subscriptions')
    contract = models.ForeignKey(
        'marketing.ServiceContract', on_delete=models.SET_NULL, null=True, blank=True, related_name='subscriptions',
    )
    maintained_app = models.ForeignKey(
        'technique.MaintainedApp', on_delete=models.SET_NULL, null=True, blank=True, related_name='subscriptions',
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    start_date = models.DateField()
    networks = models.JSONField(default=list, blank=True)
    # Surcharge éventuelle des quotas de l'offre (formule réajustée par devis).
    custom_quotas = models.JSONField(default=dict, blank=True)
    custom_price_ttc = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    account_manager = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_subscriptions',
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.offer} — {self.client}'

    @property
    def pole(self):
        return self.offer.pole

    def admin_link(self):
        base = '/admin/marketing/abonnements' if self.offer.pole == Pole.COMMUNICATION else '/admin/technique/abonnements'
        return f'{base}/{self.pk}'

    def price_ttc(self) -> Decimal:
        return self.custom_price_ttc if self.custom_price_ttc is not None else self.offer.price_ttc

    def base_quotas(self) -> dict:
        quotas = dict(self.offer.quotas or {})
        quotas.update(self.custom_quotas or {})
        return quotas

    def next_period_bounds(self):
        last = self.periods.order_by('-period_start').first()
        start = last.period_end + timedelta(days=1) if last else self.start_date
        months = 12 if self.offer.kind == ServiceOffer.Kind.ANNUEL else 1
        return start, add_months(start, months) - timedelta(days=1)


class ServicePeriod(LoggedModel):
    class Status(models.TextChoices):
        EN_ATTENTE_PAIEMENT = 'EN_ATTENTE_PAIEMENT', 'En attente de paiement'
        OUVERT = 'OUVERT', 'Ouvert'
        CLOTURE = 'CLOTURE', 'Clôturé'

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='periods')
    period_start = models.DateField()
    period_end = models.DateField()
    invoice = models.OneToOneField(
        'finance.Invoice', on_delete=models.PROTECT, null=True, blank=True, related_name='service_period',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_ATTENTE_PAIEMENT)
    quotas_alloues = models.JSONField(default=dict, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    # Report exceptionnel vers la période suivante : {"carried": {...}, "reason", "by", "at"}
    carry_over = models.JSONField(default=dict, blank=True)
    report_url = models.URLField(max_length=500, blank=True)
    report_notes = models.TextField(blank=True)
    meeting_held = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta(LoggedModel.Meta):
        ordering = ['-period_start']
        constraints = [
            models.UniqueConstraint(fields=['subscription', 'period_start'], name='unique_service_period_start'),
        ]

    def __str__(self):
        return f'{self.subscription} — {self.period_start:%m/%Y}'

    def consumed(self) -> dict:
        totals = {}
        for d in self.deliverables.filter(status__in=Deliverable.CONSUMING_STATUSES):
            key = KIND_QUOTA_KEY.get(d.kind)
            if key:
                totals[key] = totals.get(key, Decimal('0')) + d.quantity
        return totals

    def remaining(self) -> dict:
        used = self.consumed()
        return {
            key: Decimal(str(total)) - used.get(key, Decimal('0'))
            for key, total in (self.quotas_alloues or {}).items()
            if key in QUOTA_LABELS
        }


class Deliverable(LoggedModel):
    class Kind(models.TextChoices):
        PUBLICATION = 'PUBLICATION', 'Publication'
        VIDEO = 'VIDEO', 'Vidéo courte (≤ 60 s)'
        CAMPAGNE = 'CAMPAGNE', 'Campagne sponsorisée'
        VISUEL = 'VISUEL', 'Visuel'
        MESSAGES = 'MESSAGES', 'Gestion des messages'
        EVENEMENT = 'EVENEMENT', "Couverture d'événement"
        MODIFICATION_HEURES = 'MODIFICATION_HEURES', 'Heures de modification'
        INTERVENTION = 'INTERVENTION', 'Intervention de maintenance'

    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        CONTROLE_INTERNE = 'CONTROLE_INTERNE', 'Contrôle interne'
        VALIDE_CLIENT = 'VALIDE_CLIENT', 'Validé client'
        PUBLIE = 'PUBLIE', 'Publié'
        LIVRE = 'LIVRE', 'Livré'

    CONSUMING_STATUSES = ('PUBLIE', 'LIVRE')
    # Transitions autorisées : on avance d'un cran, ou on revient en brouillon
    # (refus au contrôle ou par le client). Publié/livré est définitif.
    TRANSITIONS = {
        'BROUILLON': {'CONTROLE_INTERNE'},
        'CONTROLE_INTERNE': {'VALIDE_CLIENT', 'BROUILLON', 'LIVRE'},
        'VALIDE_CLIENT': {'PUBLIE', 'LIVRE', 'BROUILLON'},
        'PUBLIE': set(),
        'LIVRE': set(),
    }

    period = models.ForeignKey(ServicePeriod, on_delete=models.CASCADE, null=True, blank=True, related_name='deliverables')
    # Prestation ponctuelle (hors abonnement) : rattachée à sa facture.
    ponctual_invoice = models.ForeignKey(
        'finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='service_deliverables',
    )
    kind = models.CharField(max_length=25, choices=Kind.choices)
    quantity = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('1'))
    title = models.CharField(max_length=255)
    network = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.BROUILLON)
    assigned_to = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='service_deliverables')
    published_at = models.DateTimeField(null=True, blank=True)
    proof_url = models.URLField(max_length=500, blank=True)
    task = models.ForeignKey('projects.ProjectTask', on_delete=models.SET_NULL, null=True, blank=True, related_name='service_deliverables')
    ticket = models.ForeignKey('technique.Ticket', on_delete=models.SET_NULL, null=True, blank=True, related_name='service_deliverables')
    created_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']

    def __str__(self):
        return self.title
