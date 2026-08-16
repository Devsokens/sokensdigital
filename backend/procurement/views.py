from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from procurement.models import (
    Supplier,
    ProcurementRequest,
    SupplierQuote,
    CashVoucher,
    SupplierInvoice,
)
from procurement.serializers import (
    SupplierSerializer,
    ProcurementRequestSerializer,
    SupplierQuoteSerializer,
    CashVoucherSerializer,
    SupplierInvoiceSerializer,
)
from core.constants import (
    ROLE_DIRECTEUR_FINANCIER,
    ROLE_MANAGER_GENERAL,
    ROLE_MANAGER_RCF,
    ROLE_SUPER_ADMIN,
)


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
        if procurement.status != ProcurementRequest.Status.PENDING_RCF:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.PENDING_MANAGER
        procurement.rcf_approved_by = request.user
        procurement.rcf_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject_rcf(self, request, pk=None):
        """RCF reject."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.PENDING_RCF:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.REJECTED
        procurement.rejection_reason = request.data.get('reason', '')
        procurement.rcf_approved_by = request.user
        procurement.rcf_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def approve_manager(self, request, pk=None):
        """Manager (Gérant) validation."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.PENDING_MANAGER:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.APPROVED
        procurement.manager_approved_by = request.user
        procurement.manager_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject_manager(self, request, pk=None):
        """Manager reject."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.PENDING_MANAGER:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        procurement.status = ProcurementRequest.Status.REJECTED
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
        if quote.status != SupplierQuote.Status.PENDING:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        quote.rcf_validated_by = request.user
        quote.rcf_validated_at = timezone.now()
        quote.save()

        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def validate_manager(self, request, pk=None):
        """Manager validation."""
        quote = self.get_object()
        if quote.status != SupplierQuote.Status.PENDING:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        quote.status = SupplierQuote.Status.VALIDATED
        quote.manager_validated_by = request.user
        quote.manager_validated_at = timezone.now()
        quote.save()

        # Signal: créer DisbursementRequest (voir signals.py)
        # post_save signal sur SupplierQuote.validated déclenche creation

        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject(self, request, pk=None):
        """Reject quote."""
        quote = self.get_object()
        quote.status = SupplierQuote.Status.REJECTED
        quote.save()

        return Response(self.get_serializer(quote).data)


class CashVoucherViewSet(viewsets.ModelViewSet):
    """Pièces de caisse."""
    queryset = CashVoucher.objects.all()
    serializer_class = CashVoucherSerializer
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]
    filterset_fields = ['type', 'date']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        """Mark voucher as reconciled."""
        voucher = self.get_object()
        voucher.reconciled_by = request.user
        voucher.reconciled_at = timezone.now()
        voucher.save()

        return Response(self.get_serializer(voucher).data)


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
        if invoice.status != SupplierInvoice.Status.RECEIVED:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            invoice.status = SupplierInvoice.Status.VALIDATED
            invoice.validated_by = request.user
            invoice.validated_at = timezone.now()
            invoice.save()

            # Signal post_save crée JournalEntry (voir signals.py)
            # Débit Achats 60x / Débit TVA 4456 / Crédit Fournisseur 401

        return Response(self.get_serializer(invoice).data)
