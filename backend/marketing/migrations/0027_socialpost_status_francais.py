# Harmonise SocialPost.Status en français (DRAFT/SCHEDULED/PUBLISHED/FAILED/
# CANCELLED -> BROUILLON/PROGRAMME/PUBLIE/ECHEC/ANNULE), cohérence avec le
# reste de l'app (demande explicite : tous les status en français).

from django.db import migrations, models


def forwards_translate_status(apps, schema_editor):
    SocialPost = apps.get_model('marketing', 'SocialPost')
    mapping = {
        'DRAFT': 'BROUILLON',
        'SCHEDULED': 'PROGRAMME',
        'PUBLISHED': 'PUBLIE',
        'FAILED': 'ECHEC',
        'CANCELLED': 'ANNULE',
    }
    for old, new in mapping.items():
        SocialPost.objects.filter(status=old).update(status=new)


def backwards_translate_status(apps, schema_editor):
    SocialPost = apps.get_model('marketing', 'SocialPost')
    mapping = {
        'BROUILLON': 'DRAFT',
        'PROGRAMME': 'SCHEDULED',
        'PUBLIE': 'PUBLISHED',
        'ECHEC': 'FAILED',
        'ANNULE': 'CANCELLED',
    }
    for old, new in mapping.items():
        SocialPost.objects.filter(status=old).update(status=new)


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0026_specification_specificationline_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards_translate_status, backwards_translate_status),
        migrations.AlterField(
            model_name='socialpost',
            name='status',
            field=models.CharField(
                choices=[('BROUILLON', 'Brouillon'), ('PROGRAMME', 'Programmé'), ('PUBLIE', 'Publié'), ('ECHEC', 'Échec'), ('ANNULE', 'Annulé')],
                default='BROUILLON', max_length=10,
            ),
        ),
    ]
