from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClientViewSet, ContactViewSet, ClientInteractionViewSet, ClientDocumentViewSet,
    EmployeeDocumentViewSet, LeaveRequestViewSet, CompanyAssetViewSet,
    AdministrativeRecordViewSet, ContractGeneratorViewSet, SignatureWebhookView,
    PayrollValidationView,
)

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'employee-documents', EmployeeDocumentViewSet, basename='employee-document')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leave-request')
router.register(r'company-assets', CompanyAssetViewSet, basename='company-asset')
router.register(r'administrative-records', AdministrativeRecordViewSet, basename='administrative-record')
router.register(r'contracts', ContractGeneratorViewSet, basename='contract')

urlpatterns = [
    path('', include(router.urls)),
    path('clients/<uuid:client_pk>/contacts/', ContactViewSet.as_view({'get': 'list', 'post': 'create'}), name='client-contacts-list'),
    path('clients/<uuid:client_pk>/contacts/<uuid:pk>/', ContactViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='client-contacts-detail'),
    path('clients/<uuid:client_pk>/interactions/', ClientInteractionViewSet.as_view({'get': 'list', 'post': 'create'}), name='client-interactions-list'),
    path('clients/<uuid:client_pk>/interactions/<uuid:pk>/', ClientInteractionViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='client-interactions-detail'),
    path('clients/<uuid:client_pk>/documents/', ClientDocumentViewSet.as_view({'get': 'list', 'post': 'create'}), name='client-documents-list'),
    path('clients/<uuid:client_pk>/documents/<uuid:pk>/', ClientDocumentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='client-documents-detail'),
    path('webhooks/signature/', SignatureWebhookView.as_view(), name='signature-webhook'),
    path('rh/payroll/validate/', PayrollValidationView.as_view(), name='payroll-validate'),
]
