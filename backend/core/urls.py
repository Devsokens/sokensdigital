from django.urls import path

from core.views import health_check, MeView

# Feature endpoints get added here as they're built, one at a time.
urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('auth/me/', MeView.as_view(), name='me'),
]
