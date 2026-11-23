from rest_framework import serializers

from services.models import Deliverable, ServiceOffer, ServicePeriod, Subscription


class ServiceOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOffer
        fields = [
            'id', 'code', 'name', 'pole', 'kind', 'price_ttc', 'quotas', 'response_sla_hours',
            'requires_meeting', 'features', 'is_active', 'sort_order',
        ]

    def validate_quotas(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('Objet attendu : {"publications": 12, ...}.')
        for key, n in value.items():
            if not isinstance(n, (int, float)) or n < 0:
                raise serializers.ValidationError(f'Quota « {key} » invalide.')
        return value


class DeliverableSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Deliverable
        fields = [
            'id', 'period', 'ponctual_invoice', 'kind', 'quantity', 'title', 'network', 'status',
            'assigned_to', 'assigned_to_name', 'published_at', 'proof_url', 'task', 'ticket', 'created_at',
        ]
        # Le statut n'avance que par l'action `transition` (contrôle du quota).
        read_only_fields = ['status', 'published_at', 'created_at']

    def get_assigned_to_name(self, obj):
        u = obj.assigned_to
        return f'{u.first_name} {u.last_name}'.strip() if u else None

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('La quantité doit être positive.')
        return value

    def validate(self, attrs):
        period = attrs.get('period') or getattr(self.instance, 'period', None)
        if not period and not (attrs.get('ponctual_invoice') or getattr(self.instance, 'ponctual_invoice', None)):
            raise serializers.ValidationError('Rattachez le livrable à une période d’abonnement ou à une facture ponctuelle.')
        if period and period.status != ServicePeriod.Status.OUVERT:
            raise serializers.ValidationError(
                'Période non ouverte : la facture du mois doit être entièrement payée avant toute production.'
                if period.status == ServicePeriod.Status.EN_ATTENTE_PAIEMENT else 'Période clôturée.'
            )
        return attrs


class ServicePeriodSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True, default=None)
    invoice_status = serializers.CharField(source='invoice.status', read_only=True, default=None)
    invoice_amount_ttc = serializers.DecimalField(source='invoice.amount_ttc', max_digits=12, decimal_places=2, read_only=True, default=None)
    invoice_amount_paid = serializers.SerializerMethodField()
    consumed = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    deliverables = DeliverableSerializer(many=True, read_only=True)

    class Meta:
        model = ServicePeriod
        fields = [
            'id', 'subscription', 'period_start', 'period_end', 'status', 'invoice', 'invoice_number',
            'invoice_status', 'invoice_amount_ttc', 'invoice_amount_paid', 'quotas_alloues', 'consumed',
            'remaining', 'carry_over', 'opened_at', 'report_url', 'report_notes', 'meeting_held', 'closed_at',
            'deliverables',
        ]
        read_only_fields = fields

    def get_invoice_amount_paid(self, obj):
        return str(obj.invoice.amount_paid) if obj.invoice_id else None

    def get_consumed(self, obj):
        return {k: float(v) for k, v in obj.consumed().items()}

    def get_remaining(self, obj):
        return {k: float(v) for k, v in obj.remaining().items()}


class SubscriptionSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company_name', read_only=True)
    offer_name = serializers.CharField(source='offer.name', read_only=True)
    pole = serializers.CharField(source='offer.pole', read_only=True)
    kind = serializers.CharField(source='offer.kind', read_only=True)
    price = serializers.SerializerMethodField()
    quotas = serializers.SerializerMethodField()
    quote_number = serializers.CharField(source='quote.quote_number', read_only=True, default=None)
    maintained_app_name = serializers.CharField(source='maintained_app.name', read_only=True, default=None)
    account_manager_name = serializers.SerializerMethodField()
    current_period = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = [
            'id', 'client', 'client_name', 'offer', 'offer_name', 'pole', 'kind', 'quote', 'quote_number',
            'contract', 'maintained_app', 'maintained_app_name', 'status', 'start_date', 'networks',
            'custom_quotas', 'custom_price_ttc', 'price', 'quotas', 'account_manager', 'account_manager_name',
            'notes', 'current_period', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_price(self, obj):
        return str(obj.price_ttc())

    def get_quotas(self, obj):
        return obj.base_quotas()

    def get_account_manager_name(self, obj):
        u = obj.account_manager
        return f'{u.first_name} {u.last_name}'.strip() if u else None

    def get_current_period(self, obj):
        period = obj.periods.exclude(status=ServicePeriod.Status.CLOTURE).order_by('period_start').first()
        if not period:
            return None
        return {
            'id': str(period.id), 'status': period.status, 'period_start': period.period_start,
            'period_end': period.period_end, 'quotas_alloues': period.quotas_alloues,
            'consumed': {k: float(v) for k, v in period.consumed().items()},
        }

    def validate(self, attrs):
        client = attrs.get('client', getattr(self.instance, 'client', None))
        offer = attrs.get('offer', getattr(self.instance, 'offer', None))
        app = attrs.get('maintained_app', getattr(self.instance, 'maintained_app', None))
        quote = attrs.get('quote', getattr(self.instance, 'quote', None))
        if 'quote' in attrs and quote is not None:
            if quote.status != quote.Status.ACCEPTE:
                raise serializers.ValidationError({'quote': 'Seul un devis accepté peut ouvrir un abonnement.'})
            quote_client = getattr(quote.lead, 'client_id', None) if quote.lead_id else None
            if quote_client and client and quote_client != client.pk:
                raise serializers.ValidationError({'quote': "Ce devis appartient à un autre client."})
        status = attrs.get('status', getattr(self.instance, 'status', Subscription.Status.ACTIVE))
        if client and offer and status != Subscription.Status.RESILIE:
            dup = Subscription.objects.filter(client=client, offer=offer, maintained_app=app).exclude(
                status=Subscription.Status.RESILIE,
            )
            if self.instance:
                dup = dup.exclude(pk=self.instance.pk)
            if dup.exists():
                raise serializers.ValidationError(
                    'Ce client a déjà un abonnement en cours à cette formule'
                    + (' pour cette application.' if app else '.')
                    + ' Modifiez-le ou résiliez-le plutôt que d’en créer un second.'
                )
        return attrs

    def validate_offer(self, offer):
        if offer.kind == offer.Kind.PONCTUEL:
            raise serializers.ValidationError('Une prestation ponctuelle se facture directement, sans abonnement.')
        if not offer.is_active and (not self.instance or self.instance.offer_id != offer.pk):
            raise serializers.ValidationError('Offre désactivée.')
        return offer
