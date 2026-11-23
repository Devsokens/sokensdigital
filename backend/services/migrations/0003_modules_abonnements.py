"""Droits de menu des abonnements : ajoute les modules
abonnements-communication / abonnements-maintenance aux rôles existants
(sans toucher aux autres modules déjà réglés depuis l'interface)."""
from django.db import migrations

GRANTS = {
    'Super-Administrateur': {'abonnements-communication': 'full', 'abonnements-maintenance': 'full'},
    'Responsable Marketing & Communication': {'abonnements-communication': 'full'},
    'Responsable Technique': {'abonnements-maintenance': 'full'},
    'Responsable des Opérations': {'abonnements-maintenance': 'full'},
    'Commercial': {'abonnements-communication': 'read'},
    'Comptable': {'abonnements-communication': 'read', 'abonnements-maintenance': 'read'},
}
FULL = ['voir', 'creer', 'modifier', 'supprimer']


def forwards(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name, modules in GRANTS.items():
        role = Role.objects.filter(name=name).first()
        if not role:
            continue
        perms = dict(role.permissions or {})
        for key, level in modules.items():
            perms.setdefault(key, list(FULL) if level == 'full' else ['voir'])
        role.permissions = perms
        role.save(update_fields=['permissions'])


class Migration(migrations.Migration):
    dependencies = [('services', '0002_grille_tarifaire'), ('core', '0022_referentiel_roles_2026')]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
