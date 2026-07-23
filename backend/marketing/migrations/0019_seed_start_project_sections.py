from django.db import migrations

SECTIONS = [
    {
        'section_key': 'start_project_objectifs',
        'order': 0,
        'title': 'Objectif du Projet',
        'items': [
            {'icon': 'rocket', 'title': 'Transformation Digitale', 'description': "Modernisez vos processus internes et votre stack technologique."},
            {'icon': 'square-terminal', 'title': 'Logiciel Sur-Mesure', 'description': "Conception et développement d'applications critiques hautes performances."},
            {'icon': 'shield', 'title': 'Audit Cybersécurité', 'description': "Évaluation des vulnérabilités et renforcement de l'infrastructure."},
        ],
    },
    {
        'section_key': 'start_project_solutions',
        'order': 1,
        'title': 'Type de Solution',
        'items': [
            {'label': 'Développement Web'},
            {'label': 'Application Mobile'},
            {'label': 'Logiciel Sur-Mesure'},
            {'label': 'Infrastructure Cloud'},
            {'label': 'Audit Cybersécurité'},
            {'label': 'Autre'},
        ],
    },
    {
        'section_key': 'start_project_delais',
        'order': 2,
        'title': 'Délai souhaité pour le lancement',
        'items': [
            {'title': 'Express', 'subtitle': "Moins d'un mois"},
            {'title': 'Standard', 'subtitle': '2 à 3 mois'},
            {'title': 'Étendue', 'subtitle': 'Plus de 4 mois'},
        ],
    },
    {
        'section_key': 'start_project_canaux',
        'order': 3,
        'title': 'Canal de communication privilégié',
        'items': [
            {'icon': 'mail', 'label': 'Email'},
            {'icon': 'video', 'label': 'Vidéo'},
            {'icon': 'message-square', 'label': 'Slack'},
            {'icon': 'phone', 'label': 'Appel'},
        ],
    },
]


def seed_sections(apps, schema_editor):
    PageSection = apps.get_model('marketing', 'PageSection')
    for data in SECTIONS:
        PageSection.objects.update_or_create(
            page='DEMARRER_PROJET', section_key=data['section_key'],
            defaults={'order': data['order'], 'title': data['title'], 'items': data['items']},
        )


def remove_sections(apps, schema_editor):
    PageSection = apps.get_model('marketing', 'PageSection')
    PageSection.objects.filter(page='DEMARRER_PROJET').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0018_remove_sitesettings_nav_links_alter_pagesection_page_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_sections, remove_sections),
    ]
