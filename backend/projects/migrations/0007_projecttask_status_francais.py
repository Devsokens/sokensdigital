# Harmonise ProjectTask.Status en français (TODO/IN_PROGRESS/IN_REVIEW/DONE
# -> A_FAIRE/EN_COURS/EN_REVISION/TERMINE), cohérence avec le reste de l'app
# (demande explicite : tous les status de l'app en français).
# RunPython traduit les valeurs déjà en base — ce champ est en production
# potentielle contrairement à procurement/treasury (jamais déployés).

from django.db import migrations, models


def forwards_translate_status(apps, schema_editor):
    ProjectTask = apps.get_model('projects', 'ProjectTask')
    mapping = {
        'TODO': 'A_FAIRE',
        'IN_PROGRESS': 'EN_COURS',
        'IN_REVIEW': 'EN_REVISION',
        'DONE': 'TERMINE',
    }
    for old, new in mapping.items():
        ProjectTask.objects.filter(status=old).update(status=new)


def backwards_translate_status(apps, schema_editor):
    ProjectTask = apps.get_model('projects', 'ProjectTask')
    mapping = {
        'A_FAIRE': 'TODO',
        'EN_COURS': 'IN_PROGRESS',
        'EN_REVISION': 'IN_REVIEW',
        'TERMINE': 'DONE',
    }
    for old, new in mapping.items():
        ProjectTask.objects.filter(status=old).update(status=new)


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0006_remove_timesheet_unique_timesheet_per_day_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards_translate_status, backwards_translate_status),
        migrations.AlterField(
            model_name='projecttask',
            name='status',
            field=models.CharField(
                choices=[('A_FAIRE', 'À faire'), ('EN_COURS', 'En cours'), ('EN_REVISION', 'En révision'), ('TERMINE', 'Terminé')],
                default='A_FAIRE', max_length=20,
            ),
        ),
    ]
