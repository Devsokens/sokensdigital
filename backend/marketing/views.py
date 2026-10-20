import base64
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
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
from core.firestore_client import (
    adjust_blog_like_count,
    create_blog_comment,
    delete_blog_comment,
    get_blog_like_count,
    list_blog_comments,
    moderate_blog_comment,
    report_blog_comment,
)
from core.notifications import notify_roles
from core.permissions import has_role
from core.sanitize import sanitize_plain_text
from core.storage import upload_image, upload_video
from marketing.models import (
    BlogPost, Lead, PageSection, Quote, QuoteLine, QuoteSettings, ShowcaseProject,
    SiteSettings, SocialMediaCredentials, SocialPost, Specification, TestimonialSubmission,
)
from marketing.emails import send_lead_acknowledgement
from marketing.moderation import screen_comment
from marketing.ratelimit import get_client_ip, is_rate_limited
from marketing.serializers import (
    BlogCommentCreateSerializer,
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
    TestimonialSubmissionPublicCreateSerializer,
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
PUBLIC_COMMENT_RATE_LIMIT = 5  # per IP
PUBLIC_COMMENT_RATE_WINDOW = 60  # seconds
PUBLIC_LIKE_RATE_LIMIT = 20  # per IP — un simple bouton like, plafond large
PUBLIC_LIKE_RATE_WINDOW = 60  # seconds
PUBLIC_REPORT_RATE_LIMIT = 10  # per IP
PUBLIC_REPORT_RATE_WINDOW = 60  # seconds

PUBLIC_TESTIMONIAL_RATE_LIMIT = 3  # per IP
PUBLIC_TESTIMONIAL_RATE_WINDOW = 60  # seconds


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
        lead = serializer.save()

        # L'accusé de réception porte la référence de suivi : c'est le seul
        # endroit où le client la reçoit, et sans elle la page de suivi ne
        # lui sert à rien. Envoi hors transaction et sans lever : une demande
        # enregistrée doit le rester même si l'e-mail ne part pas.
        if not send_lead_acknowledgement(lead):
            # Jusqu'ici l'échec ne laissait qu'une ligne de log : personne ne
            # savait qu'un client venait de soumettre une demande sans jamais
            # recevoir sa référence de suivi — donc sans moyen de la suivre.
            label = lead.company_name or f'{lead.first_name} {lead.last_name}'.strip()
            notify_roles(
                MARKETING_ROLES,
                title='Accusé de réception non envoyé',
                message=(
                    f'La demande « {label} » ({lead.tracking_reference}) est bien enregistrée, '
                    f"mais son accusé de réception n'a pas pu partir vers {lead.email}. "
                    'Sa référence de suivi doit lui être communiquée manuellement.'
                ),
                notification_type='GENERAL',
                link='/admin/marketing/leads',
            )

        data = dict(serializer.data)
        data['tracking_reference'] = lead.tracking_reference
        return Response(data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Submit a testimonial (public site form)',
    description=(
        "Public — no auth. Rate-limited to 3 requests/minute/IP (Redis-backed "
        "fixed window). Stored as EN_ATTENTE — nothing is published automatically; "
        "Marketing reviews submissions in the Django admin and, if approved, copies "
        "the quote by hand into PageSection(section_key=TESTIMONIALS).items."
    ),
    request=TestimonialSubmissionPublicCreateSerializer,
    responses={201: None, 429: None},
)
class PublicTestimonialSubmitView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = get_client_ip(request)
        if is_rate_limited(f'testimonialrate:{ip}', PUBLIC_TESTIMONIAL_RATE_LIMIT, PUBLIC_TESTIMONIAL_RATE_WINDOW):
            return Response(
                {'detail': 'Trop de requêtes. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = TestimonialSubmissionPublicCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()

        notify_roles(
            MARKETING_ROLES,
            title='Nouveau témoignage à valider',
            message=(
                f'{submission.name} a laissé un témoignage depuis le site public. '
                "À valider dans l'admin Django avant de l'ajouter à la section "
                "Témoignages de l'accueil."
            ),
            notification_type='GENERAL',
            link='/admin/marketing/dashboard',
        )

        return Response(
            {'detail': 'Merci ! Ton témoignage a bien été reçu et sera examiné par notre équipe.'},
            status=status.HTTP_201_CREATED,
        )


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

    def perform_create(self, serializer):
        lead = serializer.save()
        label = lead.company_name or f'{lead.first_name} {lead.last_name}'.strip()
        notify_roles(
            MARKETING_ROLES,
            title='Nouvelle demande créée',
            message=f'Demande « {label} » créée manuellement.',
            notification_type='GENERAL',
            link='/admin/marketing/leads',
            exclude=self.request.user,
        )

    def perform_destroy(self, instance):
        label = instance.company_name or f'{instance.first_name} {instance.last_name}'.strip()
        super().perform_destroy(instance)
        notify_roles(
            MARKETING_ROLES,
            title='Demande supprimée',
            message=f'Demande « {label} » supprimée.',
            notification_type='GENERAL',
            link='/admin/marketing/leads',
            exclude=self.request.user,
        )


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


def _serialize_comment(comment: dict) -> dict:
    """Forme publique d'un commentaire — jamais reportCount/flagReason/
    moderatedBy, réservés à la file de modération (voir
    _serialize_comment_admin)."""
    created_at = comment.get('createdAt')
    return {
        'id': comment['id'],
        'pseudo': comment.get('pseudo', ''),
        'text': comment.get('text', ''),
        'created_at': created_at.isoformat() if created_at else None,
    }


def _serialize_comment_admin(comment: dict) -> dict:
    created_at = comment.get('createdAt')
    moderated_at = comment.get('moderatedAt')
    return {
        'id': comment['id'],
        'slug': comment.get('slug', ''),
        'pseudo': comment.get('pseudo', ''),
        'text': comment.get('text', ''),
        'status': comment.get('status', 'VISIBLE'),
        'flag_reason': comment.get('flagReason'),
        'report_count': comment.get('reportCount', 0),
        'created_at': created_at.isoformat() if created_at else None,
        'moderated_at': moderated_at.isoformat() if moderated_at else None,
        'moderated_by': comment.get('moderatedBy'),
    }


class PublicBlogCommentListCreateView(APIView):
    """Commentaires publics d'un article — stockés dans Firestore
    (blogComments), pas Postgres : voir core.firestore_client. Pseudo
    libre, pas de compte requis."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        comments = list_blog_comments(slug=slug, statuses=['VISIBLE'])
        return Response([_serialize_comment(c) for c in comments])

    def post(self, request, slug):
        ip = get_client_ip(request)
        if is_rate_limited(f'commentrate:{ip}', PUBLIC_COMMENT_RATE_LIMIT, PUBLIC_COMMENT_RATE_WINDOW):
            return Response(
                {'detail': 'Trop de commentaires envoyés. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = BlogCommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pseudo = sanitize_plain_text(serializer.validated_data['pseudo'])
        text = sanitize_plain_text(serializer.validated_data['text'])
        if not pseudo or not text:
            return Response({'detail': 'Pseudo et commentaire requis.'}, status=status.HTTP_400_BAD_REQUEST)

        # Filtre automatique (marketing.moderation) : un commentaire suspect
        # (insulte, propos haineux, menace, lien brut) part masqué, en
        # attente de relecture par le département Marketing & Communication
        # — jamais publié directement, jamais supprimé automatiquement.
        flagged = screen_comment(text) or screen_comment(pseudo)
        comment_status = 'MASQUE' if flagged else 'VISIBLE'
        flag_reason = 'MOTS_INTERDITS' if flagged else None

        try:
            comment = create_blog_comment(slug, pseudo, text, comment_status, flag_reason)
        except Exception:
            return Response(
                {'detail': "Le commentaire n'a pas pu être enregistré, réessayez."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if flagged:
            return Response(
                {'detail': 'Commentaire envoyé, en attente de validation.', 'pending': True},
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(_serialize_comment({**comment, 'createdAt': timezone.now()}), status=status.HTTP_201_CREATED)


class PublicBlogCommentReportView(APIView):
    """« Signaler » façon Facebook — un lecteur marque un commentaire
    existant comme problématique. Masqué automatiquement au-delà de
    core.firestore_client.REPORT_AUTO_HIDE_THRESHOLD signalements, en
    attendant la relecture d'un modérateur."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, slug, comment_id):
        ip = get_client_ip(request)
        if is_rate_limited(f'reportrate:{ip}', PUBLIC_REPORT_RATE_LIMIT, PUBLIC_REPORT_RATE_WINDOW):
            return Response({'detail': 'Trop de signalements.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        new_count = report_blog_comment(comment_id)
        if new_count is None:
            return Response({'detail': 'Commentaire introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'report_count': new_count})


class PublicBlogLikeView(APIView):
    """Like d'article façon Facebook — pas de compte visiteur : l'état
    "j'ai déjà liké" est géré côté client (localStorage), ce endpoint ne
    fait qu'incrémenter/décrémenter un compteur partagé stocké dans
    Firestore (blogLikes/{slug})."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        return Response({'like_count': get_blog_like_count(slug)})

    def post(self, request, slug):
        ip = get_client_ip(request)
        if is_rate_limited(f'likerate:{ip}', PUBLIC_LIKE_RATE_LIMIT, PUBLIC_LIKE_RATE_WINDOW):
            return Response({'detail': 'Trop de requêtes.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        liked = bool(request.data.get('liked', True))
        delta = 1 if liked else -1
        try:
            new_count = adjust_blog_like_count(slug, delta)
        except Exception:
            return Response({'detail': 'Le like n\'a pas pu être enregistré.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'like_count': new_count})


class BlogCommentModerationViewSet(viewsets.ViewSet):
    """File de modération des commentaires de blog — Responsable
    Marketing/Super-Admin (département Marketing & Communication), même
    permission que le reste du CMS blog (voir IsMarketing). Les
    commentaires vivent dans Firestore, pas Postgres : pas de ModelViewSet
    possible ici, on expose juste list/moderate/destroy à la main."""

    permission_classes = [IsMarketing]

    def list(self, request):
        status_param = request.query_params.get('status')
        slug_param = request.query_params.get('slug') or None
        statuses = [status_param] if status_param else None
        comments = list_blog_comments(slug=slug_param, statuses=statuses, limit=500)
        return Response([_serialize_comment_admin(c) for c in comments])

    @action(detail=True, methods=['post'])
    def moderate(self, request, pk=None):
        target_status = request.data.get('status')
        if target_status not in ('VISIBLE', 'MASQUE'):
            return Response({'detail': "status doit être 'VISIBLE' ou 'MASQUE'."}, status=status.HTTP_400_BAD_REQUEST)
        ok = moderate_blog_comment(pk, target_status, request.user.email)
        if not ok:
            return Response({'detail': 'Commentaire introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'status': target_status})

    def destroy(self, request, pk=None):
        ok = delete_blog_comment(pk)
        if not ok:
            return Response({'detail': 'Commentaire introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        if not has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN) and request.data.get('status', SocialPost.Status.BROUILLON) != SocialPost.Status.BROUILLON:
            return Response(
                {'detail': 'Un Commercial ne peut créer que des publications en brouillon (DRAFT).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user, status=SocialPost.Status.BROUILLON)

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
        post.status = SocialPost.Status.PROGRAMME
        post.save(update_fields=['status'])
        return Response(SocialPostSerializer(post).data)

    @extend_schema(tags=['Marketing & Commercial'], summary='Cancel a scheduled social post', responses={200: SocialPostSerializer})
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def cancel(self, request, pk=None):
        if not has_role(request.user, *MARKETING_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        post = self.get_object()
        if post.status not in (SocialPost.Status.BROUILLON, SocialPost.Status.PROGRAMME):
            return Response(
                {'detail': 'Seuls les posts en brouillon ou programmés peuvent être annulés.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        post.status = SocialPost.Status.ANNULE
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
        quote = serializer.save(created_by=self.request.user)
        notify_roles(
            MARKETING_ROLES,
            title='Nouveau devis créé',
            message=f'Devis {quote.quote_number} créé.',
            notification_type='GENERAL',
            link='/admin/marketing/devis',
            exclude=self.request.user,
        )

    def perform_destroy(self, instance):
        # Suppression d'un devis déjà envoyé/accepté = action très critique
        # (décision du 10/09/2026) — e-mail en plus du push. Un brouillon
        # n'a encore rien d'engageant pour le client, push suffit.
        was_validated = instance.status in (Quote.Status.ENVOYE, Quote.Status.ACCEPTE)
        number = instance.quote_number
        super().perform_destroy(instance)
        notify_roles(
            MARKETING_ROLES,
            title='Devis supprimé',
            message=f'Devis {number} supprimé.',
            notification_type='GENERAL',
            link='/admin/marketing/devis',
            email=was_validated,
            exclude=self.request.user,
        )

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

        # Envoi automatique par mail aux adresses rattachées
        recipient_emails = request.data.get('recipient_emails') or []
        if isinstance(recipient_emails, str):
            recipient_emails = [e.strip() for e in recipient_emails.split(',') if e.strip()]
        if not recipient_emails and quote.lead:
            if quote.lead.email:
                recipient_emails.append(quote.lead.email)
            for c in (quote.lead.contacts or []):
                if isinstance(c, dict) and c.get('email') and c.get('email') not in recipient_emails:
                    recipient_emails.append(c['email'])

        tracking_url = f'{settings.PUBLIC_SITE_URL}/devis/{quote.tracking_token}/'
        custom_message = request.data.get('message') or (
            f"Veuillez trouver ci-joint les détails de notre proposition pour le devis {quote.quote_number}."
        )

        from core import mailer
        for dest in recipient_emails:
            body = (
                f"Bonjour {quote.client_name or ''},\n\n"
                f"{custom_message}\n\n"
                f"Montant Total TTC : {quote.total_ttc} FCFA\n"
                f"Vous pouvez consulter et valider votre devis en ligne sur ce lien :\n{tracking_url}\n\n"
                "Cordialement,\nL'équipe Soken's Digital"
            )
            try:
                mailer.send_mail(dest, f"Devis {quote.quote_number} — Soken's Digital", body)
            except Exception:
                pass

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


PUBLIC_QUOTE_ACCEPT_RATE_LIMIT = 5  # per IP
PUBLIC_QUOTE_ACCEPT_RATE_WINDOW = 60  # seconds


def _decode_signature_image(data_url: str) -> SimpleUploadedFile:
    """Turns the signature pad's `canvas.toDataURL('image/png')` output
    (a `data:image/png;base64,...` string) into something core.storage.
    upload_image can consume — same validated/resized pipeline as any
    other image upload, just fed bytes instead of a real HTTP file."""
    try:
        header, encoded = data_url.split(',', 1)
        raw = base64.b64decode(encoded)
    except (ValueError, TypeError, base64.binascii.Error):
        raise ValidationError('Signature invalide.')
    content_type = 'image/png' if 'image/png' in header else 'image/jpeg'
    return SimpleUploadedFile('signature.png', raw, content_type=content_type)


@extend_schema(
    tags=['Marketing & Commercial'],
    summary='Accept a quote from its public tracking page (§4.7)',
    description="No auth — the tracking_token is the credential, same as the GET above. e-signature: "
    "a hand-drawn signature (canvas, mouse/touch/pen) sent as a base64 PNG in `signature`, "
    "uploaded and stored as signature_url, plus a timestamp (signed_at) and the requester's IP "
    "(accepted_ip) as proof — not a third-party e-signature provider. Rate-limited to 5 "
    'requests/minute/IP.',
    responses={200: QuoteTrackSerializer, 400: None, 429: None},
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
        ip = get_client_ip(request)
        if is_rate_limited(f'quoteacceptrate:{ip}', PUBLIC_QUOTE_ACCEPT_RATE_LIMIT, PUBLIC_QUOTE_ACCEPT_RATE_WINDOW):
            return Response(
                {'detail': 'Trop de requêtes. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        signature_data_url = request.data.get('signature')
        if not signature_data_url:
            return Response({'detail': 'La signature est requise pour accepter ce devis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            signature_file = _decode_signature_image(signature_data_url)
            signature_url = upload_image(signature_file, 'quote-signatures')
        except ValidationError as exc:
            return Response({'detail': str(exc.message if hasattr(exc, "message") else exc)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError:
            return Response({'detail': "Impossible d'enregistrer la signature. Réessayez."}, status=status.HTTP_502_BAD_GATEWAY)
        quote.status = Quote.Status.ACCEPTE
        quote.signed_at = timezone.now()
        quote.accepted_ip = ip
        quote.signature_url = signature_url
        quote.save(update_fields=['status', 'signed_at', 'accepted_ip', 'signature_url'])

        _create_project_for_accepted_quote(quote)

        return Response(QuoteTrackSerializer(quote).data)


def _create_project_for_accepted_quote(quote: 'Quote') -> None:
    """Décision du 13/09/2026 : un devis accepté fait apparaître le projet
    correspondant dans le gestionnaire de l'équipe technique — jusqu'ici,
    accepter un devis ne faisait rien de plus que changer son statut, et
    Technique n'avait aucun moyen de savoir qu'un projet venait d'être
    vendu sans qu'on le lui dise à la main.

    `projects.Project` (pas `technique.Project`, l'autre modèle du même nom)
    parce que c'est celui que lit l'écran "Projets" de Technique
    (/api/v1/projects/, voir frontend/lib/api/projects.ts) — son
    lead_project_manager est nullable, donc le projet peut exister avant
    qu'un chef de projet lui soit assigné, contrairement à technique.Project
    qui l'exige à la création.

    Idempotent par construction : PublicQuoteAcceptView court-circuite déjà
    tout appel une fois `quote.status == ACCEPTE` (retour anticipé plus
    haut), donc cette fonction ne s'exécute qu'une fois par devis.
    """
    from projects.models import Project

    label = quote.client_name or (quote.lead.company_name if quote.lead else '') or quote.quote_number
    project = Project.objects.create(
        name=f'{label} — {quote.quote_number}',
        budget=quote.total_ttc,
    )
    quote.project = project
    quote.save(update_fields=['project'])

    from marketing.workflow import TECHNIQUE_SIDE
    notify_roles(
        TECHNIQUE_SIDE,
        title='Nouveau projet à démarrer',
        message=f'Le devis {quote.quote_number} a été accepté — le projet « {project.name} » est prêt à être pris en charge.',
        notification_type='GENERAL',
        link='/admin/technique/projets',
    )


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
        for row in social_posts.filter(status=SocialPost.Status.PUBLIE)
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


class SendDocumentEmailView(APIView):
    """Envoi par e-mail d'un document aux différents contacts du client."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        recipient_emails = request.data.get('recipient_emails') or []
        if isinstance(recipient_emails, str):
            recipient_emails = [e.strip() for e in recipient_emails.split(',') if e.strip()]

        subject = request.data.get('subject') or "Document transmis par Soken's Digital"
        message = request.data.get('message') or "Veuillez trouver les informations relatives à votre document."
        document_title = request.data.get('document_title') or "Document"
        document_url = request.data.get('document_url') or ""

        if not recipient_emails:
            return Response({'detail': 'Au moins une adresse e-mail est requise.'}, status=status.HTTP_400_BAD_REQUEST)

        from core import mailer
        sent_count = 0
        for email in recipient_emails:
            body = (
                f"Bonjour,\n\n"
                f"{message}\n\n"
            )
            if document_url:
                body += f"Lien d'accès au document ({document_title}) :\n{document_url}\n\n"
            body += "Cordialement,\nL'équipe Soken's Digital"

            try:
                mailer.send_mail(email, subject, body)
                sent_count += 1
            except Exception:
                pass

        return Response({
            'status': 'sent',
            'sent_count': sent_count,
            'recipients': recipient_emails,
        })

