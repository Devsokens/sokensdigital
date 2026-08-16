from django.urls import path, include
from rest_framework.routers import DefaultRouter
from procurement.views import (
    SupplierViewSet,
    ProcurementRequestViewSet,
    SupplierQuoteViewSet,
    SupplierInvoiceViewSet,
)

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'procurements', ProcurementRequestViewSet, basename='procurement-request')
router.register(r'quotes', SupplierQuoteViewSet, basename='supplier-quote')
router.register(r'invoices', SupplierInvoiceViewSet, basename='supplier-invoice')

app_name = 'procurement'

urlpatterns = [
    path('', include(router.urls)),
]
