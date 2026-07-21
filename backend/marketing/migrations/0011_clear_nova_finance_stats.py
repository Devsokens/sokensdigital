from django.db import migrations

OLD_STATS = [
    {'value': '-40%', 'label': 'Latence UI'},
    {'value': '12k', 'label': 'Ordres / sec'},
    {'value': '99.95%', 'label': 'Disponibilité'},
]


def clear_stats(apps, schema_editor):
    ShowcaseProject = apps.get_model('marketing', 'ShowcaseProject')
    ShowcaseProject.objects.filter(slug='nova-finance-dashboard').update(stats=[])


def restore_stats(apps, schema_editor):
    ShowcaseProject = apps.get_model('marketing', 'ShowcaseProject')
    ShowcaseProject.objects.filter(slug='nova-finance-dashboard').update(stats=OLD_STATS)


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0010_seed_showcase_projects'),
    ]

    operations = [
        migrations.RunPython(clear_stats, restore_stats),
    ]
