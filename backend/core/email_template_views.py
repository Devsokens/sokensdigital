"""Paramètres > E-mail : lecture et personnalisation des gabarits déclarés
dans core.email_templates.TEMPLATES."""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.email_templates import TEMPLATES
from core.models import EmailTemplate
from core.permissions import IsAdmin
from core.sanitize import sanitize_html


def _serialize(key: str, override: EmailTemplate | None) -> dict:
    entry = TEMPLATES[key]
    return {
        'key': key,
        'label': entry['label'],
        'description': entry['description'],
        'variables': entry['variables'],
        'subject': override.subject if override else entry['subject'],
        'body_html': override.body_html if override else entry['body_html'],
        'is_customized': override is not None,
        'updated_at': override.updated_at if override else None,
    }


class EmailTemplateInputSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    body_html = serializers.CharField()


class EmailTemplateListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        overrides = {t.key: t for t in EmailTemplate.objects.filter(key__in=TEMPLATES.keys())}
        return Response([_serialize(key, overrides.get(key)) for key in TEMPLATES])


class EmailTemplateDetailView(APIView):
    """PUT enregistre une personnalisation, DELETE revient au texte par défaut."""
    permission_classes = [IsAdmin]

    def put(self, request, key):
        if key not in TEMPLATES:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = EmailTemplateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        override, _ = EmailTemplate.objects.update_or_create(
            key=key,
            defaults={
                'subject': serializer.validated_data['subject'],
                'body_html': sanitize_html(serializer.validated_data['body_html']),
            },
        )
        return Response(_serialize(key, override))

    def delete(self, request, key):
        if key not in TEMPLATES:
            return Response(status=status.HTTP_404_NOT_FOUND)
        override = EmailTemplate.objects.filter(key=key).first()
        if override:
            override.delete(user=request.user)
        return Response(_serialize(key, None))
