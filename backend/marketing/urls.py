from django.urls import path
from rest_framework.routers import DefaultRouter

from marketing.views import LeadViewSet, PublicLeadCreateView

router = DefaultRouter()
router.register('leads', LeadViewSet, basename='lead')
urlpatterns = router.urls

public_urlpatterns = [
    path('leads/', PublicLeadCreateView.as_view(), name='public-lead-create'),
]
