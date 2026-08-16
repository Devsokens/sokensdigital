from django.db import migrations

# Cahier des charges §4.11 "Gestion des Départements" — les quatre
# départements opérationnels (l'"Entreprise" décrite dans le même
# paragraphe désigne le salon de messagerie qui s'adresse à tout le monde,
# pas une unité RH avec des membres, donc pas de ligne Department pour elle).
DEFAULT_DEPARTMENTS = [
    ('Comptabilité / Fiscalité', '#fcd34d'),
    ('Administration', '#7dd3fc'),
    ('Techniques', '#5eead4'),
    ('Marketing / Communication', '#a5b4fc'),
]


def seed_departments(apps, schema_editor):
    Department = apps.get_model('core', 'Department')
    for name, color in DEFAULT_DEPARTMENTS:
        Department.objects.get_or_create(name=name, defaults={'color': color})


def noop_reverse(apps, schema_editor):
    # Deliberately not deleting on reverse — a department created here may
    # already have members/projects attached by the time someone reverses
    # this migration, and silently cascading that away would be far worse
    # than leaving a few rows behind.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_departments, noop_reverse),
    ]
