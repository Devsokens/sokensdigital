from rest_framework import serializers

from core.models import User
from core.sanitize import sanitize_html
from core.serializers import UserBriefSerializer
from marketing.models import (
    BlogPost, Lead, PageSection, Quote, QuoteLine, QuoteSettings, ShowcaseProject,
    SiteSettings, SocialMediaCredentials, SocialPost, Specification, SpecificationLine,
)


class LeadPublicCreateSerializer(serializers.ModelSerializer):
    """Public intake — the site vitrine's 'Démarrer un projet' form. No
    status/assigned_to/qualification_score: those are internal-only.
    `estimated_value` IS accepted here (unlike the others) — it's the
    wizard's own "Budget estimé" field, and populating it is what makes
    the "pipeline pondéré" dashboard metric mean anything for organic
    web leads instead of always being null."""

    class Meta:
        model = Lead
        fields = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'source', 'message', 'estimated_value']


class LeadSerializer(serializers.ModelSerializer):
    assigned_to = UserBriefSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = Lead
        fields = [
            'id', 'first_name', 'last_name', 'company_name', 'email', 'phone',
            'source', 'message', 'status', 'assigned_to', 'assigned_to_id',
            'qualification_score', 'estimated_value', 'created_at',
        ]

    def validate_qualification_score(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError('Le score doit être compris entre 0 et 100.')
        return value


class BlogPostSerializer(serializers.ModelSerializer):
    """Full read/write shape — Responsable Marketing/Super-Admin only."""

    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = BlogPost
        fields = ['id', 'title', 'slug', 'author', 'cover_image', 'content', 'status', 'published_at', 'created_at']
        read_only_fields = ['slug', 'author']

    def validate_content(self, value):
        # Défense contre XSS stockée : le HTML produit par l'éditeur Tiptap
        # admin est rendu tel quel sur le site public (dangerouslySetInnerHTML,
        # frontend/components/blog/article-content.tsx) — la restriction
        # côté éditeur n'est pas une frontière de sécurité, un appel API
        # direct la contourne entièrement. Nettoyage ici, au plus près du
        # stockage, quel que soit le chemin d'écriture.
        return sanitize_html(value)


class BlogPostPublicSerializer(serializers.ModelSerializer):
    """What the public site vitrine reads — only PUBLIE posts are ever
    reachable through this (enforced in the view's queryset, not here)."""

    author = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = ['title', 'slug', 'author', 'cover_image', 'content', 'published_at']

    def get_author(self, obj) -> str | None:
        if not obj.author:
            return None
        return f'{obj.author.first_name} {obj.author.last_name}'.strip()


class SocialPostSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = SocialPost
        fields = [
            'id', 'title', 'content', 'image_path', 'additional_images',
            'platform', 'scheduled_at', 'status', 'published_at', 'post_url',
            'author', 'notes', 'tags', 'created_at',
        ]
        read_only_fields = ['status', 'published_at', 'post_url', 'author']

    def validate(self, attrs):
        image_path = attrs.get('image_path', getattr(self.instance, 'image_path', ''))
        if not image_path:
            raise serializers.ValidationError({'image_path': 'Une image est requise pour publier sur Facebook ou Instagram.'})
        return attrs


class SocialMediaCredentialsSerializer(serializers.ModelSerializer):
    """The access token is write_only — GET never echoes back a live
    secret, even to a Super-Admin's own browser network tab. The frontend
    uses facebook_configured/instagram_configured (computed, read-only) to
    show "connecté"/"non connecté" without ever seeing the token itself;
    re-saving requires pasting it again (matches how most integrations'
    "reconnect" flows work)."""

    updated_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = SocialMediaCredentials
        fields = [
            'facebook_page_id', 'facebook_access_token', 'instagram_business_account_id',
            'facebook_configured', 'instagram_configured', 'updated_by', 'updated_at',
        ]
        extra_kwargs = {'facebook_access_token': {'write_only': True, 'required': False}}


class QuoteLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteLine
        fields = ['id', 'service_title', 'description', 'quantity', 'unit_price', 'total_line', 'amount_label']
        read_only_fields = ['total_line']


class QuoteSerializer(serializers.ModelSerializer):
    """Lines are nested and fully replaced on update (delete-then-recreate)
    — quotes are small documents, not worth a diffing PATCH. No status
    lock: the owning department (Commercial owner/Responsable Marketing/
    Super-Admin, see IsCommercialOwnerOrReadCollaborator) can edit and
    update a quote whatever its status (docs/backend-specifications.md §7.2)."""

    created_by = UserBriefSerializer(read_only=True)
    lines = QuoteLineSerializer(many=True, required=False)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'lead', 'created_by', 'client_name', 'intro_message',
            'subject', 'description', 'project_duration', 'payment_terms', 'issue_date',
            'expiry_date', 'status', 'discount_amount', 'total_ht', 'total_ttc',
            'tracking_token', 'sent_at', 'opened_at', 'signed_at', 'parent_quote', 'version',
            'document_color', 'lines', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'quote_number', 'status', 'total_ht', 'total_ttc', 'tracking_token',
            'sent_at', 'opened_at', 'signed_at', 'parent_quote', 'version', 'updated_at',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        if not validated_data.get('payment_terms'):
            validated_data['payment_terms'] = QuoteSettings.load().default_payment_terms
        quote = Quote.objects.create(**validated_data)
        for line_data in lines_data:
            QuoteLine.objects.create(quote=quote, **line_data)
        quote.refresh_from_db()
        return quote

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                QuoteLine.objects.create(quote=instance, **line_data)
        instance.refresh_from_db()
        return instance


class SpecificationLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecificationLine
        fields = ['id', 'interface_name', 'objective']


class SpecificationListSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = Specification
        fields = ['id', 'spec_number', 'spec_type', 'title', 'status', 'created_by', 'created_at', 'updated_at']


class SpecificationSerializer(serializers.ModelSerializer):
    """Same lines-fully-replaced-on-update convention as QuoteSerializer —
    no status lock either, this is a collaborative internal document."""

    created_by = UserBriefSerializer(read_only=True)
    lines = SpecificationLineSerializer(many=True, required=False)

    class Meta:
        model = Specification
        fields = [
            'id', 'spec_number', 'spec_type', 'title', 'client_name', 'intro_message',
            'description', 'document_color', 'status', 'created_by', 'lines',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['spec_number', 'created_by', 'updated_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        spec = Specification.objects.create(**validated_data)
        for line_data in lines_data:
            SpecificationLine.objects.create(specification=spec, **line_data)
        spec.refresh_from_db()
        return spec

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                SpecificationLine.objects.create(specification=instance, **line_data)
        instance.refresh_from_db()
        return instance


class PageSectionSerializer(serializers.ModelSerializer):
    """Admin shape — Responsable Marketing/Super-Admin. `page`/`section_key`
    are read-only: the set of sections is fixed by the real page template,
    only their content is editable (see PageSection docstring)."""

    class Meta:
        model = PageSection
        fields = [
            'id', 'page', 'section_key', 'order', 'is_active', 'kicker', 'title',
            'subtitle', 'cta_label', 'cta_link', 'cta_secondary_label',
            'cta_secondary_link', 'items', 'created_at',
        ]
        read_only_fields = ['page', 'section_key', 'order']


class PageSectionPublicSerializer(serializers.ModelSerializer):
    """What the public site vitrine reads — no id/is_active, and the view's
    queryset already filters to is_active=True only."""

    class Meta:
        model = PageSection
        fields = [
            'section_key', 'kicker', 'title', 'subtitle', 'cta_label', 'cta_link',
            'cta_secondary_label', 'cta_secondary_link', 'items',
        ]


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Same shape for admin (read/write) and public (read) — nothing here
    is sensitive, it's the header/footer content every visitor already
    sees rendered on every page."""

    class Meta:
        model = SiteSettings
        fields = [
            'logo_url', 'tagline', 'services_links',
            'legal_links', 'social_links', 'copyright_text',
        ]


class ShowcaseProjectSerializer(serializers.ModelSerializer):
    """Admin shape — Responsable Marketing/Super-Admin. `slug` is
    read-only-on-write-but-editable-if-blank: auto-derived from `title` the
    first time it's saved (see model.save()), then stays stable."""

    class Meta:
        model = ShowcaseProject
        fields = [
            'id', 'slug', 'category', 'sector', 'type', 'featured', 'show_on_homepage',
            'order', 'is_active', 'status_tag', 'tag', 'title', 'description', 'visual_icon',
            'project_url', 'video_src', 'images', 'scene_variants', 'client', 'technologies',
            'timeline', 'lead_name', 'lead_role', 'challenge', 'stats', 'solution',
            'solution_points', 'created_at',
        ]


class ShowcaseProjectPublicSerializer(serializers.ModelSerializer):
    """What the public site vitrine reads — no id/is_active, and the view's
    queryset already filters to is_active=True only."""

    class Meta:
        model = ShowcaseProject
        fields = [
            'slug', 'category', 'sector', 'type', 'featured', 'status_tag', 'tag', 'title',
            'description', 'visual_icon', 'project_url', 'video_src', 'images', 'scene_variants',
            'client', 'technologies', 'timeline', 'lead_name', 'lead_role', 'challenge', 'stats',
            'solution', 'solution_points',
        ]


class QuoteTrackSerializer(serializers.ModelSerializer):
    """Public, token-authenticated view — no internal identifiers
    (created_by, tracking_token itself) leak into the response."""

    lines = QuoteLineSerializer(many=True, read_only=True)
    company_stamp_url = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            'quote_number', 'client_name', 'intro_message', 'subject', 'description',
            'project_duration', 'payment_terms', 'issue_date', 'expiry_date', 'status',
            'discount_amount', 'total_ht', 'total_ttc', 'lines', 'signed_at', 'company_stamp_url',
        ]

    def get_company_stamp_url(self, obj) -> str:
        return QuoteSettings.load().company_stamp_url


class QuoteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteSettings
        fields = [
            'company_address', 'company_phone', 'company_email', 'company_stamp_url',
            'payment_methods', 'default_payment_terms', 'footer_note',
        ]
