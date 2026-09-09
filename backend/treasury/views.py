from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.http import FileResponse
from datetime import date, timedelta

from treasury.models import CashEntry, BankEntry, CapitalContribution
from treasury.serializers import CashEntrySerializer, BankEntrySerializer, CapitalContributionSerializer
from treasury.pdf import generate_cash_voucher_pdf, generate_cash_register_statement_pdf, generate_disbursement_request_pdf
from treasury.tasks import post_cash_entry_journal_entry, post_bank_entry_journal_entry, post_capital_contribution_journal_entry
from core.constants import ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN, ROLE_CAISSIER
from core.permissions import has_role
from core.celery_utils import safe_dispatch
from finance.models import DisbursementRequest


class IsFinanceOrAdmin(permissions.BasePermission):
    """Finance staff (Directeur Financier) ou Super Admin — banque/capital."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # has_role(user, *roles) — fonction libre de core.permissions, PAS
        # une méthode sur User (bug trouvé le 17/08 : `request.user.
        # has_role(...)` n'existe pas sur le modèle, plantait en 500 sur
        # CHAQUE requête — jamais détecté faute de tests sur cette app).
        return has_role(request.user, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN)


class IsCaissierFinanceOrAdmin(permissions.BasePermission):
    """Caissier, Directeur Financier ou Super Admin — caisse physique
    uniquement (cf. cahier des charges §3 "opérations de trésorerie" : le
    Caissier tient la caisse, pas le compte bancaire ni le capital)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return has_role(request.user, ROLE_CAISSIER, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN)


class CashEntryViewSet(viewsets.ModelViewSet):
    """Gestion caisse physique — entrées/sorties espèces (pièces de caisse)."""
    queryset = CashEntry.objects.select_related('created_by', 'reconciled_by')
    serializer_class = CashEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsCaissierFinanceOrAdmin]
    filterset_fields = ['type', 'source', 'date']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _reject_if_reconciled(self, entry):
        # Immutabilité une fois rapprochée — reconcile() ci-dessous a déjà
        # fait poster un JournalEntry sur ce montant ; l'éditer après coup
        # désynchronise l'écriture déjà en Grand Livre.
        if entry.reconciled_at is not None:
            return Response(
                {'detail': 'Une pièce de caisse rapprochée ne peut plus être modifiée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        blocked = self._reject_if_reconciled(self.get_object())
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._reject_if_reconciled(self.get_object())
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[IsCaissierFinanceOrAdmin])
    def reconcile(self, request, pk=None):
        """Marquer pièce caisse comme rapprochée + poster l'écriture comptable.

        Déclenché explicitement ici plutôt que via signal post_save : un
        signal sur `created` ne peut jamais voir reconciled_at (posé par un
        second .save(), donc created=False à ce moment-là) — voir audit
        AUDIT_LOGIQUE_METIER_TRESORERIE_2026-08.md §H1.
        """
        entry = self.get_object()
        entry.reconciled_by = request.user
        entry.reconciled_at = timezone.now()
        entry.save()

        safe_dispatch(post_cash_entry_journal_entry, (str(entry.id),))

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

    @action(detail=False, methods=['get'])
    def export_monthly_statement(self, request):
        """Télécharger état de caisse mensuel (brouillard + rapprochement)."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        from calendar import monthrange
        days_in_month = monthrange(year, month)[1]
        period_start = date(year, month, 1)
        period_end = date(year, month, days_in_month)

        cash_entries = CashEntry.objects.filter(
            date__gte=period_start,
            date__lte=period_end
        ).order_by('date')

        cashier_name = request.query_params.get('cashier_name') or request.user.get_full_name()

        pdf_file = generate_cash_register_statement_pdf(period_start, period_end, cash_entries, cashier_name)
        return FileResponse(
            pdf_file,
            as_attachment=True,
            filename=f'EtatCaisse_{year}{month:02d}.pdf',
            content_type='application/pdf'
        )


class BankEntryViewSet(viewsets.ModelViewSet):
    """Gestion compte bancaire — entrées/sorties banque."""
    queryset = BankEntry.objects.select_related('created_by', 'reconciled_by')
    serializer_class = BankEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]
    filterset_fields = ['type', 'source', 'date']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _reject_if_reconciled(self, entry):
        if entry.reconciled_at is not None:
            return Response(
                {'detail': 'Un mouvement bancaire rapproché ne peut plus être modifié.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        blocked = self._reject_if_reconciled(self.get_object())
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._reject_if_reconciled(self.get_object())
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        """Marquer mouvement bancaire comme rapproché + poster l'écriture comptable."""
        entry = self.get_object()
        entry.reconciled_by = request.user
        entry.reconciled_at = timezone.now()
        entry.save()

        safe_dispatch(post_bank_entry_journal_entry, (str(entry.id),))

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


class CapitalContributionViewSet(viewsets.ModelViewSet):
    """Gestion apports en capital — associés apportent numéraire."""
    queryset = CapitalContribution.objects.select_related('validated_by', 'posted_by')
    serializer_class = CapitalContributionSerializer
    permission_classes = [permissions.IsAuthenticated, IsFinanceOrAdmin]
    filterset_fields = ['status', 'contribution_date']
    ordering_fields = ['contribution_date', 'amount']

    def _reject_if_posted(self, contribution):
        if contribution.status == CapitalContribution.Status.COMPTABILISEE:
            return Response(
                {'detail': 'Un apport déjà comptabilisé ne peut plus être modifié.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        blocked = self._reject_if_posted(self.get_object())
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._reject_if_posted(self.get_object())
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)

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

        safe_dispatch(post_capital_contribution_journal_entry, (str(contribution.id),))

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
            is_finance = has_role(request.user, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN)

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
