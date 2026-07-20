from django.contrib import admin

from marketing.models import Lead


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'company_name', 'email', 'status', 'assigned_to', 'created_at')
    list_filter = ('status', 'source')
    search_fields = ('first_name', 'last_name', 'company_name', 'email')
