from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.accounts import AccountDeletionError, delete_platform_account
from core.permissions import has_role
from core.constants import ROLE_RH_MANAGER, ROLE_SUPER_ADMIN
from hr.models import EmployeeProfile
from hr.serializers import (
    ContractSerializer,
    EmployeeProfileSelfSerializer,
    EmployeeProfileSerializer,
    PayslipSerializer,
)

# Every use of this tuple in this file is a straight permission gate (never
# reused for "not X" business-logic branching), so ROLE_SUPER_ADMIN can live
# here once instead of being repeated at each call site — cahier des
# charges §4.8: "Super-Administrateur : accès complet à l'ensemble du système".
HR_MANAGER_ROLES = (ROLE_SUPER_ADMIN, ROLE_RH_MANAGER)


class IsHRManagerOrOwnReadOnly(permissions.BasePermission):
    """HR managers get full CRUD. Everyone else may only read their own
    EmployeeProfile (and nothing else's) — see docs/backend-specifications.md
    §4 "Collaborateur standard"."""

    def has_permission(self, request, view):
        if request.method not in permissions.SAFE_METHODS:
            return has_role(request.user, *HR_MANAGER_ROLES)
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if has_role(request.user, *HR_MANAGER_ROLES):
            return True
        return request.method in permissions.SAFE_METHODS and obj.user_id == request.user.id


@extend_schema_view(
    list=extend_schema(tags=['Administration & RH'], summary='List employee profiles', description='HR sees everyone; other roles see only their own record.'),
    create=extend_schema(tags=['Administration & RH'], summary='Create an employee profile', description='Restricted to Super-Admin/Responsable RH.'),
    retrieve=extend_schema(tags=['Administration & RH'], summary='Get an employee profile'),
    update=extend_schema(tags=['Administration & RH'], summary='Update an employee profile'),
    partial_update=extend_schema(tags=['Administration & RH'], summary='Partially update an employee profile'),
    destroy=extend_schema(tags=['Administration & RH'], summary='Delete an employee profile'),
)
class EmployeeProfileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsHRManagerOrOwnReadOnly]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return EmployeeProfile.objects.none()
        qs = EmployeeProfile.objects.select_related('user').prefetch_related('contracts', 'payslips')
        if has_role(self.request.user, *HR_MANAGER_ROLES):
            return qs
        return qs.filter(user=self.request.user)

    def get_serializer_class(self):
        if has_role(self.request.user, *HR_MANAGER_ROLES):
            return EmployeeProfileSerializer
        return EmployeeProfileSelfSerializer

    def destroy(self, request, *args, **kwargs):
        """Supprimer un employé supprime aussi son compte utilisateur
        (core.accounts) — l'inverse n'est pas vrai : supprimer un compte
        laisse la fiche employé en place."""
        employee = self.get_object()
        user = employee.user
        if user.pk == request.user.pk:
            return Response(
                {'detail': 'Vous ne pouvez pas supprimer votre propre fiche employé.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Supprimer un employé coupe son accès : seul un Super-Admin peut
        # le faire pour un autre Super-Admin.
        if has_role(user, ROLE_SUPER_ADMIN) and not has_role(request.user, ROLE_SUPER_ADMIN):
            return Response(
                {'detail': "Seul un Super-Admin peut supprimer la fiche d'un Super-Admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Compte d'abord : si la connexion ne peut pas être coupée, la fiche
        # reste en place plutôt que de laisser un accès sans employé.
        try:
            delete_platform_account(user, actor=request.user, ip_address=request.META.get('REMOTE_ADDR'))
        except AccountDeletionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        employee.delete(user=request.user, ip_address=request.META.get('REMOTE_ADDR'))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=['Administration & RH'], summary='Add a contract for this employee', request=ContractSerializer, responses={201: ContractSerializer})
    @action(detail=True, methods=['post'], url_path='contracts', permission_classes=[permissions.IsAuthenticated])
    def add_contract(self, request, pk=None):
        if not has_role(request.user, *HR_MANAGER_ROLES):
            return Response(status=status.HTTP_403_FORBIDDEN)
        employee = self.get_object()
        serializer = ContractSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(employee=employee)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=['Administration & RH'], summary='Add a payslip for this employee', request=PayslipSerializer, responses={201: PayslipSerializer})
    @action(detail=True, methods=['post'], url_path='payslips', permission_classes=[permissions.IsAuthenticated])
    def add_payslip(self, request, pk=None):
        if not has_role(request.user, *HR_MANAGER_ROLES):
            return Response(status=status.HTTP_403_FORBIDDEN)
        employee = self.get_object()
        serializer = PayslipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(employee=employee)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
