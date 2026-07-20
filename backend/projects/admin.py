from django.contrib import admin

from projects.models import Project, ProjectMember, Timesheet


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'lead_project_manager', 'start_date', 'end_date')
    list_filter = ('status',)
    search_fields = ('name',)
    inlines = [ProjectMemberInline]


@admin.register(Timesheet)
class TimesheetAdmin(admin.ModelAdmin):
    list_display = ('project', 'user', 'date', 'hours', 'status')
    list_filter = ('status',)
    search_fields = ('project__name', 'user__first_name', 'user__last_name')
