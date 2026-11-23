from django.urls import include, path
from rest_framework.routers import DefaultRouter

from services.views import (
    DeliverableViewSet, ServiceOfferViewSet, ServicePeriodViewSet, SubscriptionViewSet, services_dashboard,
)

router = DefaultRouter()
router.register('offers', ServiceOfferViewSet, basename='service-offer')
router.register('subscriptions', SubscriptionViewSet, basename='subscription')
router.register('periods', ServicePeriodViewSet, basename='service-period')
router.register('deliverables', DeliverableViewSet, basename='service-deliverable')

urlpatterns = [
    path('dashboard/', services_dashboard, name='services-dashboard'),
    path('', include(router.urls)),
]
