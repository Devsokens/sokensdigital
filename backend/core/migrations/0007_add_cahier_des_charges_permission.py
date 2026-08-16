from django.db import migrations

# Corrective, additive backfill: the new 'cahier-des-charges' module
# didn't exist when earlier seed migrations ran. Full access for
# Responsable Marketing, Chef de Projet, Développeur, Super-Admin — a
# shared Technique + Marketing document, no per-owner restriction.
# No-op for anyone who already customized their role's stored
# permissions through the Utilisateurs & Rôles editor.

ROLES_TO_GRANT = ['Responsable Marketing', 'Chef de Projet', 'Développeur', 'Super-Administrateur']
FULL_ACTIONS = ['voir', 'creer', 'modifier', 'supprimer']


def backfill(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name in ROLES_TO_GRANT:
        role = Role.objects.filter(name=name).first()
        if role and 'cahier-des-charges' not in role.permissions:
            role.permissions = {**role.permissions, 'cahier-des-charges': FULL_ACTIONS}
            role.save(update_fields=['permissions'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_add_clients_permission'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
