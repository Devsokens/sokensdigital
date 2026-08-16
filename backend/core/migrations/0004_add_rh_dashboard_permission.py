from django.db import migrations

# Corrective, additive backfill on top of 0003_seed_role_permissions:
# - adds the 'rh-dashboard' module (didn't exist yet when 0003 ran) to the
#   roles that should see it
# - removes 'departements' from Responsable RH — declared there by mistake
#   in 0003; DepartmentViewSet is Super-Admin-only on the backend, so a
#   role with only read access there would get a nav item that 403s.
# Both are no-ops for anyone who already customized their role's
# permissions through the Utilisateurs & Rôles editor since 0003 ran —
# this only ADDS the missing key / removes the specific stale one, it
# doesn't reset the whole dict.

ROLES_TO_GRANT_RH_DASHBOARD = ['Super-Administrateur', 'Responsable RH']


def backfill(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name in ROLES_TO_GRANT_RH_DASHBOARD:
        role = Role.objects.filter(name=name).first()
        if role and 'rh-dashboard' not in role.permissions:
            role.permissions = {**role.permissions, 'rh-dashboard': ['voir']}
            role.save(update_fields=['permissions'])

    rh_role = Role.objects.filter(name='Responsable RH').first()
    if rh_role and 'departements' in rh_role.permissions:
        permissions = dict(rh_role.permissions)
        del permissions['departements']
        rh_role.permissions = permissions
        rh_role.save(update_fields=['permissions'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_seed_role_permissions'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
