"""Endpoints de lecture PostHog — voir core.analytics pour l'architecture.

Deux vues distinctes plutôt qu'une seule filtrée : Marketing et Technique ne
regardent pas les mêmes chiffres, et chacun ne doit accéder qu'aux siens
(un Commercial n'a pas besoin des traces d'exception, un Développeur pas du
détail des campagnes). Super-Admin et Administrateur voient les deux.
"""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from core import analytics
from core.constants import (
    ROLE_ADMIN, ROLE_COMMERCIAL, ROLE_DEVELOPER, ROLE_PROJECT_MANAGER,
    ROLE_RESPONSABLE_MARKETING, ROLE_SUPER_ADMIN,
)
from core.permissions import has_role

MARKETING_ANALYTICS_ROLES = (ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_RESPONSABLE_MARKETING, ROLE_COMMERCIAL)
TECHNIQUE_ANALYTICS_ROLES = (ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_PROJECT_MANAGER, ROLE_DEVELOPER)

PERIOD_PARAM = OpenApiParameter('days', int, description='Période en jours : 7, 30 ou 90 (défaut 30).')


class AnalyticsThrottle(UserRateThrottle):
    """Le cache absorbe l'essentiel, mais changer de période en boucle
    contourne ce cache — ce plafond protège le quota de l'API PostHog."""
    rate = '60/min'


class _BaseAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AnalyticsThrottle]
    allowed_roles: tuple = ()

    def compute(self, days: int) -> dict:
        raise NotImplementedError

    def get(self, request):
        if not has_role(request.user, *self.allowed_roles):
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            days = int(request.query_params.get('days', 30))
        except ValueError:
            days = 30
        if days not in analytics.ALLOWED_PERIODS:
            return Response(
                {'detail': 'Période invalide : 7, 30 ou 90 jours.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = self.compute(days)
        except analytics.AnalyticsNotConfigured:
            return Response({'configured': False, 'days': days})
        except analytics.AnalyticsUnavailable:
            return Response(
                {'detail': 'Données analytiques momentanément indisponibles. Réessayez dans un instant.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({'configured': True, 'days': days, **data})


@extend_schema(tags=['Analytique'], summary='Audience et conversion (PostHog)', parameters=[PERIOD_PARAM])
class MarketingAnalyticsView(_BaseAnalyticsView):
    allowed_roles = MARKETING_ANALYTICS_ROLES

    def compute(self, days):
        return analytics.marketing_metrics(days)


@extend_schema(tags=['Analytique'], summary='Erreurs et performance (PostHog)', parameters=[PERIOD_PARAM])
class TechniqueAnalyticsView(_BaseAnalyticsView):
    allowed_roles = TECHNIQUE_ANALYTICS_ROLES

    def compute(self, days):
        return analytics.technique_metrics(days)
