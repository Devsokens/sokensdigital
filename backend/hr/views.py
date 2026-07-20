from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import has_role
from hr.models import EmployeeProfile
from hr.serializers import (
    ContractSerializer,
    EmployeeProfileSelfSerializer,
    EmployeeProfileSerializer,
    PayslipSerializer,
)

HR_MANAGER_ROLES = ('RESPONSABLE_RH',)


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
