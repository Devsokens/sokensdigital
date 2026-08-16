from django.db import migrations

# Corrective, additive backfill: the new 'clients' module (CRM, cahier des
# charges §4.5 — le backend existait déjà dans l'app administration, seul
# le frontend manquait) n'existait pas quand 0003/0004/0005 ont tourné.
# No-op pour quiconque a déjà personnalisé ses permissions stockées via
# l'éditeur Utilisateurs & Rôles — ceci n'ajoute que la clé manquante.

GRANTS = {
    'Super-Administrateur': ['voir', 'creer', 'modifier', 'supprimer'],
    'Administrateur': ['voir', 'creer', 'modifier', 'supprimer'],
    'Commercial': ['voir', 'creer', 'modifier'],
    'Chef de Projet': ['voir'],
    'Support Client': ['voir'],
}


def backfill(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for name, actions in GRANTS.items():
        role = Role.objects.filter(name=name).first()
        if role and 'clients' not in role.permissions:
            role.permissions = {**role.permissions, 'clients': actions}
            role.save(update_fields=['permissions'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_add_parametres_permission'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
