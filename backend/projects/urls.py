from django.urls import path
from rest_framework.routers import DefaultRouter

from projects.views import ProjectViewSet, TeamTimesheetDayActionView, TeamTimesheetView

router = DefaultRouter()
router.register('', ProjectViewSet, basename='project')

urlpatterns = [
    path('timesheets/team/', TeamTimesheetView.as_view(), name='team-timesheets'),
    path('timesheets/team/day-status/', TeamTimesheetDayActionView.as_view(), name='team-timesheets-day-status'),
] + router.urls
