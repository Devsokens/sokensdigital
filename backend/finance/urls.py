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
    encaissements,
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

# Routes imbriquees sous une facture. Ecrites a la main plutot qu'avec un
# routeur imbrique : la version precedente instanciait un DefaultRouter puis
# piochait `urls[0].callback` en esperant que ce soit bien la vue de liste.
# Cela tenait par accident de l'ordre de generation, et le routeur des recus
# n'etait branche nulle part malgre sa declaration.
urlpatterns = router.urls + [
    path('accounting-periods/<uuid:period_id>/fec-export/', fec_export, name='fec-export'),
    path('dashboard/', finance_dashboard, name='finance-dashboard'),
    path('encaissements/', encaissements, name='finance-encaissements'),

    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/payments/$',
            PaymentViewSet.as_view({'get': 'list', 'post': 'create'}),
            name='invoice-payment-list'),
    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/payments/(?P<pk>[^/.]+)/$',
            PaymentViewSet.as_view({'get': 'retrieve'}),
            name='invoice-payment-detail'),
    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/payments/(?P<pk>[^/.]+)/receive/$',
            PaymentViewSet.as_view({'post': 'receive'}),
            name='invoice-payment-receive'),

    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/receipts/$',
            PaymentReceiptViewSet.as_view({'get': 'list'}),
            name='invoice-receipt-list'),
    re_path(r'^invoices/(?P<invoice_id>[^/.]+)/receipts/(?P<pk>[^/.]+)/$',
            PaymentReceiptViewSet.as_view({'get': 'retrieve'}),
            name='invoice-receipt-detail'),
]
