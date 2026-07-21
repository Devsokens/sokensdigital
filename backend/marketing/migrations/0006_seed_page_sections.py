from django.db import migrations

# Exact current copy from the frontend's hardcoded components
# (components/sections/*.tsx on the Accueil page) — seeded here so
# switching the public site over to this API is visually a no-op.
SECTIONS = [
    {
        'section_key': 'hero',
        'order': 0,
        'kicker': "L'innovation de demain, aujourd'hui",
        'title': 'Excellence Digitale sur Mesure',
        'subtitle': (
            'Nous transformons vos visions en solutions technologiques haute '
            'performance. Logiciels critiques, applications cloud et '
            'infrastructures sécurisées.'
        ),
        'cta_label': 'Démarrer un Projet',
        'cta_link': '/demarrer-un-projet',
        'cta_secondary_label': 'Voir nos expertises',
        'cta_secondary_link': '#expertise',
        'items': [
            {'value': '150+', 'label': 'Projets livrés'},
            {'value': '50+', 'label': 'Clients satisfaits'},
            {'value': '10 ans', 'label': "D'expertise"},
        ],
    },
    {
        'section_key': 'services',
        'order': 1,
        'title': 'Ingénierie de Précision',
        'subtitle': (
            'Notre arsenal technologique est conçu pour répondre aux défis '
            'les plus complexes de l\'industrie numérique.'
        ),
        'cta_label': 'Explorer tous les services',
        'cta_link': '/expertise',
        'items': [
            {'icon': 'LayoutGrid', 'title': 'Solutions sur Mesure', 'description': 'Architecture logicielle robuste conçue spécifiquement pour vos processus métier uniques.'},
            {'icon': 'Globe', 'title': 'App Web', 'description': 'Expériences web immersives et évolutives avec React, Next.js et architectures Cloud.'},
            {'icon': 'Smartphone', 'title': 'App Mobile', 'description': "Développement iOS & Android natif et cross-platform axé sur la performance et l'UX."},
            {'icon': 'MonitorCog', 'title': 'Logiciels', 'description': 'Applications bureau et systèmes embarqués pour des performances sans compromis.'},
            {'icon': 'Workflow', 'title': 'Digitalisation', 'description': 'Optimisation de vos flux de travail et automatisation intelligente de vos services.'},
            {'icon': 'TrendingUp', 'title': 'Amélioration', 'description': 'Audit, refactorisation et accélération de vos infrastructures technologiques existantes.'},
        ],
    },
    {
        'section_key': 'recent_projects',
        'order': 2,
        'kicker': 'Réalisations',
        'title': 'Projects récents',
        'items': [],
    },
    {
        'section_key': 'testimonials',
        'order': 3,
        'title': 'La voix de nos partenaires',
        'items': [
            {
                'quote': "Soken's Digital n'est pas seulement un prestataire, c'est un partenaire stratégique. Leur capacité à comprendre nos enjeux de sécurité critique a été déterminante pour notre migration cloud.",
                'name': 'Alexandre Dumas',
                'role': 'CTO, CyberSentinel Inc.',
            },
            {
                'quote': "La précision technique et le respect des délais sont rares dans ce secteur. L'équipe a livré une plateforme robuste qui gère aujourd'hui plus d'un million de transactions quotidiennes.",
                'name': 'Marie Leblanc',
                'role': 'Directrice Innovation, AeroLogistics',
            },
        ],
    },
    {
        'section_key': 'team',
        'order': 4,
        'title': 'Notre Équipe',
        'subtitle': 'Les architectes, ingénieurs et experts sécurité qui conçoivent et livrent chacun de vos projets.',
        'items': [
            {'name': 'Dr. Elias Vance', 'role': 'Architecte Sécurité', 'bio': "Pilote la stratégie de cybersécurité et l'architecture Zero Trust."},
            {'name': 'Sofia Ramirez', 'role': 'Lead Frontend Engineer', 'bio': 'Conçoit des interfaces temps réel pour les environnements haute fréquence.'},
            {'name': 'Marc Dubois', 'role': 'Architecte Cloud', 'bio': 'Orchestre les infrastructures multi-cloud à grande échelle.'},
            {'name': 'Léa Fontaine', 'role': 'Ingénieure Sécurité', 'bio': 'Sécurise les données sensibles et les architectures réglementées.'},
            {'name': 'Taiger Dev', 'role': 'Développeur Full Stack', 'bio': 'Construit les briques techniques de nos solutions sur-mesure.'},
        ],
    },
    {
        'section_key': 'partner_logos',
        'order': 5,
        'items': [
            {'name': 'CYBERCORE'}, {'name': 'Logo strix'}, {'name': 'NEBULA'},
            {'name': 'CLOUDSEC'}, {'name': 'ORBITAL'},
        ],
    },
    {
        'section_key': 'blog_insights',
        'order': 6,
        'title': 'Insights Techniques',
        'cta_label': 'Lire le blog',
        'cta_link': '/blog',
        'items': [],
    },
    {
        'section_key': 'cta',
        'order': 7,
        'title': 'Prêt pour votre transformation digitale ?',
        'subtitle': 'Discutons de vos objectifs et élaborons ensemble la roadmap technique de votre succès.',
        'cta_label': 'Démarrer un Projet',
        'cta_link': '/demarrer-un-projet',
        'items': [],
    },
]


def seed_sections(apps, schema_editor):
    PageSection = apps.get_model('marketing', 'PageSection')
    for data in SECTIONS:
        PageSection.objects.update_or_create(
            page='ACCUEIL', section_key=data['section_key'],
            defaults={**data, 'is_active': True},
        )


def remove_sections(apps, schema_editor):
    PageSection = apps.get_model('marketing', 'PageSection')
    PageSection.objects.filter(page='ACCUEIL').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('marketing', '0005_pagesection'),
    ]

    operations = [
        migrations.RunPython(seed_sections, remove_sections),
    ]
