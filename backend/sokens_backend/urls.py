"""
URL configuration for sokens_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from marketing.urls import public_urlpatterns as marketing_public_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),

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
    path('api/v1/public/', include(marketing_public_urlpatterns)),
    path('api/administration/', include('administration.urls')),
    path('api/technique/', include('technique.urls')),
    path('api/messaging/', include('messaging.urls')),
]
