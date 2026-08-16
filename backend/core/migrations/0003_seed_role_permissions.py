from django.db import migrations

from core.constants import DEFAULT_ROLE_PERMISSIONS


def seed_role_permissions(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name, perms in DEFAULT_ROLE_PERMISSIONS.items():
        role, created = Role.objects.get_or_create(name=name, defaults={'permissions': perms})
        # Role rows created before this feature existed (e.g. via
        # _give_role()/manual provisioning) have permissions={} — backfill
        # those, but never overwrite a role someone has already customized
        # through the Utilisateurs & Rôles editor.
        if not created and not role.permissions:
            role.permissions = perms
            role.save(update_fields=['permissions'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_seed_default_departments'),
    ]

    operations = [
        migrations.RunPython(seed_role_permissions, noop_reverse),
    ]
