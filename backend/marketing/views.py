from decimal import Decimal

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import has_role
from marketing.models import BlogPost, Lead, PageSection, Quote, QuoteLine, SocialPost
from marketing.ratelimit import get_client_ip, is_rate_limited
from marketing.serializers import (
    BlogPostPublicSerializer,
    BlogPostSerializer,
    LeadPublicCreateSerializer,
    LeadSerializer,
    PageSectionPublicSerializer,
    PageSectionSerializer,
    QuoteSerializer,
    QuoteTrackSerializer,
    SocialPostSerializer,
)

MARKETING_ROLES = ('RESPONSABLE_MARKETING',)
COMMERCIAL_ROLES = ('COMMERCIAL',)
CHEF_DE_PROJET_ROLES = ('CHEF_DE_PROJET',)

PUBLIC_LEAD_RATE_LIMIT = 3  # per IP
PUBLIC_LEAD_RATE_WINDOW = 60  # seconds


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Submit a lead (public site form)',
    description=(
        "Public — no auth. Rate-limited to 3 requests/minute/IP (Redis-backed "
        "fixed window). NOTE: reCAPTCHA v3 verification specified in "
        "docs/backend-specifications.md §7.1 is NOT implemented yet — no site/"
        "secret key configured. Rate limiting is the only abuse guard for now."
    ),
    request=LeadPublicCreateSerializer,
    responses={201: LeadPublicCreateSerializer, 429: None},
)
class PublicLeadCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = get_client_ip(request)
        if is_rate_limited(f'leadrate:{ip}', PUBLIC_LEAD_RATE_LIMIT, PUBLIC_LEAD_RATE_WINDOW):
            return Response(
                {'detail': 'Trop de requêtes. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = LeadPublicCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IsMarketingOrOwnCommercial(permissions.BasePermission):
    """Marketing/Super-Admin: full access. Commercial: only leads assigned
    to them (list filtered in get_queryset; object actions checked here)."""

    def has_permission(self, request, view):
        return has_role(request.user, *MARKETING_ROLES, *COMMERCIAL_ROLES)

    def has_object_permission(self, request, view, obj):
        if has_role(request.user, *MARKETING_ROLES):
            return True
        return obj.assigned_to_id == request.user.id


@extend_schema_view(
    list=extend_schema(tags=['Marketing & Commercial'], summary='List leads', description='Marketing/Super-Admin see all; Commercial sees only leads assigned to them.'),
    create=extend_schema(tags=['Marketing & Commercial'], summary='Manually create a lead'),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a lead'),
    update=extend_schema(tags=['Marketing & Commercial'], summary='Update a lead'),
    partial_update=extend_schema(tags=['Marketing & Commercial'], summary='Qualify / reassign a lead'),
    destroy=extend_schema(tags=['Marketing & Commercial'], summary='Delete a lead'),
)
class LeadViewSet(viewsets.ModelViewSet):
    serializer_class = LeadSerializer
    permission_classes = [IsMarketingOrOwnCommercial]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Lead.objects.none()
        qs = Lead.objects.select_related('assigned_to')
        if has_role(self.request.user, *MARKETING_ROLES):
            return qs
        return qs.filter(assigned_to=self.request.user)


class IsMarketing(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, *MARKETING_ROLES)


@extend_schema_view(
    list=extend_schema(
        tags=['Marketing & Commercial'],
        summary='List page sections (site vitrine CMS)',
        description="Filter with ?page=ACCUEIL. The set of sections per page is fixed "
        "(mirrors the real page template) — this only lists/edits their content.",
    ),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a page section'),
    partial_update=extend_schema(tags=['Marketing & Commercial'], summary='Edit a page section'),
)
class PageSectionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """No create/destroy — see PageSection docstring. `update()` (full PUT)
    is disabled too: `page`/`section_key`/`order` are read-only on the
    serializer, so PATCH is the only meaningful write.

    Pagination disabled: a page's section count is small and fixed (mirrors
    its real template), and a paginated response would collide with the
    `?page=ACCUEIL` filter query param anyway (DRF's default pagination
    also uses `page` for the page *number*)."""

    queryset = PageSection.objects.all()
    serializer_class = PageSectionSerializer
    permission_classes = [IsMarketing]
    pagination_class = None
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return PageSection.objects.none()
        qs = super().get_queryset()
        page = self.request.query_params.get('page')
        return qs.filter(page=page) if page else qs


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='List active page sections for a public page (site vitrine)',
    description='?page=ACCUEIL (required). Only is_active=True sections, in template order.',
)
class PublicPageSectionListView(generics.ListAPIView):
    serializer_class = PageSectionPublicSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    pagination_class = None  # same `?page=` collision reasoning as PageSectionViewSet

    def get_queryset(self):
        page = self.request.query_params.get('page')
        if not page:
            return PageSection.objects.none()
        return PageSection.objects.filter(page=page, is_active=True)


@extend_schema_view(
    list=extend_schema(tags=['Marketing & Commercial'], summary='List blog posts (all statuses)'),
    create=extend_schema(tags=['Marketing & Commercial'], summary='Create a blog post'),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a blog post'),
    update=extend_schema(tags=['Marketing & Commercial'], summary='Update a blog post'),
    partial_update=extend_schema(tags=['Marketing & Commercial'], summary='Partially update a blog post'),
    destroy=extend_schema(tags=['Marketing & Commercial'], summary='Delete a blog post'),
)
class BlogPostViewSet(viewsets.ModelViewSet):
    """Internal CMS management — Responsable Marketing/Super-Admin only.
    Public read access is served separately by PublicBlogList/DetailView,
    filtered to status=PUBLIE."""

    queryset = BlogPost.objects.select_related('author')
    serializer_class = BlogPostSerializer
    permission_classes = [IsMarketing]

    def perform_create(self, serializer):
        instance = serializer.save(author=self.request.user)
        self._sync_published_at(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._sync_published_at(instance)

    @staticmethod
    def _sync_published_at(instance):
        if instance.status == BlogPost.Status.PUBLIE and not instance.published_at:
            instance.published_at = timezone.now()
            instance.save(update_fields=['published_at'])


@extend_schema(tags=['Marketing & Commercial'], summary='List published blog posts (public)')
class PublicBlogListView(generics.ListAPIView):
    queryset = BlogPost.objects.filter(status=BlogPost.Status.PUBLIE).select_related('author')
    serializer_class = BlogPostPublicSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []


@extend_schema(tags=['Marketing & Commercial'], summary='Get a published blog post by slug (public)')
class PublicBlogDetailView(generics.RetrieveAPIView):
    queryset = BlogPost.objects.filter(status=BlogPost.Status.PUBLIE).select_related('author')
    serializer_class = BlogPostPublicSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    lookup_field = 'slug'


class IsMarketingOrOwnCommercialSocialPost(permissions.BasePermission):
    """Marketing/Super-Admin: full access. Commercial: "proposition only" —
    may create (DRAFT-only, enforced in the view) and read their own posts,
    never edit/schedule/cancel (docs/backend-specifications.md §2.2)."""

    def has_permission(self, request, view):
        return has_role(request.user, *MARKETING_ROLES, *COMMERCIAL_ROLES)

    def has_object_permission(self, request, view, obj):
        if has_role(request.user, *MARKETING_ROLES):
            return True
        return request.method in permissions.SAFE_METHODS and obj.author_id == request.user.id


@extend_schema_view(
    list=extend_schema(tags=['Marketing & Commercial'], summary='List social posts'),
    create=extend_schema(
        tags=['Marketing & Commercial'],
        summary='Create a social post',
        description='Commercial may only create DRAFT posts — the request is rejected (400) if it tries to set any other status.',
    ),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a social post'),
    update=extend_schema(tags=['Marketing & Commercial'], summary='Update a social post'),
    partial_update=extend_schema(tags=['Marketing & Commercial'], summary='Partially update a social post'),
    destroy=extend_schema(tags=['Marketing & Commercial'], summary='Delete a social post'),
)
class SocialPostViewSet(viewsets.ModelViewSet):
    """NOTE: docs/backend-specifications.md §7.4's publishing engine (Celery
    Beat cron polling SCHEDULED posts, calling the LinkedIn/Facebook/etc.
    APIs, J-3h/J-2h/J-1h reminders) is NOT implemented — there are no
    platform API credentials configured. `schedule`/`cancel` only manage
    this model's own status; nothing actually posts anywhere yet."""

    serializer_class = SocialPostSerializer
    permission_classes = [IsMarketingOrOwnCommercialSocialPost]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return SocialPost.objects.none()
        qs = SocialPost.objects.select_related('author')
        if has_role(self.request.user, *MARKETING_ROLES):
            return qs
        return qs.filter(author=self.request.user)

    def create(self, request, *args, **kwargs):
        if not has_role(request.user, *MARKETING_ROLES) and request.data.get('status', SocialPost.Status.DRAFT) != SocialPost.Status.DRAFT:
            return Response(
                {'detail': 'Un Commercial ne peut créer que des publications en brouillon (DRAFT).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user, status=SocialPost.Status.DRAFT)

    @extend_schema(tags=['Marketing & Commercial'], summary='Schedule a social post', responses={200: SocialPostSerializer})
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def schedule(self, request, pk=None):
        if not has_role(request.user, *MARKETING_ROLES):
            return Response(status=status.HTTP_403_FORBIDDEN)
        post = self.get_object()
        if not post.scheduled_at:
            return Response(
                {'detail': "Un post ne peut être programmé sans date (scheduled_at)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        post.status = SocialPost.Status.SCHEDULED
        post.save(update_fields=['status'])
        return Response(SocialPostSerializer(post).data)

    @extend_schema(tags=['Marketing & Commercial'], summary='Cancel a scheduled social post', responses={200: SocialPostSerializer})
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def cancel(self, request, pk=None):
        if not has_role(request.user, *MARKETING_ROLES):
            return Response(status=status.HTTP_403_FORBIDDEN)
        post = self.get_object()
        if post.status not in (SocialPost.Status.DRAFT, SocialPost.Status.SCHEDULED):
            return Response(
                {'detail': 'Seuls les posts en brouillon ou programmés peuvent être annulés.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        post.status = SocialPost.Status.CANCELLED
        post.save(update_fields=['status'])
        return Response(SocialPostSerializer(post).data)


class IsCommercialOwnerOrReadCollaborator(permissions.BasePermission):
    """Super-Admin: full access. Commercial: full access, but only on
    quotes they created. Chef de Projet: read-only on everything (technical
    feasibility collaboration, docs/backend-specifications.md §3.1)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return has_role(request.user, *COMMERCIAL_ROLES, *CHEF_DE_PROJET_ROLES)
        return has_role(request.user, *COMMERCIAL_ROLES)

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'firestore_role', None) == 'SUPER_ADMIN':
            return True
        if has_role(request.user, *CHEF_DE_PROJET_ROLES) and not has_role(request.user, *COMMERCIAL_ROLES):
            return request.method in permissions.SAFE_METHODS
        return obj.created_by_id == request.user.id


@extend_schema_view(
    list=extend_schema(tags=['Marketing & Commercial'], summary='List quotes', description='Commercial sees their own; Chef de Projet sees everything read-only; Super-Admin sees everything.'),
    create=extend_schema(tags=['Marketing & Commercial'], summary='Create a draft quote'),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a quote'),
    update=extend_schema(tags=['Marketing & Commercial'], summary='Update a quote', description='BROUILLON only — locked once ENVOYE/ACCEPTE/REFUSE, use /clone/ instead.'),
    partial_update=extend_schema(tags=['Marketing & Commercial'], summary='Partially update a quote'),
    destroy=extend_schema(tags=['Marketing & Commercial'], summary='Delete a quote'),
)
class QuoteViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteSerializer
    permission_classes = [IsCommercialOwnerOrReadCollaborator]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Quote.objects.none()
        qs = Quote.objects.select_related('created_by', 'lead').prefetch_related('lines')
        if has_role(self.request.user, *COMMERCIAL_ROLES) and not has_role(self.request.user, 'SUPER_ADMIN'):
            return qs.filter(created_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def update(self, request, *args, **kwargs):
        quote = self.get_object()
        if quote.is_locked:
            return Response(
                {'detail': "Ce devis a déjà été envoyé — utilise /clone/ pour créer une nouvelle version."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    @extend_schema(
        tags=['Marketing & Commercial'],
        summary='Send a quote',
        description='BROUILLON -> ENVOYE. NOTE: no PDF generation, no email — no PDF '
        'library or email backend configured. The client is expected to open the '
        'public tracking link (its URL is built from tracking_token) themselves.',
        responses={200: QuoteSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def send(self, request, pk=None):
        quote = self.get_object()
        if not has_role(request.user, *COMMERCIAL_ROLES) or quote.created_by_id != request.user.id:
            if not has_role(request.user, 'SUPER_ADMIN'):
                return Response(status=status.HTTP_403_FORBIDDEN)
        if quote.status != Quote.Status.BROUILLON:
            return Response({'detail': 'Seul un devis en brouillon peut être envoyé.'}, status=status.HTTP_400_BAD_REQUEST)
        if not quote.lines.exists():
            return Response({'detail': 'Impossible d\'envoyer un devis sans ligne de prestation.'}, status=status.HTTP_400_BAD_REQUEST)
        quote.status = Quote.Status.ENVOYE
        quote.save(update_fields=['status'])
        return Response(QuoteSerializer(quote).data)

    @extend_schema(
        tags=['Marketing & Commercial'],
        summary='Clone a quote into a new editable version',
        responses={201: QuoteSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def clone(self, request, pk=None):
        original = self.get_object()
        if not has_role(request.user, *COMMERCIAL_ROLES) or original.created_by_id != request.user.id:
            if not has_role(request.user, 'SUPER_ADMIN'):
                return Response(status=status.HTTP_403_FORBIDDEN)
        new_quote = Quote.objects.create(
            lead=original.lead,
            created_by=original.created_by,
            expiry_date=original.expiry_date,
            discount_amount=original.discount_amount,
            parent_quote=original,
            version=original.version + 1,
        )
        for line in original.lines.all():
            QuoteLine.objects.create(
                quote=new_quote, service_title=line.service_title,
                quantity=line.quantity, unit_price=line.unit_price,
            )
        new_quote.refresh_from_db()
        return Response(QuoteSerializer(new_quote).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Track a quote by its token (public)',
    description='No auth — the tracking_token itself is the credential. Records opened_at on first view.',
)
class PublicQuoteTrackView(generics.RetrieveAPIView):
    queryset = Quote.objects.prefetch_related('lines')
    serializer_class = QuoteTrackSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    lookup_field = 'tracking_token'
    lookup_url_kwarg = 'tracking_token'

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not instance.opened_at:
            instance.opened_at = timezone.now()
            instance.save(update_fields=['opened_at'])
        return Response(self.get_serializer(instance).data)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Marketing dashboard',
    description='Weighted commercial pipeline + lead/social-post aggregates. '
    'Responsable Marketing/Super-Admin see everything; Commercial/Chef de Projet '
    'get the same shape scoped to their own leads.',
    responses={200: {
        'type': 'object',
        'properties': {
            'weighted_pipeline': {'type': 'string'},
            'total_leads': {'type': 'integer'},
            'conversion_rate': {'type': 'string'},
            'leads_by_status': {'type': 'object'},
            'leads_by_source': {'type': 'object'},
            'leads_over_time': {'type': 'array', 'items': {'type': 'object'}},
            'social_posts_by_status': {'type': 'object'},
            'published_social_posts_by_platform': {'type': 'object'},
        },
    }},
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def marketing_dashboard(request):
    if not has_role(request.user, 'RESPONSABLE_MARKETING', 'COMMERCIAL', 'CHEF_DE_PROJET'):
        return Response(status=status.HTTP_403_FORBIDDEN)

    leads = Lead.objects.all()
    if not has_role(request.user, 'RESPONSABLE_MARKETING'):
        leads = leads.filter(assigned_to=request.user)

    # "Pipeline pondéré" = Sum(estimated_value * qualification_score / 100)
    # over leads still active in the funnel (excludes PERDU/CONVERTI —
    # closed either way, no longer "pipeline").
    active_statuses = [Lead.Status.NOUVEAU, Lead.Status.QUALIFIE, Lead.Status.PROPOSITION_EN_COURS]
    active_leads = leads.filter(status__in=active_statuses, estimated_value__isnull=False)
    weighted_pipeline = sum(
        (lead.estimated_value * Decimal(lead.qualification_score) / Decimal(100) for lead in active_leads),
        Decimal('0'),
    )

    total_leads = leads.count()
    converted_leads = leads.filter(status=Lead.Status.CONVERTI).count()
    conversion_rate = (Decimal(converted_leads) / Decimal(total_leads) * 100) if total_leads else Decimal('0')

    leads_by_status = {
        row['status']: row['count'] for row in leads.values('status').annotate(count=Count('id')).order_by()
    }
    leads_by_source = {
        row['source']: row['count'] for row in leads.values('source').annotate(count=Count('id')).order_by()
    }

    # Real data, not fabricated — daily count of leads actually created in
    # the last 30 days, zero-filled so the frontend gets a continuous series
    # for its line chart rather than sparse dates.
    today = timezone.now().date()
    window_start = today - timezone.timedelta(days=29)
    counts_by_date = {
        row['day']: row['count']
        for row in leads.filter(created_at__date__gte=window_start)
        .annotate(day=TruncDate('created_at')).values('day').annotate(count=Count('id')).order_by()
    }
    leads_over_time = [
        {'date': (window_start + timezone.timedelta(days=offset)).isoformat(), 'count': counts_by_date.get(window_start + timezone.timedelta(days=offset), 0)}
        for offset in range(30)
    ]

    social_posts = SocialPost.objects.all()
    if not has_role(request.user, 'RESPONSABLE_MARKETING'):
        social_posts = social_posts.filter(author=request.user)
    social_by_status = {
        row['status']: row['count'] for row in social_posts.values('status').annotate(count=Count('id')).order_by()
    }
    social_by_platform = {
        row['platform']: row['count']
        for row in social_posts.filter(status=SocialPost.Status.PUBLISHED)
        .values('platform').annotate(count=Count('id')).order_by()
    }

    return Response({
        'weighted_pipeline': str(weighted_pipeline),
        'total_leads': total_leads,
        'conversion_rate': str(conversion_rate.quantize(Decimal('0.1'))),
        'leads_by_status': leads_by_status,
        'leads_by_source': leads_by_source,
        'leads_over_time': leads_over_time,
        'social_posts_by_status': social_by_status,
        'published_social_posts_by_platform': social_by_platform,
    })
