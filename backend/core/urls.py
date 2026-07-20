from django.urls import path
from rest_framework.routers import DefaultRouter

from core.views import DepartmentViewSet, MeView, ProvisionUserView, UserListView, health_check

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('users', UserListView, basename='user')

# Feature endpoints get added here as they're built, one at a time.
urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('users/provision/', ProvisionUserView.as_view(), name='provision-user'),
] + router.urls
