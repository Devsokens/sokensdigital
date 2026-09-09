"""Référence et jeton de suivi sur Lead.

En trois temps plutôt qu'un `AddField` unique : les deux colonnes sont
`unique`, et les demandes déjà en base recevraient toutes la même chaîne
vide — la contrainte serait refusée dès la première migration en production.
On ajoute donc sans contrainte, on remplit, puis on contraint.
"""

import secrets

from django.db import migrations, models


def fill_tracking_fields(apps, schema_editor):
    Lead = apps.get_model('marketing', 'Lead')

    # Numérotées dans l'ordre de création, pour que les références suivent la
    # chronologie des demandes plutôt que l'ordre arbitraire des UUID.
    counters = {}
    updated = []
    for lead in Lead.objects.order_by('created_at').iterator():
        year = lead.created_at.year
        counters[year] = counters.get(year, 0) + 1
        lead.tracking_reference = f'SKN-{year}-{counters[year]:04d}'
        lead.tracking_token = secrets.token_urlsafe(32)
        updated.append(lead)

    if updated:
        Lead.objects.bulk_update(updated, ['tracking_reference', 'tracking_token'], batch_size=500)


def clear_tracking_fields(apps, schema_editor):
    # Le retour arrière vide les colonnes avant que la contrainte d'unicité
    # ne soit réappliquée par l'opération inverse.
    apps.get_model('marketing', 'Lead').objects.update(tracking_reference='', tracking_token='')


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0028_quote_signature_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='lead',
            name='tracking_reference',
            field=models.CharField(blank=True, db_index=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='lead',
            name='tracking_token',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.RunPython(fill_tracking_fields, clear_tracking_fields),
        migrations.AlterField(
            model_name='lead',
            name='tracking_reference',
            field=models.CharField(blank=True, db_index=True, max_length=20, unique=True),
        ),
        migrations.AlterField(
            model_name='lead',
            name='tracking_token',
            field=models.CharField(blank=True, max_length=64, unique=True),
        ),
    ]
