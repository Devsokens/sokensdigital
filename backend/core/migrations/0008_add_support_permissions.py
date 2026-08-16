from django.db import migrations

# Corrective, additive backfill: the new 'tickets'/'base-connaissances'
# modules (CDC §4.8) didn't exist when earlier seed migrations ran. Full
# access for Support Client, Admin, Super-Admin.
# No-op for anyone who already customized their role's stored permissions
# through the Utilisateurs & Rôles editor.

ROLES_TO_GRANT = ['Support Client', 'Administrateur', 'Super-Administrateur']
MODULES_TO_GRANT = ['tickets', 'base-connaissances']
FULL_ACTIONS = ['voir', 'creer', 'modifier', 'supprimer']


def backfill(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name in ROLES_TO_GRANT:
        role = Role.objects.filter(name=name).first()
        if not role:
            continue
        updated = False
        permissions = {**role.permissions}
        for module_key in MODULES_TO_GRANT:
            if module_key not in permissions:
                permissions[module_key] = FULL_ACTIONS
                updated = True
        if updated:
            role.permissions = permissions
            role.save(update_fields=['permissions'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_add_cahier_des_charges_permission'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
