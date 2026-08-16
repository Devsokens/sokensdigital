from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.http import FileResponse
from datetime import date, timedelta

from treasury.models import CashEntry, BankEntry, CapitalContribution
from treasury.serializers import CashEntrySerializer, BankEntrySerializer, CapitalContributionSerializer
from treasury.pdf import generate_cash_voucher_pdf, generate_cash_register_statement_pdf, generate_disbursement_request_pdf
from core.constants import ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN
from finance.models import DisbursementRequest


class IsFinanceOrAdmin(permissions.BasePermission):
    """Finance staff ou Super Admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.has_role(ROLE_DIRECTEUR_FINANCIER) or request.user.has_role(ROLE_SUPER_ADMIN)


class CashEntryViewSet(viewsets.ModelViewSet):
    """Gestion caisse physique — entrées/sorties espèces."""
    queryset = CashEntry.objects.all()
    serializer_class = CashEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]
    filterset_fields = ['type', 'source', 'date']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsFinanceOrAdmin])
    def reconcile(self, request, pk=None):
        """Marquer pièce caisse comme rapprochée."""
        entry = self.get_object()
        entry.reconciled_by = request.user
        entry.reconciled_at = timezone.now()
        entry.save()

        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        """Télécharger pièce de caisse en PDF."""
        entry = self.get_object()
        pdf_file = generate_cash_voucher_pdf(entry)
        return FileResponse(
            pdf_file,
            as_attachment=True,
            filename=f'{entry.voucher_number}.pdf',
            content_type='application/pdf'
        )


class BankEntryViewSet(viewsets.ModelViewSet):
    """Gestion compte bancaire — entrées/sorties banque."""
    queryset = BankEntry.objects.all()
    serializer_class = BankEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]
    filterset_fields = ['type', 'source', 'date']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        """Marquer mouvement bancaire comme rapproché."""
        entry = self.get_object()
        entry.reconciled_by = request.user
        entry.reconciled_at = timezone.now()
        entry.save()

        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=['post'])
    def match_bank_transaction(self, request, pk=None):
        """Matcher avec BankTransaction (rapprochement CSV import)."""
        entry = self.get_object()
        bank_transaction_id = request.data.get('bank_transaction_id')

        if not bank_transaction_id:
            return Response({'error': 'bank_transaction_id required'}, status=status.HTTP_400_BAD_REQUEST)

        from finance.models import BankTransaction
        try:
            bt = BankTransaction.objects.get(id=bank_transaction_id)
            entry.bank_transaction = bt
            entry.save()
            return Response(self.get_serializer(entry).data)
        except BankTransaction.DoesNotExist:
            return Response({'error': 'BankTransaction not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def export_monthly_statement(self, request):
        """Télécharger état de caisse mensuel (brouillard)."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        # Calculer dates début/fin mois
        from calendar import monthrange
        days_in_month = monthrange(year, month)[1]
        period_start = date(year, month, 1)
        period_end = date(year, month, days_in_month)

        # Récupérer entrées caisse du mois
        cash_entries = CashEntry.objects.filter(
            date__gte=period_start,
            date__lte=period_end
        ).order_by('date')

        cashier_name = request.query_params.get('cashier_name', 'À déterminer')

        pdf_file = generate_cash_register_statement_pdf(period_start, period_end, cash_entries, cashier_name)
        return FileResponse(
            pdf_file,
            as_attachment=True,
            filename=f'EtatCaisse_{year}{month:02d}.pdf',
            content_type='application/pdf'
        )


class CapitalContributionViewSet(viewsets.ModelViewSet):
    """Gestion apports en capital — associés apportent numéraire."""
    queryset = CapitalContribution.objects.all()
    serializer_class = CapitalContributionSerializer
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]
    filterset_fields = ['status', 'contribution_date']
    ordering_fields = ['contribution_date', 'amount']

    @action(detail=True, methods=['post'], permission_classes=[IsFinanceOrAdmin])
    def validate(self, request, pk=None):
        """Finance Director validation des justificatifs."""
        contribution = self.get_object()
        if contribution.status not in [CapitalContribution.Status.BROUILLON, CapitalContribution.Status.DOCUMENTS_TRANSMIS]:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        contribution.status = CapitalContribution.Status.VALIDEE
        contribution.validated_by = request.user
        contribution.validated_at = timezone.now()
        contribution.save()

        # Signal: crée JournalEntry si BankEntry liée
        # (voir signals.py)

        return Response(self.get_serializer(contribution).data)

    @action(detail=True, methods=['post'], permission_classes=[IsFinanceOrAdmin])
    def submit_for_legal_registration(self, request, pk=None):
        """Soumettre pour enregistrement légal."""
        contribution = self.get_object()
        if contribution.status != CapitalContribution.Status.VALIDEE:
            return Response({'error': 'Must be validated first'}, status=status.HTTP_400_BAD_REQUEST)

        contribution.status = CapitalContribution.Status.ENREGISTREE
        contribution.save()

        return Response(self.get_serializer(contribution).data)

    @action(detail=True, methods=['post'], permission_classes=[IsFinanceOrAdmin])
    def post_journal_entry(self, request, pk=None):
        """Poster écriture comptable capital (Banque / Capital)."""
        contribution = self.get_object()
        if contribution.status != CapitalContribution.Status.ENREGISTREE:
            return Response({'error': 'Must be registered legally first'}, status=status.HTTP_400_BAD_REQUEST)

        from treasury.tasks import post_capital_contribution_journal_entry
        post_capital_contribution_journal_entry.delay(str(contribution.id))

        return Response({
            'status': 'Journal entry posting initiated',
            'contribution_id': str(contribution.id)
        })


class DisbursementRequestPDFViewSet(viewsets.ViewSet):
    """Export PDF pour demande de décaissement."""
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Télécharger demande de décaissement en PDF (Finance/Admin only)."""
        disbursement_id = request.query_params.get('id')

        if not disbursement_id:
            return Response({'error': 'id parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Permission_classes=IsFinanceOrAdmin enforced at class level
            # Additional check: scope to requestor or finance staff
            disbursement = DisbursementRequest.objects.get(id=disbursement_id)

            # Only requestor or finance staff can view
            is_requestor = disbursement.requested_by == request.user
            is_finance = request.user.has_role(ROLE_DIRECTEUR_FINANCIER) or request.user.has_role(ROLE_SUPER_ADMIN)

            if not (is_requestor or is_finance):
                return Response({'error': 'Not authorized to view this document'}, status=status.HTTP_403_FORBIDDEN)

            pdf_file = generate_disbursement_request_pdf(disbursement)
            return FileResponse(
                pdf_file,
                as_attachment=True,
                filename=f'Decaissement_{disbursement.id}.pdf',
                content_type='application/pdf'
            )
        except DisbursementRequest.DoesNotExist:
            return Response({'error': 'DisbursementRequest not found'}, status=status.HTTP_404_NOT_FOUND)
