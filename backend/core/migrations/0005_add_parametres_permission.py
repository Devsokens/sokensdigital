from django.db import migrations

# Corrective, additive backfill: the new 'parametres' module (Paramètres >
# Réseaux sociaux) didn't exist when 0003/0004 ran. Super-Admin only by
# default — these are live publishing credentials, not editorial content.
# No-op for anyone who already customized Super-Admin's stored permissions
# through the Utilisateurs & Rôles editor — this only adds the missing key.

ROLE_TO_GRANT = 'Super-Administrateur'


def backfill(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    role = Role.objects.filter(name=ROLE_TO_GRANT).first()
    if role and 'parametres' not in role.permissions:
        role.permissions = {**role.permissions, 'parametres': ['voir', 'creer', 'modifier', 'supprimer']}
        role.save(update_fields=['permissions'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_add_rh_dashboard_permission'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
