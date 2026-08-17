# Harmonise Task.status/priority et Ticket.status/severity en français
# (BACKLOG/TODO/IN_PROGRESS/REVIEW/DONE, LOW/MEDIUM/HIGH/CRITICAL,
# NEW/ASSIGNED/RESOLVED/CLOSED -> équivalents français), cohérence avec le
# reste de l'app (demande explicite : tous les status en français).

from django.db import migrations, models


TASK_STATUS_MAP = {
    'TODO': 'A_FAIRE',
    'IN_PROGRESS': 'EN_COURS',
    'REVIEW': 'EN_REVISION',
    'DONE': 'TERMINE',
}
PRIORITY_MAP = {
    'LOW': 'BASSE',
    'MEDIUM': 'MOYENNE',
    'HIGH': 'HAUTE',
    'CRITICAL': 'CRITIQUE',
}
TICKET_STATUS_MAP = {
    'NEW': 'NOUVEAU',
    'ASSIGNED': 'ASSIGNE',
    'RESOLVED': 'RESOLU',
    'CLOSED': 'FERME',
}


def forwards(apps, schema_editor):
    Task = apps.get_model('technique', 'Task')
    Ticket = apps.get_model('technique', 'Ticket')
    for old, new in TASK_STATUS_MAP.items():
        Task.objects.filter(status=old).update(status=new)
    for old, new in PRIORITY_MAP.items():
        Task.objects.filter(priority=old).update(priority=new)
    for old, new in TICKET_STATUS_MAP.items():
        Ticket.objects.filter(status=old).update(status=new)
    for old, new in PRIORITY_MAP.items():
        Ticket.objects.filter(severity=old).update(severity=new)


def backwards(apps, schema_editor):
    Task = apps.get_model('technique', 'Task')
    Ticket = apps.get_model('technique', 'Ticket')
    for new, old in TASK_STATUS_MAP.items():
        Task.objects.filter(status=old).update(status=new)
    for new, old in PRIORITY_MAP.items():
        Task.objects.filter(priority=old).update(priority=new)
    for new, old in TICKET_STATUS_MAP.items():
        Ticket.objects.filter(status=old).update(status=new)
    for new, old in PRIORITY_MAP.items():
        Ticket.objects.filter(severity=old).update(severity=new)


class Migration(migrations.Migration):

    dependencies = [
        ('technique', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='task',
            name='status',
            field=models.CharField(
                choices=[('BACKLOG', 'Backlog'), ('A_FAIRE', 'À faire'), ('EN_COURS', 'En cours'), ('EN_REVISION', 'En révision'), ('TERMINE', 'Terminé')],
                default='BACKLOG', max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='task',
            name='priority',
            field=models.CharField(
                choices=[('BASSE', 'Basse'), ('MOYENNE', 'Moyenne'), ('HAUTE', 'Haute'), ('CRITIQUE', 'Critique')],
                default='MOYENNE', max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='ticket',
            name='status',
            field=models.CharField(
                choices=[('NOUVEAU', 'Nouveau'), ('ASSIGNE', 'Assigné'), ('RESOLU', 'Résolu'), ('FERME', 'Fermé')],
                default='NOUVEAU', max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='ticket',
            name='severity',
            field=models.CharField(
                choices=[('BASSE', 'Basse'), ('MOYENNE', 'Moyenne'), ('HAUTE', 'Haute'), ('CRITIQUE', 'Critique')],
                default='MOYENNE', max_length=50,
            ),
        ),
    ]
