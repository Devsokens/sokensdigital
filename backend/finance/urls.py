from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter

from finance.views import (
    AccountingPeriodViewSet,
    AccountViewSet,
    BankStatementImportViewSet,
    DisbursementRequestViewSet,
    InvoiceViewSet,
    JournalEntryViewSet,
    PaymentViewSet,
    PaymentReceiptViewSet,
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

# Nested routes: invoices/{id}/payments/ et invoices/{id}/receipts/
class NestedPaymentRouter:
    def __init__(self):
        self.payment_router = DefaultRouter()
        self.payment_router.register('', PaymentViewSet, basename='payment')

        self.receipt_router = DefaultRouter()
        self.receipt_router.register('', PaymentReceiptViewSet, basename='receipt')

nested_router = NestedPaymentRouter()

urlpatterns = router.urls + [
    path('accounting-periods/<uuid:period_id>/fec-export/', fec_export, name='fec-export'),
    path('dashboard/', finance_dashboard, name='finance-dashboard'),

    # Nested: invoices/{invoice_id}/payments/
    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/payments/$',
            nested_router.payment_router.urls[0].callback if nested_router.payment_router.urls else None,
            name='invoice-payment-list'),
    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/payments/(?P<pk>[^/.]+)/$',
            PaymentViewSet.as_view({'get': 'retrieve', 'post': 'receive'}),
            name='invoice-payment-detail'),
    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/payments/(?P<pk>[^/.]+)/receive/$',
            PaymentViewSet.as_view({'post': 'receive'}),
            name='invoice-payment-receive'),
]
