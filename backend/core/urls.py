from django.urls import path
from rest_framework.routers import DefaultRouter

from core.views import (
    AuditLogViewSet,
    AvatarUploadView,
    ChatAttachmentUploadView,
    DepartmentViewSet,
    MeView,
    ProvisionUserView,
    RoleViewSet,
    SetUserRoleView,
    UserListView,
    global_search,
    health_check,
)

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('users', UserListView, basename='user')
router.register('audit-logs', AuditLogViewSet, basename='audit-log')
router.register('roles', RoleViewSet, basename='role')

# Feature endpoints get added here as they're built, one at a time.
urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('search/', global_search, name='global-search'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('uploads/avatar/', AvatarUploadView.as_view(), name='upload-avatar'),
    path('uploads/chat-attachment/', ChatAttachmentUploadView.as_view(), name='upload-chat-attachment'),
    path('users/provision/', ProvisionUserView.as_view(), name='provision-user'),
    path('users/<uuid:pk>/role/', SetUserRoleView.as_view(), name='set-user-role'),
] + router.urls
