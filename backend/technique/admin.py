from django.contrib import admin
from .models import Project, ProjectPhase, ProjectDocument, Task, TimeEntry, Ticket, KnowledgeBase

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'client', 'status', 'budget', 'start_date', 'end_date')
    list_filter = ('status', 'client')
    search_fields = ('name', 'description')

@admin.register(ProjectPhase)
class ProjectPhaseAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'status', 'start_date', 'end_date')
    list_filter = ('status', 'project')
    search_fields = ('name',)

@admin.register(ProjectDocument)
class ProjectDocumentAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'document_type', 'uploaded_by')
    list_filter = ('document_type', 'project')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'status', 'priority', 'assigned_to')
    list_filter = ('status', 'priority', 'project')
    search_fields = ('name',)

@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = ('task', 'user', 'hours', 'date')
    list_filter = ('user', 'date')

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'severity', 'assigned_developer')
    list_filter = ('status', 'severity')
    search_fields = ('title',)

@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'updated_at')
    search_fields = ('title',)
