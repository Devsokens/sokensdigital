from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, Department, AuditLog


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Adapted for our email-based custom User (no `username` field).
    Application role isn't here — it's set on the Firestore profile doc,
    not this Django model (see core/permissions.py)."""

    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name', 'firebase_uid')
    readonly_fields = ('id', 'created_at', 'updated_at', 'last_login')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Identité', {'fields': ('first_name', 'last_name', 'phone', 'avatar_url')}),
        ('Organisation', {'fields': ('department',)}),
        (
            'Permissions',
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'mfa_enabled',
                    'groups',
                    'user_permissions',
                )
            },
        ),
        ('Firebase', {'fields': ('firebase_uid',)}),
        ('Dates', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'password1', 'password2'),
            },
        ),
    )
    filter_horizontal = ('groups', 'user_permissions')


admin.site.register(Department)
admin.site.register(AuditLog)
