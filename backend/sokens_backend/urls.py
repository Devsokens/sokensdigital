"""
URL configuration for sokens_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
"""
import os

from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from marketing.urls import public_urlpatterns as marketing_public_urlpatterns
from support.urls import public_urlpatterns as support_public_urlpatterns

# Django admin only manages the DB directly (bypasses every DRF role check
# audited elsewhere) and its login has no built-in brute-force lockout — the
# default '/admin/' path is the first thing every automated scanner tries.
# ADMIN_URL lets a real deployment move it to an unguessable path as one
# extra layer (defense in depth, not a replacement for a WAF/IP allowlist —
# see SECURITY.md "Durcissement de l'admin Django"). Trailing slash required
# by Django's URL resolver; defaults to the original path so local dev is
# unaffected.
ADMIN_URL = os.environ.get('ADMIN_URL', 'admin/').lstrip('/')
if not ADMIN_URL.endswith('/'):
    ADMIN_URL += '/'

urlpatterns = [
    path(ADMIN_URL, admin.site.urls),

    # OpenAPI schema + interactive docs.
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Feature endpoints live in core.urls (and future app urls), added one
    # at a time. Versioned per docs/backend-specifications.md §10.
    path('api/v1/', include('core.urls')),
    path('api/v1/projects/', include('projects.urls')),
    path('api/v1/hr/', include('hr.urls')),
    path('api/v1/marketing/', include('marketing.urls')),
    path('api/v1/finance/', include('finance.urls')),
    path('api/v1/procurement/', include('procurement.urls')),
    path('api/v1/treasury/', include('treasury.urls')),
    path('api/v1/support/', include('support.urls')),
    path('api/v1/public/', include(marketing_public_urlpatterns)),
    path('api/v1/public/', include(support_public_urlpatterns)),
    path('api/administration/', include('administration.urls')),
    path('api/technique/', include('technique.urls')),
    path('api/messaging/', include('messaging.urls')),
]
