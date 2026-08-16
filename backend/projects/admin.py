from django.contrib import admin

from projects.models import Project, ProjectMember, ProjectTask, Timesheet


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0


class ProjectTaskInline(admin.TabularInline):
    model = ProjectTask
    extra = 0
    fields = ('title', 'status', 'due_date', 'progress')


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'priority', 'category', 'lead_project_manager', 'is_archived', 'start_date', 'end_date')
    list_filter = ('status', 'priority', 'is_archived', 'is_locked')
    search_fields = ('name', 'category')
    inlines = [ProjectMemberInline, ProjectTaskInline]


@admin.register(Timesheet)
class TimesheetAdmin(admin.ModelAdmin):
    list_display = ('project', 'user', 'date', 'hours', 'status')
    list_filter = ('status',)
    search_fields = ('project__name', 'user__first_name', 'user__last_name')
