from django.urls import path
from rest_framework.routers import DefaultRouter

from finance.views import (
    AccountingPeriodViewSet,
    AccountViewSet,
    BankStatementImportViewSet,
    DisbursementRequestViewSet,
    InvoiceViewSet,
    JournalEntryViewSet,
    TaxDeclarationViewSet,
    fec_export,
    finance_dashboard,
)

router = DefaultRouter()
router.register('disbursement-requests', DisbursementRequestViewSet, basename='disbursement-request')
router.register('accounting-periods', AccountingPeriodViewSet, basename='accounting-period')
router.register('accounts', AccountViewSet, basename='account')
router.register('journal-entries', JournalEntryViewSet, basename='journal-entry')
router.register('invoices', InvoiceViewSet, basename='invoice')
router.register('bank-imports', BankStatementImportViewSet, basename='bank-import')
router.register('tax-declarations', TaxDeclarationViewSet, basename='tax-declaration')

urlpatterns = router.urls + [
    path('accounting-periods/<uuid:period_id>/fec-export/', fec_export, name='fec-export'),
    path('dashboard/', finance_dashboard, name='finance-dashboard'),
]
