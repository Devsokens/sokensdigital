from decimal import Decimal

from django.db.models import Count
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import has_role
from marketing.models import BlogPost, Lead, SocialPost
from marketing.ratelimit import get_client_ip, is_rate_limited
from marketing.serializers import (
    BlogPostPublicSerializer,
    BlogPostSerializer,
    LeadPublicCreateSerializer,
    LeadSerializer,
    SocialPostSerializer,
)

MARKETING_ROLES = ('RESPONSABLE_MARKETING',)
COMMERCIAL_ROLES = ('COMMERCIAL',)

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
            'leads_by_status': {'type': 'object'},
            'leads_by_source': {'type': 'object'},
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

    leads_by_status = {
        row['status']: row['count'] for row in leads.values('status').annotate(count=Count('id')).order_by()
    }
    leads_by_source = {
        row['source']: row['count'] for row in leads.values('source').annotate(count=Count('id')).order_by()
    }

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
        'total_leads': leads.count(),
        'leads_by_status': leads_by_status,
        'leads_by_source': leads_by_source,
        'social_posts_by_status': social_by_status,
        'published_social_posts_by_platform': social_by_platform,
    })
