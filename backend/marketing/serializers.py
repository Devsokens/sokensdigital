from rest_framework import serializers

from core.models import User
from core.serializers import UserBriefSerializer
from marketing.models import BlogPost, Lead, PageSection, Quote, QuoteLine, SocialPost


class LeadPublicCreateSerializer(serializers.ModelSerializer):
    """Public intake — the site vitrine's 'Démarrer un projet' form. No
    status/assigned_to/qualification_score: those are internal-only."""

    class Meta:
        model = Lead
        fields = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'source', 'message']


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
        fields = [
            'id', 'title', 'slug', 'author', 'excerpt', 'content',
            'visual_icon', 'visual_label', 'visual_sublabel', 'tags',
            'status', 'published_at', 'meta_description', 'created_at',
        ]
        read_only_fields = ['slug', 'author']


class BlogPostPublicSerializer(serializers.ModelSerializer):
    """What the public site vitrine reads — only PUBLIE posts are ever
    reachable through this (enforced in the view's queryset, not here)."""

    author = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = [
            'title', 'slug', 'author', 'excerpt', 'content',
            'visual_icon', 'visual_label', 'visual_sublabel', 'tags', 'published_at',
        ]

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
        platform = attrs.get('platform', getattr(self.instance, 'platform', None))
        content = attrs.get('content', getattr(self.instance, 'content', ''))
        image_path = attrs.get('image_path', getattr(self.instance, 'image_path', ''))
        if platform == SocialPost.Platform.TWITTER and len(content) > 280:
            raise serializers.ValidationError({'content': 'Twitter/X est limité à 280 caractères.'})
        if platform == SocialPost.Platform.INSTAGRAM and not image_path:
            raise serializers.ValidationError({'image_path': 'Instagram nécessite une image.'})
        return attrs


class QuoteLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteLine
        fields = ['id', 'service_title', 'quantity', 'unit_price', 'total_line']
        read_only_fields = ['total_line']


class QuoteSerializer(serializers.ModelSerializer):
    """Lines are nested and fully replaced on update (delete-then-recreate)
    — quotes are small documents, not worth a diffing PATCH. Only reachable
    at all while status=BROUILLON; the view enforces that lock, not this
    serializer (docs/backend-specifications.md §7.2)."""

    created_by = UserBriefSerializer(read_only=True)
    lines = QuoteLineSerializer(many=True, required=False)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'lead', 'created_by', 'issue_date', 'expiry_date',
            'status', 'discount_amount', 'total_ht', 'total_ttc', 'tracking_token',
            'opened_at', 'signed_at', 'parent_quote', 'version', 'lines', 'created_at',
        ]
        read_only_fields = [
            'quote_number', 'status', 'total_ht', 'total_ttc', 'tracking_token',
            'opened_at', 'signed_at', 'parent_quote', 'version',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
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


class QuoteTrackSerializer(serializers.ModelSerializer):
    """Public, token-authenticated view — no internal identifiers
    (created_by, tracking_token itself) leak into the response."""

    lines = QuoteLineSerializer(many=True, read_only=True)

    class Meta:
        model = Quote
        fields = [
            'quote_number', 'issue_date', 'expiry_date', 'status',
            'discount_amount', 'total_ht', 'total_ttc', 'lines',
        ]
