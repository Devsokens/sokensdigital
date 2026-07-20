from rest_framework import serializers

from core.models import User
from core.serializers import UserBriefSerializer
from marketing.models import BlogPost, Lead


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
            'qualification_score', 'created_at',
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
