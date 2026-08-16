from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from procurement.models import (
    Supplier,
    ProcurementRequest,
    SupplierQuote,
    SupplierInvoice,
)
from procurement.serializers import (
    SupplierSerializer,
    ProcurementRequestSerializer,
    SupplierQuoteSerializer,
    SupplierInvoiceSerializer,
)
from procurement.tasks import create_disbursement_request_task, post_supplier_invoice_journal_entry
from core.constants import (
    ROLE_DIRECTEUR_FINANCIER,
    ROLE_MANAGER_GENERAL,
    ROLE_MANAGER_RCF,
    ROLE_SUPER_ADMIN,
)
from core.celery_utils import safe_dispatch


class IsFinanceOrAdmin(permissions.BasePermission):
    """Finance staff ou Super Admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.has_role(ROLE_DIRECTEUR_FINANCIER) or request.user.has_role(ROLE_SUPER_ADMIN)


class IsManagerOrAdmin(permissions.BasePermission):
    """Manager (RCF ou Gérant) ou Super Admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.has_role(ROLE_MANAGER_RCF)
            or request.user.has_role(ROLE_MANAGER_GENERAL)
            or request.user.has_role(ROLE_SUPER_ADMIN)
        )


class SupplierViewSet(viewsets.ModelViewSet):
    """Gestion fournisseurs."""
    queryset = Supplier.objects.filter(is_active=True)
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return [IsFinanceOrAdmin()]
        return super().get_permissions()


class ProcurementRequestViewSet(viewsets.ModelViewSet):
    """Fiches besoins — ProcurementRequest."""
    queryset = ProcurementRequest.objects.all()
    serializer_class = ProcurementRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['department', 'status']
    ordering_fields = ['created_at', 'estimated_amount']

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def approve_rcf(self, request, pk=None):
        """RCF validation."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.EN_ATTENTE_RCF:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.EN_ATTENTE_MANAGER
        procurement.rcf_approved_by = request.user
        procurement.rcf_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject_rcf(self, request, pk=None):
        """RCF reject."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.EN_ATTENTE_RCF:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.REJETEE
        procurement.rejection_reason = request.data.get('reason', '')
        procurement.rcf_approved_by = request.user
        procurement.rcf_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def approve_manager(self, request, pk=None):
        """Manager (Gérant) validation."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.EN_ATTENTE_MANAGER:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.APPROUVEE
        procurement.manager_approved_by = request.user
        procurement.manager_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject_manager(self, request, pk=None):
        """Manager reject."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.EN_ATTENTE_MANAGER:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.REJETEE
        procurement.rejection_reason = request.data.get('reason', '')
        procurement.manager_approved_by = request.user
        procurement.manager_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)


class SupplierQuoteViewSet(viewsets.ModelViewSet):
    """Devis fournisseur."""
    queryset = SupplierQuote.objects.all()
    serializer_class = SupplierQuoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['procurement', 'supplier', 'status']

    def get_permissions(self):
        if self.request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return [IsFinanceOrAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def validate_rcf(self, request, pk=None):
        """RCF validation."""
        quote = self.get_object()
        if quote.status != SupplierQuote.Status.EN_ATTENTE:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        quote.rcf_validated_by = request.user
        quote.rcf_validated_at = timezone.now()
        quote.save()

        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def validate_manager(self, request, pk=None):
        """Manager validation."""
        quote = self.get_object()
        if quote.status != SupplierQuote.Status.EN_ATTENTE:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        quote.status = SupplierQuote.Status.VALIDE
        quote.manager_validated_by = request.user
        quote.manager_validated_at = timezone.now()
        quote.save()

        safe_dispatch(create_disbursement_request_task, (str(quote.id),))

        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject(self, request, pk=None):
        """Reject quote."""
        quote = self.get_object()
        quote.status = SupplierQuote.Status.REJETE
        quote.save()

        return Response(self.get_serializer(quote).data)


class SupplierInvoiceViewSet(viewsets.ModelViewSet):
    """Factures fournisseur."""
    queryset = SupplierInvoice.objects.all()
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['supplier', 'procurement', 'status']
    ordering_fields = ['invoice_date', 'due_date', 'amount_ttc']

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsFinanceOrAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsFinanceOrAdmin])
    def validate(self, request, pk=None):
        """Valider facture fournisseur."""
        invoice = self.get_object()
        if invoice.status != SupplierInvoice.Status.RECUE:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            invoice.status = SupplierInvoice.Status.VALIDEE
            invoice.validated_by = request.user
            invoice.validated_at = timezone.now()
            invoice.save()

        safe_dispatch(post_supplier_invoice_journal_entry, (str(invoice.id),))

        return Response(self.get_serializer(invoice).data)
