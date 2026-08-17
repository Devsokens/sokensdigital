from django.urls import path
from rest_framework.routers import DefaultRouter

from support.views import (
    FAQViewSet,
    PublicFAQListView,
    PublicTicketCreateView,
    PublicTicketDetailView,
    PublicTicketReplyView,
    SupportTicketViewSet,
)

router = DefaultRouter()
router.register('faq', FAQViewSet, basename='faq')
router.register('tickets', SupportTicketViewSet, basename='support-ticket')

urlpatterns = router.urls

public_urlpatterns = [
    path('faq/', PublicFAQListView.as_view(), name='public-faq-list'),
    path('tickets/', PublicTicketCreateView.as_view(), name='public-ticket-create'),
    path('tickets/<uuid:access_token>/', PublicTicketDetailView.as_view(), name='public-ticket-detail'),
    path('tickets/<uuid:access_token>/reply/', PublicTicketReplyView.as_view(), name='public-ticket-reply'),
]
