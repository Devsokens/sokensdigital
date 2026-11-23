from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from core.models import AuditLog
from services.billing import create_period_invoice
from services.models import KIND_QUOTA_KEY, QUOTA_LABELS, Deliverable, ServiceOffer, ServicePeriod, Subscription
from services.permissions import (
    HasServicesAccess, can_bill, can_manage, can_read, manages_any_pole, portfolio_filter, readable_poles,
)


def _scoped(qs, user, prefix=''):
    scope = portfolio_filter(user, prefix)
    return qs.filter(scope) if scope is not None else qs
from services.serializers import (
    DeliverableSerializer, ServiceOfferSerializer, ServicePeriodSerializer, SubscriptionSerializer,
)


def _clean_http_url(value):
    """Lien http(s) uniquement (jamais javascript:/data:) — None si invalide."""
    from django.core.exceptions import ValidationError
    from django.core.validators import URLValidator
    value = (value or '').strip()
    if not value:
        return ''
    try:
        URLValidator(schemes=['http', 'https'])(value)
    except ValidationError:
        return None
    return value[:500]


def _forbidden(detail='Action réservée au responsable du pôle.'):
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


class ServiceOfferViewSet(viewsets.ModelViewSet):
    """Catalogue (grille tarifaire). Lecture : toute personne ayant accès à
    un pôle ; écriture : responsable du pôle de l'offre."""

    serializer_class = ServiceOfferSerializer
    permission_classes = [permissions.IsAuthenticated, HasServicesAccess]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = ServiceOffer.objects.filter(pole__in=readable_poles(self.request.user))
        pole = self.request.query_params.get('pole')
        if pole:
            qs = qs.filter(pole=pole)
        if self.request.query_params.get('active') == '1':
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        if not can_manage(self.request.user, serializer.validated_data.get('pole')):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Réservé au responsable du pôle.')
        serializer.save()

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        pole = serializer.validated_data.get('pole', serializer.instance.pole)
        if not (can_manage(self.request.user, serializer.instance.pole) and can_manage(self.request.user, pole)):
            raise PermissionDenied('Réservé au responsable du pôle.')
        serializer.save()


class SubscriptionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                          mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated, HasServicesAccess]

    def get_queryset(self):
        qs = Subscription.objects.select_related('client', 'offer', 'quote', 'maintained_app', 'account_manager').filter(
            offer__pole__in=readable_poles(self.request.user),
        )
        qs = _scoped(qs, self.request.user)
        params = self.request.query_params
        if params.get('pole'):
            qs = qs.filter(offer__pole=params['pole'])
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('client'):
            qs = qs.filter(client_id=params['client'])
        if params.get('maintained_app'):
            qs = qs.filter(maintained_app_id=params['maintained_app'])
        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        offer = serializer.validated_data['offer']
        if not can_manage(self.request.user, offer.pole):
            raise PermissionDenied('Réservé au responsable du pôle.')
        sub = serializer.save(created_by=self.request.user)
        AuditLog.objects.log_action(self.request.user, 'ABONNEMENT_CREE', 'Subscription', sub.pk,
                                    details={'offer': offer.code, 'client': str(sub.client_id)})

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        sub = serializer.instance
        offer = serializer.validated_data.get('offer', sub.offer)
        if not (can_manage(self.request.user, sub.offer.pole) and can_manage(self.request.user, offer.pole)):
            raise PermissionDenied('Réservé au responsable du pôle.')
        before = sub.status
        sub = serializer.save()
        if sub.status != before:
            AuditLog.objects.log_action(self.request.user, 'ABONNEMENT_STATUT', 'Subscription', sub.pk,
                                        details={'from': before, 'to': sub.status})

    def destroy(self, request, *args, **kwargs):
        """Suppression définitive : Super-Admin uniquement, quel que soit le
        pôle. Supprime les périodes et livrables ; les factures émises sont
        conservées (pièces comptables), seul leur lien à la période disparaît."""
        from core.constants import ROLE_SUPER_ADMIN
        from core.permissions import has_role
        sub = self.get_object()
        if not has_role(request.user, ROLE_SUPER_ADMIN):
            return _forbidden("Seul un Super-Administrateur peut supprimer un abonnement.")
        invoices = [p.invoice.invoice_number for p in sub.periods.select_related('invoice') if p.invoice_id]
        AuditLog.objects.log_action(
            request.user, 'ABONNEMENT_SUPPRIME', 'Subscription', sub.pk,
            details={'client': sub.client.company_name, 'offer': sub.offer.code, 'pole': sub.offer.pole,
                     'periods': sub.periods.count(), 'invoices_kept': invoices},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        with transaction.atomic():
            for period in sub.periods.all():
                period.deliverables.all().delete()
            sub.periods.all().delete()
            sub.delete(user=request.user, ip_address=request.META.get('REMOTE_ADDR'))
        from services.activation import _invalidate_dashboard
        _invalidate_dashboard()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def periods(self, request, pk=None):
        sub = self.get_object()
        qs = sub.periods.select_related('invoice').prefetch_related('deliverables__assigned_to')
        return Response(ServicePeriodSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], url_path='generate-invoice')
    def generate_invoice(self, request, pk=None):
        """Facture de la période suivante (brouillon, à valider par la
        comptabilité). Responsable du pôle, Comptable, Super-Admin."""
        sub = self.get_object()
        if not can_bill(request.user, sub.offer.pole):
            return _forbidden()
        try:
            period = create_period_invoice(sub, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        AuditLog.objects.log_action(request.user, 'ABONNEMENT_FACTURE', 'Subscription', sub.pk,
                                    details={'period': str(period.pk), 'invoice': period.invoice.invoice_number})
        return Response(ServicePeriodSerializer(period).data, status=status.HTTP_201_CREATED)


class ServicePeriodViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ServicePeriodSerializer
    permission_classes = [permissions.IsAuthenticated, HasServicesAccess]

    def get_queryset(self):
        qs = ServicePeriod.objects.select_related('subscription__offer', 'invoice').filter(
            subscription__offer__pole__in=readable_poles(self.request.user),
        )
        return _scoped(qs, self.request.user, 'subscription__')

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Clôture : rapport obligatoire (lien ou compte rendu), réunion
        obligatoire si l'offre l'exige. `carry_over` = report exceptionnel
        {clé: quantité} vers la période suivante, avec `carry_reason`."""
        with transaction.atomic():
            period = ServicePeriod.objects.select_for_update().select_related('subscription__offer').get(
                pk=self.get_object().pk,
            )
            offer = period.subscription.offer
            if not can_manage(request.user, offer.pole):
                return _forbidden()
            if period.status != ServicePeriod.Status.OUVERT:
                return Response({'detail': 'Seule une période ouverte peut être clôturée.'}, status=status.HTTP_400_BAD_REQUEST)
            report_url = _clean_http_url(request.data.get('report_url'))
            if report_url is None:
                return Response({'detail': 'Lien du rapport invalide (http ou https).'}, status=status.HTTP_400_BAD_REQUEST)
            report_notes = (request.data.get('report_notes') or '').strip()
            if not report_url and not report_notes:
                return Response({'detail': 'Le rapport mensuel est obligatoire (lien ou compte rendu).'},
                                status=status.HTTP_400_BAD_REQUEST)
            meeting_held = bool(request.data.get('meeting_held'))
            if offer.requires_meeting and not meeting_held:
                return Response({'detail': 'Cette formule prévoit une réunion de restitution : confirmez qu’elle a eu lieu.'},
                                status=status.HTTP_400_BAD_REQUEST)

            carry = request.data.get('carry_over') or {}
            carried = {}
            if carry:
                reason = (request.data.get('carry_reason') or '').strip()
                if not reason:
                    return Response({'detail': 'Un report exceptionnel doit être motivé.'}, status=status.HTTP_400_BAD_REQUEST)
                remaining = period.remaining()
                for key, qty in carry.items():
                    try:
                        qty = Decimal(str(qty))
                    except Exception:  # noqa: BLE001
                        return Response({'detail': f'Quantité invalide pour « {key} ».'}, status=status.HTTP_400_BAD_REQUEST)
                    if qty <= 0:
                        continue
                    if key not in remaining or qty > remaining[key]:
                        return Response({'detail': f'Report impossible : il reste {remaining.get(key, 0)} {QUOTA_LABELS.get(key, key)}.'},
                                        status=status.HTTP_400_BAD_REQUEST)
                    carried[key] = float(qty)
                if carried:
                    period.carry_over = {
                        'carried': carried, 'reason': reason, 'by': str(request.user.pk), 'at': timezone.now().isoformat(),
                    }

            period.report_url = report_url
            period.report_notes = report_notes
            period.meeting_held = meeting_held
            period.status = ServicePeriod.Status.CLOTURE
            period.closed_at = timezone.now()
            period.closed_by = request.user
            period.save()
            if carried:
                # Mois suivant déjà payé et ouvert (facturé avant la clôture) :
                # ses quotas sont figés, on y ajoute le report maintenant.
                # Sinon opening_quotas l'ajoutera à son ouverture.
                nxt = (ServicePeriod.objects.select_for_update()
                       .filter(subscription=period.subscription, period_start__gt=period.period_start)
                       .order_by('period_start').first())
                if nxt and nxt.status == ServicePeriod.Status.OUVERT:
                    quotas = dict(nxt.quotas_alloues or {})
                    for key, extra in carried.items():
                        quotas[key] = float(Decimal(str(quotas.get(key, 0))) + Decimal(str(extra)))
                    nxt.quotas_alloues = quotas
                    nxt.save(update_fields=['quotas_alloues'])
        if carried:
            AuditLog.objects.log_action(request.user, 'QUOTA_REPORTE', 'ServicePeriod', period.pk,
                                        details=period.carry_over)
        AuditLog.objects.log_action(request.user, 'PERIODE_CLOTUREE', 'ServicePeriod', period.pk,
                                    details={'consumed': {k: float(v) for k, v in period.consumed().items()}})
        return Response(ServicePeriodSerializer(period).data)


class DeliverableViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverableSerializer
    permission_classes = [permissions.IsAuthenticated, HasServicesAccess]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        poles = readable_poles(self.request.user)
        # Prestations ponctuelles (sans période, donc sans pôle) : responsables seulement.
        cond = Q(period__subscription__offer__pole__in=poles)
        if manages_any_pole(self.request.user):
            cond |= Q(period__isnull=True)
        qs = _scoped(Deliverable.objects.select_related('period__subscription__offer', 'assigned_to').filter(cond),
                     self.request.user, 'period__subscription__')
        if self.request.query_params.get('period'):
            qs = qs.filter(period_id=self.request.query_params['period'])
        return qs

    def _pole_of(self, deliverable_or_period):
        period = getattr(deliverable_or_period, 'period', deliverable_or_period)
        return period.subscription.offer.pole if period else None

    def _check_manage(self, period):
        from rest_framework.exceptions import PermissionDenied
        pole = period.subscription.offer.pole if period else None
        allowed = can_manage(self.request.user, pole) if pole else any(
            can_manage(self.request.user, p) for p in ('COMMUNICATION', 'MAINTENANCE')
        )
        if not allowed:
            raise PermissionDenied('Réservé au responsable du pôle.')

    def perform_create(self, serializer):
        self._check_manage(serializer.validated_data.get('period'))
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        self._check_manage(serializer.instance.period)
        if 'period' in serializer.validated_data:
            self._check_manage(serializer.validated_data['period'])
        if serializer.instance.status in Deliverable.CONSUMING_STATUSES:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Livrable publié ou livré : il ne peut plus être modifié.')
        serializer.save()

    def perform_destroy(self, instance):
        self._check_manage(instance.period)
        if instance.status in Deliverable.CONSUMING_STATUSES:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Livrable publié ou livré : il ne peut plus être supprimé.')
        instance.delete(user=self.request.user)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        """Avance le livrable dans son circuit de validation. Le passage à
        PUBLIE / LIVRE consomme le quota de la période et est refusé s'il ne
        reste pas assez de quota (demande hors formule = nouveau devis)."""
        target = request.data.get('status')
        with transaction.atomic():
            deliverable = Deliverable.objects.select_for_update().select_related('period__subscription__offer').get(
                pk=self.get_object().pk,
            )
            self._check_manage(deliverable.period)
            # Étape finale propre au pôle : Communication publie (après
            # validation client), Maintenance livre. Pas de saut d'étape.
            pole = self._pole_of(deliverable)
            forbidden_final = {'COMMUNICATION': 'LIVRE', 'MAINTENANCE': 'PUBLIE'}.get(pole)
            if target not in Deliverable.TRANSITIONS.get(deliverable.status, set()) or target == forbidden_final:
                return Response({'detail': f'Transition impossible : {deliverable.status} → {target}.'},
                                status=status.HTTP_400_BAD_REQUEST)
            period = deliverable.period
            if target in Deliverable.CONSUMING_STATUSES and period:
                period = ServicePeriod.objects.select_for_update().get(pk=period.pk)
                if period.status != ServicePeriod.Status.OUVERT:
                    return Response({'detail': 'La période n’est pas ouverte.'}, status=status.HTTP_400_BAD_REQUEST)
                key = KIND_QUOTA_KEY.get(deliverable.kind)
                # Communication : un type absent de la formule (vidéo sur
                # Essentiel…) vaut quota 0 — hors formule = devis complémentaire.
                enforce = key and (key in (period.quotas_alloues or {})
                                   or deliverable.period.subscription.offer.pole == 'COMMUNICATION')
                if enforce:
                    left = period.remaining().get(key, Decimal('0'))
                    if deliverable.quantity > left:
                        return Response({
                            'detail': f'Quota épuisé : il reste {left} {QUOTA_LABELS[key]} ce mois-ci. '
                                      'Toute demande hors formule passe par un devis complémentaire.',
                            'code': 'quota_exceeded',
                        }, status=status.HTTP_400_BAD_REQUEST)
            deliverable.status = target
            if target in Deliverable.CONSUMING_STATUSES:
                deliverable.published_at = timezone.now()
                proof = _clean_http_url(request.data.get('proof_url'))
                if proof is None:
                    return Response({'detail': 'Lien de preuve invalide (http ou https).'}, status=status.HTTP_400_BAD_REQUEST)
                if proof:
                    deliverable.proof_url = proof
            deliverable.save()
        return Response(DeliverableSerializer(deliverable).data)


def build_dashboard(user, poles=None):
    today = timezone.now().date()
    poles = [p for p in (poles or readable_poles(user)) if can_read(user, p)]
    subs = _scoped(Subscription.objects.filter(offer__pole__in=poles).select_related('offer', 'client'), user)
    active = subs.filter(status=Subscription.Status.ACTIVE)

    mrr = {}
    for sub in active:
        monthly = sub.price_ttc() / (12 if sub.offer.kind == ServiceOffer.Kind.ANNUEL else 1)
        mrr[sub.offer.pole] = mrr.get(sub.offer.pole, Decimal('0')) + monthly

    periods = ServicePeriod.objects.filter(subscription__in=subs).select_related('subscription__client', 'subscription__offer', 'invoice')

    def row(p, **extra):
        return {
            'period': str(p.pk), 'subscription': str(p.subscription_id), 'client': p.subscription.client.company_name,
            'offer': p.subscription.offer.name, 'pole': p.subscription.offer.pole,
            'period_start': p.period_start, 'period_end': p.period_end, **extra,
        }

    unpaid = [
        row(p, invoice_number=p.invoice.invoice_number if p.invoice_id else None)
        for p in periods.filter(status=ServicePeriod.Status.EN_ATTENTE_PAIEMENT, period_start__lte=today)
    ]
    open_periods = list(periods.filter(status=ServicePeriod.Status.OUVERT))
    consumption, pace_alerts, unclosed = [], [], []
    for p in open_periods:
        quotas = {k: Decimal(str(v)) for k, v in (p.quotas_alloues or {}).items() if k in QUOTA_LABELS}
        used = p.consumed()
        total = sum(quotas.values(), Decimal('0'))
        done = sum((min(used.get(k, Decimal('0')), v) for k, v in quotas.items()), Decimal('0'))
        ratio = float(done / total) if total else None
        span = (p.period_end - p.period_start).days + 1
        elapsed = float(max(0, min(span, (today - p.period_start).days + 1)) / span)
        item = row(p, ratio=ratio, elapsed=round(elapsed, 2),
                   quotas={k: float(v) for k, v in quotas.items()}, consumed={k: float(v) for k, v in used.items()})
        consumption.append(item)
        # Rythme : passé la moitié de la période, moins de 40 % produit.
        if ratio is not None and elapsed >= 0.5 and ratio < 0.4:
            pace_alerts.append(item)
        if p.period_end < today:
            unclosed.append(item)

    renewals = []
    for sub in active.filter(offer__kind=ServiceOffer.Kind.ANNUEL):
        last = sub.periods.order_by('-period_end').first()
        if last and (last.period_end - today).days <= 30:
            renewals.append({'subscription': str(sub.pk), 'client': sub.client.company_name, 'offer': sub.offer.name,
                             'period_end': last.period_end})

    sla_overdue = []
    if 'MAINTENANCE' in poles:
        from technique.models import Ticket, TicketStatus
        now = timezone.now()
        for sub in active.filter(offer__pole='MAINTENANCE', offer__response_sla_hours__isnull=False):
            limit = now - timedelta(hours=sub.offer.response_sla_hours)
            for t in Ticket.objects.filter(client_id=sub.client_id, status=TicketStatus.NOUVEAU, created_at__lt=limit):
                sla_overdue.append({'ticket': str(t.pk), 'title': t.title, 'client': sub.client.company_name,
                                    'sla_hours': sub.offer.response_sla_hours, 'created_at': t.created_at})

    return {
        'active_count': active.count(),
        'mrr': {k: str(v.quantize(Decimal('1'))) for k, v in mrr.items()},
        'unpaid_started': unpaid,
        'consumption': consumption,
        'pace_alerts': pace_alerts,
        'unclosed_overdue': unclosed,
        'renewals_due': renewals,
        'sla_overdue': sla_overdue,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasServicesAccess])
def services_dashboard(request):
    pole = request.query_params.get('pole')
    return Response(build_dashboard(request.user, [pole] if pole else None))
