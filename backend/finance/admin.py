from django.contrib import admin

from finance.models import DisbursementRequest


@admin.register(DisbursementRequest)
class DisbursementRequestAdmin(admin.ModelAdmin):
    list_display = ('beneficiary', 'amount', 'status', 'project', 'requested_by', 'created_at')
    list_filter = ('status',)
    search_fields = ('beneficiary', 'reason')
