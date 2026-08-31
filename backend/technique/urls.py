from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet, ProjectPhaseViewSet, ProjectDocumentViewSet,
    TaskViewSet, TimeEntryViewSet, TicketViewSet, KnowledgeBaseViewSet
)
from .maintenance_views import (
    MaintainedAppViewSet, MaintenanceReportViewSet, MaintenanceServiceAccountViewSet,
)

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'tickets', TicketViewSet, basename='ticket')
router.register(r'knowledge-base', KnowledgeBaseViewSet, basename='knowledgebase')
router.register(r'maintenance/apps', MaintainedAppViewSet, basename='maintained-app')
router.register(r'maintenance/service-accounts', MaintenanceServiceAccountViewSet, basename='maintenance-service-account')
router.register(r'maintenance/reports', MaintenanceReportViewSet, basename='maintenance-report')

urlpatterns = [
    path('', include(router.urls)),
    path('projects/<uuid:project_pk>/phases/', ProjectPhaseViewSet.as_view({'get': 'list', 'post': 'create'}), name='project-phases-list'),
    path('projects/<uuid:project_pk>/phases/<uuid:pk>/', ProjectPhaseViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='project-phases-detail'),
    
    path('projects/<uuid:project_pk>/documents/', ProjectDocumentViewSet.as_view({'get': 'list', 'post': 'create'}), name='project-documents-list'),
    path('projects/<uuid:project_pk>/documents/<uuid:pk>/', ProjectDocumentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='project-documents-detail'),
    
    path('projects/<uuid:project_pk>/tasks/', TaskViewSet.as_view({'get': 'list', 'post': 'create'}), name='project-tasks-list'),
    path('projects/<uuid:project_pk>/tasks/<uuid:pk>/', TaskViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='project-tasks-detail'),

    path('tasks/<uuid:task_pk>/time-entries/', TimeEntryViewSet.as_view({'get': 'list', 'post': 'create'}), name='task-timeentries-list'),
    path('tasks/<uuid:task_pk>/time-entries/<uuid:pk>/', TimeEntryViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='task-timeentries-detail'),
]
