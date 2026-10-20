from django.db import migrations

# Textes du nouveau site vitrine (maquette « Soken's Digital — Site vitrine »,
# octobre 2026), choisis pour remplacer ceux du CMS. Les données réelles déjà
# saisies sont conservées : photos de l'équipe, logos clients, valeurs des
# chiffres du hero, projets vitrine (seuls leurs résumés courts, nouveaux,
# sont remplis). Dans un titre, la partie entre *astérisques* s'affiche en
# dégradé sur le site.

HERO_STAT_LABELS = ['projets livrés', 'clients accompagnés', "d'expérience"]
HERO_STATS_DEFAULT = [
    {'value': '10+', 'label': 'projets livrés'},
    {'value': '10+', 'label': 'clients accompagnés'},
    {'value': '2 ans', 'label': "d'expérience"},
]

TEAM = [
    {
        'name': 'Jackie MOUBEYI',
        'role': 'Marketing digital & relation client',
        'bio': 'Votre premier contact : elle écoute votre besoin, vous conseille et suit votre projet jusqu’au lancement.',
    },
    {
        'name': 'Herbert OTHA',
        'role': 'Développeur full stack',
        'bio': 'Il conçoit et développe vos sites, applications et logiciels, de l’écran jusqu’au serveur.',
    },
    {
        'name': 'Delfrehl MOUDJIEGOU MBOUMBA',
        'role': 'Développeur full stack',
        'bio': 'Il transforme vos idées en fonctionnalités concrètes, simples à utiliser au quotidien.',
    },
    {
        'name': 'Edi SOKENOU',
        'role': 'Développeur full stack',
        'bio': 'Il veille à la qualité et à la fiabilité de chaque livraison, avant comme après la mise en ligne.',
    },
]

SECTIONS = {
    'ACCUEIL': [
        {
            'section_key': 'hero',
            'kicker': '',  # pas de badge au-dessus du titre
            'title': 'Votre projet digital, *conçu sur mesure.*',
            'subtitle': (
                "De l'idée à la mise en ligne, nous concevons des outils simples et fiables, "
                'adaptés à votre activité. Et nous restons à vos côtés pour les faire évoluer.'
            ),
            'cta_label': 'Démarrer un projet',
            'cta_link': '/contact',
            'cta_secondary_label': 'Voir notre expertise',
            'cta_secondary_link': '/expertise',
            'extra': {
                'rotating_prefix': 'Nous créons votre',
                'rotating_words': ['site web', 'application mobile', 'logiciel sur mesure', 'plateforme en ligne'],
            },
        },
        {
            'section_key': 'partner_logos',
            'kicker': '',
            'title': 'Ils nous font confiance',
            'subtitle': '',
        },
        {
            'section_key': 'services',
            'kicker': 'Nos services',
            'title': "Tout ce qu'il faut pour digitaliser votre activité",
            'subtitle': "Un seul partenaire, de l'idée à la mise en ligne, puis pour faire évoluer votre outil au fil du temps.",
            'cta_label': '',
            'cta_link': '',
            'items': [
                {
                    'title': 'Sites & plateformes web',
                    'description': 'Site vitrine, plateforme de réservation, espace client… Un outil en ligne rapide, clair et accessible sur tous les écrans.',
                    'points': ['Pensé pour mobile, tablette et ordinateur', 'Simple à mettre à jour', 'Hébergé et sécurisé'],
                    'visual': 'web',
                },
                {
                    'title': 'Applications mobiles',
                    'description': 'Une application iPhone et Android pour vos clients ou pour vos équipes sur le terrain.',
                    'points': ['Disponible sur iPhone et Android', 'Notifications en temps réel', 'Connectée à vos outils'],
                    'visual': 'mobile',
                },
                {
                    'title': 'Logiciels sur mesure',
                    'description': 'Remplacez le papier et les fichiers Excel par un outil fait pour votre façon de travailler : gestion, suivi, réservations, stocks…',
                    'points': ['Adapté à vos méthodes de travail', 'Moins de tâches répétitives', 'Toutes vos informations au même endroit'],
                    'visual': 'logiciel',
                },
                {
                    'title': 'Audit & modernisation',
                    'description': 'Votre application est lente, vieillissante ou fragile ? Nous l’analysons, la sécurisons et la modernisons, y compris avec l’intelligence artificielle.',
                    'points': ['Un diagnostic clair et compréhensible', 'Corrections et sécurité renforcée', 'Ajout de fonctions IA'],
                    'visual': 'audit',
                },
            ],
        },
        {
            'section_key': 'recent_projects',
            'kicker': 'Réalisations',
            'title': 'Nos derniers projets',
            'subtitle': '',
            'cta_label': 'Tous nos projets',
            'cta_link': '/projects',
        },
        {
            'section_key': 'team',
            'kicker': 'Équipe',
            'title': 'Les visages derrière vos projets',
            'subtitle': "Une équipe complète, basée à Libreville, qui vous accompagne du premier échange jusqu'au lancement.",
        },
        {
            'section_key': 'blog_insights',
            'kicker': 'Blog',
            'title': 'Actualités & conseils',
            'subtitle': '',
            'cta_label': 'Tous les articles',
            'cta_link': '/blog',
        },
        {
            'section_key': 'cta',
            'kicker': '',
            'title': 'Un projet en tête ? *Parlons-en.*',
            'subtitle': 'Expliquez-nous votre besoin en quelques mots. Nous vous répondons rapidement avec des premières pistes.',
            'cta_label': 'Démarrer un projet',
            'cta_link': '/contact',
            'cta_secondary_label': '',
            'cta_secondary_link': '',
        },
    ],
    'EXPERTISE': [
        {
            'section_key': 'expertise_hero',
            'kicker': '',
            'title': 'Du besoin à la solution, *étape par étape.*',
            'subtitle': "Une méthode claire, des technologies fiables et une équipe qui vous accompagne du premier échange jusqu'après la mise en ligne.",
            'cta_label': 'Démarrer un projet',
            'cta_link': '/contact',
            'cta_secondary_label': 'Voir nos réalisations',
            'cta_secondary_link': '/projects',
        },
        {
            'section_key': 'strategic_advantages',
            'kicker': 'Nos engagements',
            'title': 'Trois promesses, sur chaque projet',
            'subtitle': '',
            'items': [
                {
                    'icon': 'shield-check',
                    'short': 'Sécurité',
                    'title': 'Sécurisé dès le départ',
                    'description': 'Vos données et celles de vos clients sont protégées. Chaque application est testée contre les attaques avant sa mise en ligne.',
                },
                {
                    'icon': 'zap',
                    'short': 'Rapidité',
                    'title': 'Rapide et fluide',
                    'description': 'Des pages qui s’affichent vite et un outil qui reste fluide, même quand vos utilisateurs sont nombreux.',
                },
                {
                    'icon': 'layers',
                    'short': 'Évolution',
                    'title': 'Prêt à grandir avec vous',
                    'description': 'Votre outil évolue avec votre activité : plus d’utilisateurs, plus de fonctions, sans tout reconstruire.',
                },
            ],
        },
        {
            'section_key': 'process_timeline',
            'kicker': 'Notre méthode',
            'title': 'Une méthode simple en 4 étapes',
            'subtitle': 'Vous validez chaque étape avant de passer à la suivante. Pas de mauvaise surprise.',
            'items': [
                {'phase': 'Phase 01', 'title': 'On vous écoute', 'description': 'Nous prenons le temps de comprendre votre activité, vos besoins et vos objectifs.'},
                {'phase': 'Phase 02', 'title': 'On imagine la solution', 'description': 'Nous vous présentons les maquettes de votre futur outil, à valider avant tout développement.'},
                {'phase': 'Phase 03', 'title': 'On construit', 'description': 'Nous développons par étapes et vous montrons l’avancement toutes les deux semaines.'},
                {'phase': 'Phase 04', 'title': 'On lance et on vous suit', 'description': 'Mise en ligne sécurisée, puis surveillance 24h/24 et maintenance pour que tout fonctionne.'},
            ],
        },
        {
            'section_key': 'tech_stack',
            'kicker': 'Technologies',
            'title': 'Des technologies fiables et reconnues',
            'subtitle': 'Des outils modernes, utilisés dans le monde entier, choisis pour leur solidité.',
            'cta_label': '',
            'cta_link': '',
            'items': [
                {'name': 'Next.js', 'label': 'Sites et interfaces', 'logo_url': '/assets/tech/nextjs.svg'},
                {'name': 'Python', 'label': 'Serveur', 'logo_url': '/assets/tech/python.svg'},
                {'name': 'Django', 'label': 'Serveur', 'logo_url': '/assets/tech/django.svg'},
                {'name': 'PostgreSQL', 'label': 'Base de données', 'logo_url': '/assets/tech/postgresql.svg'},
                {'name': 'AWS', 'label': 'Hébergement', 'logo_url': '/assets/tech/aws.svg'},
                {'name': 'Docker', 'label': 'Mise en ligne', 'logo_url': '/assets/tech/docker.svg'},
                {'name': 'Redis', 'label': 'Performance', 'logo_url': '/assets/tech/redis.svg'},
            ],
        },
        {
            'section_key': 'expertise_cta',
            'order': 5,
            'title': 'Un projet en tête ? *Parlons-en.*',
            'subtitle': 'Nous étudions votre besoin et vous proposons la solution la plus adaptée.',
            'cta_label': 'Démarrer un projet',
            'cta_link': '/contact',
        },
    ],
    'PROJETS': [
        {
            'section_key': 'projects_hero',
            'order': 0,
            'title': 'Nos *réalisations*',
            'subtitle': 'Des projets concrets, menés main dans la main avec nos clients au Gabon. Découvrez ce que nous avons construit pour eux.',
        },
        {
            'section_key': 'projects_cta',
            'order': 1,
            'title': 'Votre projet sera le prochain',
            'subtitle': 'Parlez-nous de votre idée, nous la transformons en outil concret.',
            'cta_label': 'Démarrer un projet',
            'cta_link': '/contact',
        },
    ],
    'BLOG': [
        {
            'section_key': 'blog_hero',
            'order': 0,
            'title': 'Actualités *& conseils*',
            'subtitle': 'Des articles clairs pour comprendre le numérique et en tirer le meilleur pour votre activité.',
        },
        {
            'section_key': 'blog_cta',
            'order': 1,
            'title': "Envie de passer *à l'action* ?",
            'subtitle': 'Parlez-nous de votre projet, nous vous aidons à le concrétiser.',
            'cta_label': 'Démarrer un projet',
            'cta_link': '/contact',
        },
    ],
    'CONTACT': [
        {
            'section_key': 'contact_hero',
            'order': 0,
            'title': 'Parlons de *votre projet*',
            'subtitle': "Une idée, une question, un besoin d'accompagnement ? Décrivez-le en quelques lignes, nous vous répondons rapidement.",
            'extra': {
                'team_title': 'Une équipe à Libreville vous répond',
                'team_subtitle': 'Marketing, commercial et développement',
            },
        },
        {
            'section_key': 'contact_form',
            'order': 1,
            'title': 'Démarrer un projet',
            'subtitle': 'Deux minutes suffisent pour nous présenter votre besoin.',
            'cta_label': 'Envoyer le message',
            'items': [
                {'label': 'Site ou plateforme web'},
                {'label': 'Application mobile'},
                {'label': 'Logiciel sur mesure'},
                {'label': 'Audit & modernisation'},
                {'label': 'Autre'},
            ],
        },
    ],
}

PROJECT_SUMMARIES = {
    'nfl-courtier-service': {
        'summary': 'Un site haut de gamme qui présente les trois activités du cabinet et permet de réserver ses formations en ligne.',
        'challenge_summary': 'Présenter trois activités différentes (conseil, formation et événementiel) sous une même image, haut de gamme et cohérente.',
        'solution_summary': "Un site organisé par activité, qui met en avant l'expérience de la fondatrice et permet de réserver les masterclasses en ligne.",
        'solution_points': ['Une page par activité', 'Réservation en ligne', 'Témoignages et partenaires', 'Design haut de gamme'],
    },
    'workclass': {
        'summary': "Une plateforme pour s'inscrire aux événements professionnels et recevoir son billet avec QR code, scanné en un instant à l'entrée.",
        'challenge_summary': "Des inscriptions dispersées et un contrôle des entrées fait à la main, avec de longues files d'attente à l'accueil.",
        'solution_summary': "Une plateforme unique pour consulter le programme, s'inscrire et recevoir son billet avec QR code par email. À l'entrée, un simple scan suffit.",
        'solution_points': ['Billet avec QR code', "Scan rapide à l'entrée", 'Programme et intervenants', "Documents et avis après l'événement"],
    },
}


def _normalize(name):
    return ' '.join(str(name or '').split()).casefold()


def _hero_stats(existing):
    """Garde les valeurs réelles (« 10+ », « 2 ans »), reprend les libellés du design."""
    if not existing:
        return HERO_STATS_DEFAULT
    return [
        {**item, 'label': HERO_STAT_LABELS[i] if i < len(HERO_STAT_LABELS) else item.get('label', '')}
        for i, item in enumerate(existing)
    ]


def _team(existing):
    """Rôles et textes du design, photos et membres supplémentaires conservés."""
    by_name = {_normalize(m.get('name')): m for m in existing or []}
    merged = []
    for member in TEAM:
        current = by_name.pop(_normalize(member['name']), {})
        merged.append({**current, **member, 'photo_url': current.get('photo_url', '')})
    return merged + list(by_name.values())


def seed_content(apps, schema_editor):
    PageSection = apps.get_model('marketing', 'PageSection')
    SiteSettings = apps.get_model('marketing', 'SiteSettings')
    ShowcaseProject = apps.get_model('marketing', 'ShowcaseProject')

    for page, sections in SECTIONS.items():
        for data in sections:
            data = dict(data)
            key = data.pop('section_key')
            section = PageSection.objects.filter(page=page, section_key=key).first()
            if section is None:
                section = PageSection(page=page, section_key=key, order=data.pop('order', 0), is_active=True)
            else:
                data.pop('order', None)
            for field, value in data.items():
                setattr(section, field, value)
            if page == 'ACCUEIL' and key == 'hero':
                section.items = _hero_stats(section.items)
            if page == 'ACCUEIL' and key == 'team':
                section.items = _team(section.items)
            section.save()

    settings = SiteSettings.objects.first() or SiteSettings()
    settings.tagline = 'Construisons votre avenir digital. Sites, applications et logiciels sur mesure, depuis Libreville.'
    settings.contact_email = settings.contact_email or 'contact@sokensdigital.com'
    settings.contact_phone = settings.contact_phone or '060 00 13 33'
    settings.legal_links = [
        {'label': 'Politique de confidentialité', 'href': '/confidentialite'},
        {'label': "Conditions d'utilisation", 'href': '/cgu'},
        {'label': 'Suivre un projet', 'href': '/suivi-projet'},
    ]
    settings.copyright_text = "Soken's Digital. Tous droits réservés."
    settings.save()

    for slug, summaries in PROJECT_SUMMARIES.items():
        project = ShowcaseProject.objects.filter(slug=slug).first()
        if project is None:
            continue
        for field, value in summaries.items():
            if not getattr(project, field):
                setattr(project, field, value)
        project.save()


class Migration(migrations.Migration):
    dependencies = [
        ('marketing', '0038_vitrine_v2_fields'),
    ]

    operations = [
        # Pas de retour arrière : les anciens textes ne sont pas conservés.
        migrations.RunPython(seed_content, migrations.RunPython.noop),
    ]
