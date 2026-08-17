from django.urls import path, include
from rest_framework.routers import DefaultRouter
from treasury.views import (
    CashEntryViewSet,
    BankEntryViewSet,
    CapitalContributionViewSet,
    DisbursementRequestPDFViewSet,
)

router = DefaultRouter()
router.register(r'cash-entries', CashEntryViewSet, basename='cash-entry')
router.register(r'bank-entries', BankEntryViewSet, basename='bank-entry')
router.register(r'capital-contributions', CapitalContributionViewSet, basename='capital-contribution')
router.register(r'disbursement-pdf', DisbursementRequestPDFViewSet, basename='disbursement-pdf')

app_name = 'treasury'

urlpatterns = [
    path('', include(router.urls)),
]
