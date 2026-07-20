from django.contrib import admin

from hr.models import Contract, EmployeeProfile, Payslip


class ContractInline(admin.TabularInline):
    model = Contract
    extra = 0


class PayslipInline(admin.TabularInline):
    model = Payslip
    extra = 0


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'position', 'status', 'hire_date', 'base_hourly_cost')
    list_filter = ('status',)
    search_fields = ('user__first_name', 'user__last_name', 'position')
    inlines = [ContractInline, PayslipInline]
