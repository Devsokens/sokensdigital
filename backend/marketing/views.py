from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import has_role
from marketing.models import BlogPost, Lead
from marketing.ratelimit import get_client_ip, is_rate_limited
from marketing.serializers import (
    BlogPostPublicSerializer,
    BlogPostSerializer,
    LeadPublicCreateSerializer,
    LeadSerializer,
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
