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
    ROLE_COMPTABLE,
    ROLE_DIRECTEUR_FINANCIER,
    ROLE_SUPER_ADMIN,
)
from core.permissions import has_role
from core.celery_utils import safe_dispatch


class IsFinanceOrAdmin(permissions.BasePermission):
    """Finance staff ou Super Admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # has_role(user, *roles) — fonction libre de core.permissions, PAS
        # une méthode sur User (bug trouvé le 17/08 : `request.user.
        # has_role(...)` n'existe pas sur le modèle, plantait en 500 sur
        # CHAQUE requête — jamais détecté faute de tests sur cette app).
        return has_role(request.user, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN)


class IsManagerOrAdmin(permissions.BasePermission):
    """RCF (Responsable Comptable et Financière).

    Pas de rôle dédié "RCF" dans core.constants.py — même raisonnement que
    DisbursementRequest.Status.EN_ATTENTE_N3 (finance/models.py) : Comptable/
    Directeur Financier tiennent lieu de RCF.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return has_role(request.user, ROLE_COMPTABLE, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN)


class IsGerantOrAdmin(permissions.BasePermission):
    """Gérant/Direction Générale — Super-Admin uniquement.

    Pentest du 24/09/2026 (P3) : cette étape utilisait la même permission
    que l'étape RCF (IsManagerOrAdmin), donc le même Comptable pouvait
    valider les deux paliers du circuit à lui seul — la séparation des
    tâches voulue par le process n'existait pas. Même convention que
    finance._can_decide_stage pour DisbursementRequest.Status.
    EN_ATTENTE_GERANT : seul le Gérant (Super-Admin) statue en dernier
    ressort, jamais la RCF elle-même.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return has_role(request.user, ROLE_SUPER_ADMIN)


class IsOwnerOrFinanceOrAdmin(permissions.BasePermission):
    """Le demandeur d'une fiche non encore approuvée, ou Finance/Admin.

    Pentest du 24/09/2026 (P2) : sans ce contrôle, n'importe quel utilisateur
    authentifié pouvait PATCHer la fiche de quelqu'un d'autre (gonfler le
    montant, par exemple) — seul le statut APPROUVEE était protégé, pas
    l'appartenance de la fiche elle-même.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.requested_by_id == request.user.id or has_role(
            request.user, ROLE_COMPTABLE, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN,
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
    # select_related : le serializer traverse 4 FK par ligne (requested_by,
    # rcf_approved_by, manager_approved_by, department) — sans ça, une
    # page de 25 lignes coûte ~101 requêtes SQL au lieu d'une seule jointe.
    queryset = ProcurementRequest.objects.select_related(
        'department', 'requested_by', 'rcf_approved_by', 'manager_approved_by',
    )
    serializer_class = ProcurementRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrFinanceOrAdmin]
    filterset_fields = ['department', 'status']
    ordering_fields = ['created_at', 'estimated_amount']

    def perform_create(self, serializer):
        # Statut fixé ici, jamais accepté du client (voir 'status' en
        # read_only dans le serializer) — une fiche entre toujours dans le
        # circuit à la première étape, jamais pré-approuvée.
        serializer.save(requested_by=self.request.user, status=ProcurementRequest.Status.EN_ATTENTE_RCF)

    def _reject_if_approved(self, procurement):
        # Immutabilité une fois approuvée — cf. audit VERIFICATION_STATUT_
        # IMPLEMENTATION_2026-08.md finding #1 : sans ce garde, une fiche
        # déjà approuvée reste éditable (montant, description...) après
        # que le workflow ait déjà avancé dessus.
        if procurement.status == ProcurementRequest.Status.APPROUVEE:
            return Response(
                {'detail': 'Une fiche approuvée ne peut plus être modifiée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        blocked = self._reject_if_approved(self.get_object())
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._reject_if_approved(self.get_object())
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)

    def _reject_if_requester(self, procurement, request):
        # Séparation des tâches (pentest du 24/09/2026, F1 côté finance,
        # même défaut ici) : quelqu'un qui cumule le rôle demandeur et un
        # rôle d'approbation (ex: Comptable qui a lui-même créé la fiche)
        # ne doit jamais pouvoir valider sa propre demande.
        if procurement.requested_by_id == request.user.id:
            return Response(
                {'detail': 'Vous ne pouvez pas approuver votre propre demande.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def approve_rcf(self, request, pk=None):
        """RCF validation."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.EN_ATTENTE_RCF:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        blocked = self._reject_if_requester(procurement, request)
        if blocked:
            return blocked

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

    @action(detail=True, methods=['post'], permission_classes=[IsGerantOrAdmin])
    def approve_manager(self, request, pk=None):
        """Manager (Gérant) validation."""
        procurement = self.get_object()
        if procurement.status != ProcurementRequest.Status.EN_ATTENTE_MANAGER:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        blocked = self._reject_if_requester(procurement, request)
        if blocked:
            return blocked

        procurement.status = ProcurementRequest.Status.APPROUVEE
        procurement.manager_approved_by = request.user
        procurement.manager_approved_at = timezone.now()
        procurement.save()

        return Response(self.get_serializer(procurement).data)

    @action(detail=True, methods=['post'], permission_classes=[IsGerantOrAdmin])
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
    queryset = SupplierQuote.objects.select_related(
        'supplier', 'rcf_validated_by', 'manager_validated_by',
    )
    serializer_class = SupplierQuoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['procurement', 'supplier', 'status']

    def get_permissions(self):
        # Filtré sur l'action CRUD, pas sur la méthode HTTP : un filtre
        # "POST ⇒ IsFinanceOrAdmin" écrasait aussi les permission_classes
        # des @action (validate_rcf/validate_manager/reject, toutes en POST)
        # — le Directeur Financier passait donc les deux paliers de
        # validation, et le Comptable (RCF) n'en passait aucun.
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsFinanceOrAdmin()]
        return super().get_permissions()

    def _reject_if_validated(self, quote):
        # Immutabilité une fois validé — un devis VALIDE a déjà déclenché
        # un DisbursementRequest sur son amount_ttc (safe_dispatch dans
        # validate_manager ci-dessous) ; le laisser éditable désynchronise
        # silencieusement le décaissement déjà créé du montant réel.
        if quote.status == SupplierQuote.Status.VALIDE:
            return Response(
                {'detail': 'Un devis validé ne peut plus être modifié.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        blocked = self._reject_if_validated(self.get_object())
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._reject_if_validated(self.get_object())
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def validate_rcf(self, request, pk=None):
        """RCF validation."""
        quote = self.get_object()
        if quote.status != SupplierQuote.Status.EN_ATTENTE:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        if quote.rcf_validated_at:
            # Pas de réécriture silencieuse de la trace d'audit du 1er palier.
            return Response({'error': 'Devis déjà validé par la RCF.'}, status=status.HTTP_400_BAD_REQUEST)

        quote.rcf_validated_by = request.user
        quote.rcf_validated_at = timezone.now()
        quote.save()

        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=['post'], permission_classes=[IsGerantOrAdmin])
    def validate_manager(self, request, pk=None):
        """Manager (Gérant) validation — second palier, après la RCF.

        Pentest du 24/09/2026 : ce palier était ouvert à IsManagerOrAdmin
        et ne vérifiait pas que validate_rcf avait eu lieu — un Directeur
        Financier validait seul un devis et déclenchait le décaissement.
        Désormais : Gérant/Super-Admin uniquement (même convention que
        ProcurementRequest.approve_manager), RCF préalable obligatoire, et
        jamais la même personne aux deux paliers.
        """
        quote = self.get_object()
        if quote.status != SupplierQuote.Status.EN_ATTENTE:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        if not quote.rcf_validated_at:
            return Response(
                {'error': "Le devis doit d'abord être validé par la RCF."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quote.rcf_validated_by_id == request.user.id:
            return Response(
                {'detail': 'La validation finale doit être faite par une autre personne que la RCF.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Transition conditionnelle atomique : deux requêtes concurrentes
        # ne peuvent pas déclencher deux décaissements.
        updated = SupplierQuote.objects.filter(
            pk=quote.pk, status=SupplierQuote.Status.EN_ATTENTE,
        ).update(
            status=SupplierQuote.Status.VALIDE,
            manager_validated_by=request.user,
            manager_validated_at=timezone.now(),
        )
        if not updated:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        quote.refresh_from_db()

        safe_dispatch(create_disbursement_request_task, (str(quote.id),))

        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def reject(self, request, pk=None):
        """Reject quote."""
        quote = self.get_object()
        if quote.status in (SupplierQuote.Status.VALIDE, SupplierQuote.Status.REJETE):
            # Un devis VALIDE a déjà déclenché son décaissement : le passer
            # REJETE après coup masquerait ce paiement sans l'annuler.
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        quote.status = SupplierQuote.Status.REJETE
        quote.save()

        return Response(self.get_serializer(quote).data)


class SupplierInvoiceViewSet(viewsets.ModelViewSet):
    """Factures fournisseur."""
    queryset = SupplierInvoice.objects.select_related(
        'supplier', 'received_by', 'validated_by',
    )
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['supplier', 'procurement', 'status']
    ordering_fields = ['invoice_date', 'due_date', 'amount_ttc']

    def get_permissions(self):
        # 'POST' ajouté suite au pentest du 24/09/2026 (P6) : la création
        # n'était protégée par aucun rôle, seules les modifications/suppressions
        # l'étaient — n'importe quel utilisateur authentifié pouvait donc
        # créer une facture fournisseur, montant négatif compris.
        if self.request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return [IsFinanceOrAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)

    def _reject_if_finalized(self, invoice):
        # Immutabilité une fois validée/payée — une facture VALIDEE a déjà
        # fait poster un JournalEntry (safe_dispatch dans validate()
        # ci-dessous, qui pousse ensuite le statut à PAYEE) ; l'éditer
        # après coup désynchronise l'écriture comptable déjà en Grand
        # Livre de l'enregistrement source.
        if invoice.status in (SupplierInvoice.Status.VALIDEE, SupplierInvoice.Status.PAYEE):
            return Response(
                {'detail': 'Une facture validée/payée ne peut plus être modifiée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        blocked = self._reject_if_finalized(self.get_object())
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._reject_if_finalized(self.get_object())
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)

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
