from django.db import migrations

# Exact current copy from the frontend's hardcoded components
# (components/sections/expertise/*.tsx, components/sections/tracking/*.tsx)
# — seeded here so switching those pages over to this API is a visual no-op.
EXPERTISE_SECTIONS = [
    {
        'section_key': 'expertise_hero',
        'order': 0,
        'kicker': 'Digital Excellence',
        'title': 'Solutions Digitales Sur Mesure',
        'subtitle': (
            "Propulsez votre entreprise vers l'avenir avec des infrastructures logicielles "
            'de haute précision. Nous concevons des écosystèmes scalables, sécurisés et '
            'centrés sur la performance pour les leaders de demain.'
        ),
        'cta_label': 'Démarrer un projet',
        'cta_link': '/demarrer-un-projet',
        'items': [{'label': 'Architecture High-Load', 'sublabel': 'Précision Sans Compromis'}],
    },
    {
        'section_key': 'strategic_advantages',
        'order': 1,
        'title': 'Avantages Stratégiques',
        'subtitle': "L'ingénierie logicielle au service de votre croissance, avec un accent mis sur la robustesse et la rapidité d'exécution.",
        'items': [
            {'icon': 'shield-check', 'title': 'Sécurité Native', 'description': 'Chaque ligne de code est auditée pour garantir une étanchéité totale face aux menaces cybernétiques modernes.'},
            {'icon': 'zap', 'title': 'Performance Critique', 'description': "Optimisation millimétrée du temps de réponse et de la charge serveur pour une expérience utilisateur instantanée."},
            {'icon': 'layers', 'title': 'Scalabilité Infinie', 'description': 'Architecture cloud-native conçue pour supporter une montée en charge exponentielle sans interruption.'},
        ],
    },
    {
        'section_key': 'process_timeline',
        'order': 2,
        'title': 'Notre Processus',
        'items': [
            {'phase': 'Phase 01', 'title': 'Audit & Stratégie', 'description': 'Analyse approfondie de vos processus métiers et définition des indicateurs de succès techniques.'},
            {'phase': 'Phase 02', 'title': 'Architecture & Design', 'description': "Modélisation de l'infrastructure et conception de l'expérience utilisateur haute-fidélité."},
            {'phase': 'Phase 03', 'title': 'Développement Agile', 'description': 'Sprint bi-mensuels avec livraisons continues et tests automatisés systématiques.'},
            {'phase': 'Phase 04', 'title': 'Déploiement & Maintenance', 'description': 'Mise en production sécurisée et monitoring proactif 24/7 de vos actifs numériques.'},
        ],
    },
    {
        'section_key': 'tech_stack',
        'order': 3,
        'title': 'Stack Technologique',
        'subtitle': 'Nous utilisons exclusivement des technologies de pointe, éprouvées pour leur performance et leur capacité à évoluer.',
        'cta_label': 'Standards Industriels',
        'cta_link': '#contact',
        'items': [
            {'name': 'Next.js', 'label': 'Frontend'},
            {'name': 'Python', 'label': 'Django'},
            {'name': 'Docker', 'label': 'DevOps'},
            {'name': 'PostgreSQL', 'label': 'Database'},
            {'name': 'AWS', 'label': 'Cloud'},
            {'name': 'Redis', 'label': 'Caching'},
        ],
    },
    {
        'section_key': 'featured_case_study',
        'order': 4,
        'kicker': 'Projet en Vedette',
        'title': 'Nexus Corp: Refonte Infrastructure Cloud',
        'subtitle': "Découvrez comment nous avons aidé Nexus Corp à réduire ses temps de latence de 60% tout en automatisant 90% de ses déploiements critiques.",
        'cta_label': "Lire l'étude de cas",
        'cta_link': '#contact',
        'items': [],
    },
]

TRACKING_SECTIONS = [
    {
        'section_key': 'tracking_hero',
        'order': 0,
        'title': 'Suivi de Projet',
        'subtitle': "Accédez en temps réel à l'état d'avancement de votre solution digitale sécurisée. Saisissez votre code de référence unique ci-dessous.",
        'items': [],
    },
    {
        'section_key': 'tracking_features',
        'order': 1,
        'items': [
            {'icon': 'shield', 'title': 'Sécurité Active', 'description': 'Toutes les données de ce projet sont chiffrées de bout en bout et accessibles uniquement via votre portail sécurisé.'},
            {'icon': 'gauge', 'title': 'Performance', 'description': "Suivi en temps réel avec latence réduite pour une visibilité instantanée sur l'avancement de vos livrables."},
            {'icon': 'badge-check', 'title': 'Audit Continu', 'description': 'Chaque étape validée par notre équipe qualité avant transmission, pour une traçabilité complète du projet.'},
        ],
    },
]


def seed_sections(apps, schema_editor):
    PageSection = apps.get_model('marketing', 'PageSection')
    for data in EXPERTISE_SECTIONS:
        PageSection.objects.update_or_create(
            page='EXPERTISE', section_key=data['section_key'],
            defaults={**data, 'is_active': True},
        )
    for data in TRACKING_SECTIONS:
        PageSection.objects.update_or_create(
            page='SUIVI_PROJET', section_key=data['section_key'],
            defaults={**data, 'is_active': True},
        )


def remove_sections(apps, schema_editor):
    PageSection = apps.get_model('marketing', 'PageSection')
    PageSection.objects.filter(page__in=['EXPERTISE', 'SUIVI_PROJET']).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('marketing', '0007_alter_pagesection_page_alter_pagesection_section_key'),
    ]

    operations = [
        migrations.RunPython(seed_sections, remove_sections),
    ]
