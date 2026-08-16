from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Count, F, Max, Sum
from django.shortcuts import get_object_or_404
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_RESPONSABLE_MARKETING, ROLE_COMMERCIAL, ROLE_PROJECT_MANAGER,
    ROLE_COMPTABLE, ROLE_DIRECTEUR_FINANCIER, ROLE_DEVELOPER,
)
from core.permissions import has_role
from core.storage import upload_image, upload_video
from marketing.models import (
    BlogPost, Lead, PageSection, Quote, QuoteLine, QuoteSettings, ShowcaseProject,
    SiteSettings, SocialMediaCredentials, SocialPost, Specification,
)
from marketing.ratelimit import get_client_ip, is_rate_limited
from marketing.serializers import (
    BlogPostPublicSerializer,
    BlogPostSerializer,
    LeadPublicCreateSerializer,
    LeadSerializer,
    PageSectionPublicSerializer,
    PageSectionSerializer,
    QuoteSerializer,
    QuoteSettingsSerializer,
    QuoteTrackSerializer,
    ShowcaseProjectPublicSerializer,
    ShowcaseProjectSerializer,
    SiteSettingsSerializer,
    SocialMediaCredentialsSerializer,
    SocialPostSerializer,
    SpecificationListSerializer,
    SpecificationSerializer,
)

MARKETING_ROLES = (ROLE_RESPONSABLE_MARKETING,)
COMMERCIAL_ROLES = (ROLE_COMMERCIAL,)
FINANCE_CONVERT_ROLES = (ROLE_COMPTABLE, ROLE_DIRECTEUR_FINANCIER)
CHEF_DE_PROJET_ROLES = (ROLE_PROJECT_MANAGER,)
# Cahier des charges is a shared Technique + Marketing document — every
# role from both departments (plus Super-Admin) can read/write any of
# them, no per-owner restriction (collaborative internal doc, unlike Quote).
SPECIFICATION_ROLES = (ROLE_RESPONSABLE_MARKETING, ROLE_PROJECT_MANAGER, ROLE_DEVELOPER, ROLE_SUPER_ADMIN)

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
        return has_role(request.user, *MARKETING_ROLES, *COMMERCIAL_ROLES, ROLE_SUPER_ADMIN)

    def has_object_permission(self, request, view, obj):
        if has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN):
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
        if has_role(self.request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN):
            return qs
        return qs.filter(assigned_to=self.request.user)


class IsMarketing(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN)


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


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Get the site-wide header/footer settings (admin)',
    responses={200: SiteSettingsSerializer},
)
@extend_schema(
    methods=['PATCH'],
    tags=['Marketing & Commercial'],
    summary='Edit the site-wide header/footer settings (admin)',
    responses={200: SiteSettingsSerializer},
)
class SiteSettingsView(APIView):
    """Singleton — no list/create/destroy, same reasoning as PageSection
    but simpler still: there's exactly one row, always. GET+PATCH only."""

    permission_classes = [IsMarketing]

    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)

    def patch(self, request):
        instance = SiteSettings.load()
        serializer = SiteSettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(tags=['Marketing & Commercial'], summary='Get the site-wide header/footer settings (public)')
class PublicSiteSettingsView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)


class IsSuperAdminOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, ROLE_SUPER_ADMIN)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Get the Facebook/Instagram publishing credentials (Super-Admin)',
    description='The access token is never returned — see facebook_configured/'
    'instagram_configured to know whether one is already set.',
    responses={200: SocialMediaCredentialsSerializer},
)
@extend_schema(
    methods=['PATCH'],
    tags=['Marketing & Commercial'],
    summary='Set the Facebook/Instagram publishing credentials (Super-Admin)',
    description="Configured here instead of a Render environment variable so rotating "
    "a token is an in-app action, not a deploy — see marketing/publishing.py.",
    responses={200: SocialMediaCredentialsSerializer},
)
class SocialMediaCredentialsView(APIView):
    """Singleton — same convention as SiteSettingsView. Super-Admin only:
    these are live tokens that can post to the company's Facebook Page/
    Instagram account, not editorial content."""

    permission_classes = [IsSuperAdminOnly]

    def get(self, request):
        return Response(SocialMediaCredentialsSerializer(SocialMediaCredentials.load()).data)

    def patch(self, request):
        instance = SocialMediaCredentials.load()
        serializer = SocialMediaCredentialsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Upload an image (partner logo, team photo) for the site CMS',
    description='Responsable Marketing/Super-Admin only. Uploads to Supabase Storage '
    '(core.storage) and returns its public URL — meant to be pasted into a '
    'PageSection.items entry (e.g. logo_url, photo_url), not a standalone model.',
    request={'multipart/form-data': {'type': 'object', 'properties': {'file': {'type': 'string', 'format': 'binary'}}}},
    responses={201: {'type': 'object', 'properties': {'url': {'type': 'string'}}}},
)
class ImageUploadView(APIView):
    permission_classes = [IsMarketing]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            url = upload_image(file, folder='page-sections')
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'url': url}, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Upload a video (showcase project demo clip) for the site CMS',
    description='Responsable Marketing/Super-Admin only. Uploads to Supabase Storage '
    '(core.storage) and returns its public URL — meant to be pasted into a '
    "ShowcaseProject's video_src, not a standalone model. 25 Mo max.",
    request={'multipart/form-data': {'type': 'object', 'properties': {'file': {'type': 'string', 'format': 'binary'}}}},
    responses={201: {'type': 'object', 'properties': {'url': {'type': 'string'}}}},
)
class VideoUploadView(APIView):
    permission_classes = [IsMarketing]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            url = upload_video(file, folder='showcase-projects')
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'url': url}, status=status.HTTP_201_CREATED)


@extend_schema_view(
    list=extend_schema(tags=['Marketing & Commercial'], summary='List showcase projects (all, incl. inactive)'),
    create=extend_schema(tags=['Marketing & Commercial'], summary='Create a showcase project'),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a showcase project'),
    update=extend_schema(tags=['Marketing & Commercial'], summary='Update a showcase project'),
    partial_update=extend_schema(tags=['Marketing & Commercial'], summary='Partially update a showcase project'),
    destroy=extend_schema(tags=['Marketing & Commercial'], summary='Delete a showcase project'),
)
class ShowcaseProjectViewSet(viewsets.ModelViewSet):
    """Internal CMS management (the /projects public grid + detail pages) —
    Responsable Marketing/Super-Admin only. Public read access is served
    separately by PublicShowcaseProject{List,Detail}View, filtered to
    is_active=True."""

    queryset = ShowcaseProject.objects.all()
    serializer_class = ShowcaseProjectSerializer
    permission_classes = [IsMarketing]

    def perform_create(self, serializer):
        # New projects append to the end of the (curated) ordering by
        # default, instead of tying with whatever already sits at order=0
        # and jumping to the front of the public grid — `order` stays
        # freely editable afterward via PATCH.
        max_order = ShowcaseProject.objects.aggregate(Max('order'))['order__max'] or 0
        serializer.save(order=max_order + 1)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='List active showcase projects (public)',
    description='?homepage=true restricts to the projects flagged for the Accueil "Projets récents" carousel.',
)
class PublicShowcaseProjectListView(generics.ListAPIView):
    serializer_class = ShowcaseProjectPublicSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    pagination_class = None

    def get_queryset(self):
        qs = ShowcaseProject.objects.filter(is_active=True)
        if self.request.query_params.get('homepage') == 'true':
            qs = qs.filter(show_on_homepage=True)
        return qs


@extend_schema(tags=['Marketing & Commercial'], summary='Get an active showcase project by slug (public)')
class PublicShowcaseProjectDetailView(generics.RetrieveAPIView):
    queryset = ShowcaseProject.objects.filter(is_active=True)
    serializer_class = ShowcaseProjectPublicSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    lookup_field = 'slug'


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
        return has_role(request.user, *MARKETING_ROLES, *COMMERCIAL_ROLES, ROLE_SUPER_ADMIN)

    def has_object_permission(self, request, view, obj):
        if has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN):
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
        if has_role(self.request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN):
            return qs
        return qs.filter(author=self.request.user)

    def create(self, request, *args, **kwargs):
        if not has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN) and request.data.get('status', SocialPost.Status.DRAFT) != SocialPost.Status.DRAFT:
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
        if not has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN):
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
        if not has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN):
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
    """Super-Admin: full access, any quote, any status — "toujours modifier
    et mettre à jour" (the department with editing rights). Responsable
    Marketing: same — full write access on any quote, not just their own
    (Marketing owns the Devis module at the department level, per the nav
    structure). Commercial: full access, but only on quotes they created.
    Chef de Projet: read-only on everything (technical feasibility
    collaboration, docs/backend-specifications.md §3.1)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return has_role(request.user, *COMMERCIAL_ROLES, *MARKETING_ROLES, *CHEF_DE_PROJET_ROLES, ROLE_SUPER_ADMIN)
        return has_role(request.user, *COMMERCIAL_ROLES, *MARKETING_ROLES, ROLE_SUPER_ADMIN)

    def has_object_permission(self, request, view, obj):
        if has_role(request.user, ROLE_SUPER_ADMIN, *MARKETING_ROLES):
            return True
        if has_role(request.user, *CHEF_DE_PROJET_ROLES) and not has_role(request.user, *COMMERCIAL_ROLES):
            return request.method in permissions.SAFE_METHODS
        return obj.created_by_id == request.user.id


@extend_schema_view(
    list=extend_schema(tags=['Marketing & Commercial'], summary='List quotes', description='Commercial sees their own; Chef de Projet sees everything read-only; Super-Admin sees everything.'),
    create=extend_schema(tags=['Marketing & Commercial'], summary='Create a draft quote'),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a quote'),
    update=extend_schema(tags=['Marketing & Commercial'], summary='Update a quote', description="No status lock — the owning department (Commercial owner/Responsable Marketing/Super-Admin) can always edit and update a quote, whatever its status."),
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
        if (
            has_role(self.request.user, *COMMERCIAL_ROLES)
            and not has_role(self.request.user, ROLE_SUPER_ADMIN, *MARKETING_ROLES)
        ):
            return qs.filter(created_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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
            if not has_role(request.user, ROLE_SUPER_ADMIN):
                return Response(status=status.HTTP_403_FORBIDDEN)
        if quote.status != Quote.Status.BROUILLON:
            return Response({'detail': 'Seul un devis en brouillon peut être envoyé.'}, status=status.HTTP_400_BAD_REQUEST)
        if not quote.lines.exists():
            return Response({'detail': 'Impossible d\'envoyer un devis sans ligne de prestation.'}, status=status.HTTP_400_BAD_REQUEST)
        quote.status = Quote.Status.ENVOYE
        quote.sent_at = timezone.now()
        quote.save(update_fields=['status', 'sent_at'])
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
            if not has_role(request.user, ROLE_SUPER_ADMIN):
                return Response(status=status.HTTP_403_FORBIDDEN)
        new_quote = Quote.objects.create(
            lead=original.lead,
            created_by=original.created_by,
            client_name=original.client_name,
            intro_message=original.intro_message,
            subject=original.subject,
            description=original.description,
            project_duration=original.project_duration,
            payment_terms=original.payment_terms,
            expiry_date=original.expiry_date,
            discount_amount=original.discount_amount,
            parent_quote=original,
            version=original.version + 1,
        )
        for line in original.lines.all():
            QuoteLine.objects.create(
                quote=new_quote, service_title=line.service_title, description=line.description,
                quantity=line.quantity, unit_price=line.unit_price, amount_label=line.amount_label,
            )
        new_quote.refresh_from_db()
        return Response(QuoteSerializer(new_quote).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        tags=['Marketing & Commercial'],
        summary='Convert an accepted quote into an invoice (§4.7)',
        description='Commercial (owner)/Responsable Marketing/Comptable/Directeur Financier/Super-Admin. '
        'Quote must be ACCEPTE. Lines are collapsed into a single amount_ht (finance.Invoice has no '
        'line-item model of its own) — the quote itself remains the itemized record.',
    )
    @action(detail=True, methods=['post'], url_path='convert-to-invoice', permission_classes=[permissions.IsAuthenticated])
    def convert_to_invoice(self, request, pk=None):
        from finance.models import Invoice
        from finance.serializers import InvoiceSerializer

        quote = self.get_object()
        allowed = (
            has_role(request.user, ROLE_SUPER_ADMIN, *MARKETING_ROLES, *FINANCE_CONVERT_ROLES)
            or (has_role(request.user, *COMMERCIAL_ROLES) and quote.created_by_id == request.user.id)
        )
        if not allowed:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if quote.status != Quote.Status.ACCEPTE:
            return Response({'detail': 'Seul un devis accepté peut être converti en facture.'}, status=status.HTTP_400_BAD_REQUEST)
        if quote.invoices.exists():
            return Response({'detail': 'Ce devis a déjà été converti en facture.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice = Invoice.objects.create(
            client_name=quote.client_name,
            quote=quote,
            amount_ht=quote.total_ht,
            issue_date=timezone.now().date(),
            due_date=quote.expiry_date,
            created_by=request.user,
        )
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class IsSpecificationEditor(permissions.BasePermission):
    """Any Technique/Marketing role (or Super-Admin) — see SPECIFICATION_ROLES.
    No per-owner restriction: a cahier des charges is a shared, collaborative
    internal document, not one person's commercial pipeline item."""

    def has_permission(self, request, view):
        return has_role(request.user, *SPECIFICATION_ROLES)


@extend_schema_view(
    list=extend_schema(tags=['Marketing & Commercial'], summary='List cahiers des charges'),
    create=extend_schema(tags=['Marketing & Commercial'], summary='Create a cahier des charges'),
    retrieve=extend_schema(tags=['Marketing & Commercial'], summary='Get a cahier des charges'),
    update=extend_schema(tags=['Marketing & Commercial'], summary='Update a cahier des charges'),
    partial_update=extend_schema(tags=['Marketing & Commercial'], summary='Partially update a cahier des charges'),
    destroy=extend_schema(tags=['Marketing & Commercial'], summary='Delete a cahier des charges'),
)
class SpecificationViewSet(viewsets.ModelViewSet):
    """Cahier des charges (fonctionnel/technique) — internal document
    shared by Technique and Marketing, no commercial workflow (cahier des
    charges §4.7 scope note: decided as a simple internal document, not
    the same send/accept circuit as Quote)."""

    queryset = Specification.objects.select_related('created_by').prefetch_related('lines')
    permission_classes = [IsSpecificationEditor]

    def get_serializer_class(self):
        if self.action == 'list':
            return SpecificationListSerializer
        return SpecificationSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Get the devis document settings (admin)',
    responses={200: QuoteSettingsSerializer},
)
@extend_schema(
    methods=['PATCH'],
    tags=['Marketing & Commercial'],
    summary='Edit the devis document settings (admin)',
    responses={200: QuoteSettingsSerializer},
)
class QuoteSettingsView(APIView):
    """Singleton — same convention as SiteSettingsView. Gated like Quote
    itself (Commercial/Chef de Projet/Super-Admin), not IsMarketing, since
    this is devis document config, not site-vitrine CMS content."""

    permission_classes = [IsCommercialOwnerOrReadCollaborator]

    def get(self, request):
        return Response(QuoteSettingsSerializer(QuoteSettings.load()).data)

    def patch(self, request):
        instance = QuoteSettings.load()
        serializer = QuoteSettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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
    summary='Accept a quote from its public tracking page (§4.7)',
    description="No auth — the tracking_token is the credential, same as the GET above. MVP e-signature: "
    "an explicit checkbox acceptance recorded with a timestamp (signed_at) and the requester's IP "
    "(accepted_ip) as proof, not a third-party e-signature provider.",
    responses={200: QuoteTrackSerializer},
)
class PublicQuoteAcceptView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, tracking_token):
        quote = get_object_or_404(Quote.objects.prefetch_related('lines'), tracking_token=tracking_token)
        if quote.status == Quote.Status.ACCEPTE:
            return Response(QuoteTrackSerializer(quote).data)
        if quote.status != Quote.Status.ENVOYE:
            return Response(
                {'detail': "Seul un devis envoyé peut être accepté."}, status=status.HTTP_400_BAD_REQUEST,
            )
        quote.status = Quote.Status.ACCEPTE
        quote.signed_at = timezone.now()
        quote.accepted_ip = get_client_ip(request)
        quote.save(update_fields=['status', 'signed_at', 'accepted_ip'])
        return Response(QuoteTrackSerializer(quote).data)


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
    if not has_role(request.user, ROLE_RESPONSABLE_MARKETING, ROLE_COMMERCIAL, ROLE_PROJECT_MANAGER, ROLE_SUPER_ADMIN):
        return Response(status=status.HTTP_403_FORBIDDEN)

    leads = Lead.objects.all()
    if not has_role(request.user, ROLE_RESPONSABLE_MARKETING, ROLE_SUPER_ADMIN):
        leads = leads.filter(assigned_to=request.user)

    # "Pipeline pondéré" = Sum(estimated_value * qualification_score / 100)
    # over leads still active in the funnel (excludes PERDU/CONVERTI —
    # closed either way, no longer "pipeline"). Computed DB-side (not by
    # fetching every active lead and summing in Python) — with Postgres and
    # the app on separate free-tier hosts, avoiding an extra row-transfer
    # matters more here than it would on a single-host setup.
    active_statuses = [Lead.Status.NOUVEAU, Lead.Status.QUALIFIE, Lead.Status.PROPOSITION_EN_COURS]
    active_leads = leads.filter(status__in=active_statuses, estimated_value__isnull=False)
    weighted_pipeline = (active_leads.aggregate(
        total=Sum(F('estimated_value') * F('qualification_score'))
    )['total'] or Decimal('0')) / Decimal(100)
    weighted_pipeline = weighted_pipeline.quantize(Decimal('0.01'))

    # total_leads/converted_leads are derived from leads_by_status below
    # instead of two extra .count() queries — same numbers, fewer round
    # trips to a database that isn't on the same host as this app.
    leads_by_status = {
        row['status']: row['count'] for row in leads.values('status').annotate(count=Count('id')).order_by()
    }
    total_leads = sum(leads_by_status.values())
    converted_leads = leads_by_status.get(Lead.Status.CONVERTI, 0)
    conversion_rate = (Decimal(converted_leads) / Decimal(total_leads) * 100) if total_leads else Decimal('0')

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
    if not has_role(request.user, ROLE_RESPONSABLE_MARKETING, ROLE_SUPER_ADMIN):
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
