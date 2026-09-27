from django.db import migrations

# Backfill additif : les modules « Analytique web » (PostHog, décision du
# 14/09/2026) n'existaient pas lors des migrations de seed précédentes.
# Lecture seule — ces écrans ne créent ni ne modifient rien. Sans effet
# pour un rôle dont les permissions ont déjà été personnalisées sur ces clés.

GRANTS = {
    'Super-Administrateur': ['analytique-marketing', 'analytique-technique'],
    'Administrateur': ['analytique-marketing', 'analytique-technique'],
    'Responsable Marketing': ['analytique-marketing'],
    'Commercial': ['analytique-marketing'],
    'Chef de Projet': ['analytique-technique'],
    'Développeur': ['analytique-technique'],
}


def backfill(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name, module_keys in GRANTS.items():
        role = Role.objects.filter(name=name).first()
        if not role:
            continue
        permissions = {**role.permissions}
        missing = [key for key in module_keys if key not in permissions]
        if not missing:
            continue
        for key in missing:
            permissions[key] = ['voir']
        role.permissions = permissions
        role.save(update_fields=['permissions'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_pushdevice'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
