from django.urls import path
from rest_framework.routers import DefaultRouter

from core.analytics_views import MarketingAnalyticsView, TechniqueAnalyticsView
from core.attachment_views import DocumentAttachmentViewSet
from core.email_template_views import EmailTemplateDetailView, EmailTemplateListView
from core.views import (
    AuditLogViewSet,
    AvatarUploadView,
    ChatAttachmentUploadView,
    DeactivateUserView,
    DepartmentViewSet,
    MeView,
    ProvisionUserView,
    PushDeviceView,
    TestNotificationView,
    RoleViewSet,
    SetUserPasswordView,
    SetUserPermissionsView,
    SetUserRoleView,
    UserListView,
    global_dashboard,
    global_search,
    health_check,
)

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('users', UserListView, basename='user')
router.register('audit-logs', AuditLogViewSet, basename='audit-log')
router.register('roles', RoleViewSet, basename='role')
router.register('attachments', DocumentAttachmentViewSet, basename='attachment')

# Feature endpoints get added here as they're built, one at a time.
urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('search/', global_search, name='global-search'),
    path('dashboard/', global_dashboard, name='global-dashboard'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('uploads/avatar/', AvatarUploadView.as_view(), name='upload-avatar'),
    path('uploads/chat-attachment/', ChatAttachmentUploadView.as_view(), name='upload-chat-attachment'),
    path('users/provision/', ProvisionUserView.as_view(), name='provision-user'),
    path('push/devices/', PushDeviceView.as_view(), name='push-devices'),
    path('notifications/test/', TestNotificationView.as_view(), name='test-notification'),
    path('users/<uuid:pk>/role/', SetUserRoleView.as_view(), name='set-user-role'),
    path('users/<uuid:pk>/permissions/', SetUserPermissionsView.as_view(), name='set-user-permissions'),
    path('users/<uuid:pk>/set-password/', SetUserPasswordView.as_view(), name='set-user-password'),
    path('users/<uuid:pk>/deactivate/', DeactivateUserView.as_view(), name='deactivate-user'),
    path('analytics/marketing/', MarketingAnalyticsView.as_view(), name='analytics-marketing'),
    path('analytics/technique/', TechniqueAnalyticsView.as_view(), name='analytics-technique'),
    path('email-templates/', EmailTemplateListView.as_view(), name='email-templates'),
    path('email-templates/<str:key>/', EmailTemplateDetailView.as_view(), name='email-template-detail'),
] + router.urls
