from django.contrib import admin
from .models import (
    Client, ClientInteraction, ClientDocument, EmployeeDocument,
    LeaveRequest, CompanyAsset, AdministrativeRecord, ContractGenerator
)

admin.site.register(Client)
admin.site.register(ClientInteraction)
admin.site.register(ClientDocument)
admin.site.register(EmployeeDocument)
admin.site.register(LeaveRequest)
admin.site.register(CompanyAsset)
admin.site.register(AdministrativeRecord)
admin.site.register(ContractGenerator)
