from rest_framework.routers import DefaultRouter

from hr.views import EmployeeProfileViewSet

router = DefaultRouter()
router.register('employees', EmployeeProfileViewSet, basename='employee-profile')

urlpatterns = router.urls
