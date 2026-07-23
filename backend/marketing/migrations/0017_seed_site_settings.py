from django.db import migrations

NAV_LINKS = [
    {'label': 'Expertise', 'href': '/expertise'},
    {'label': 'Projects', 'href': '/projects'},
    {'label': 'Blog', 'href': '/blog'},
    {'label': 'contact', 'href': '#contact'},
]

SERVICES_LINKS = [
    {'label': 'Logiciel client'},
    {'label': 'App Web & Mobile'},
    {'label': 'Digitalisation'},
    {'label': 'Audit & Sécurité'},
]

LEGAL_LINKS = [
    {'label': 'Politique de confidentialité', 'href': '#'},
    {'label': "Condition d'utilisation", 'href': '#'},
]

SOCIAL_LINKS = [
    {'icon': 'globe', 'url': '#'},
    {'icon': 'at-sign', 'url': 'mailto:contact@sokensdigital.com'},
]


def seed_settings(apps, schema_editor):
    SiteSettings = apps.get_model('marketing', 'SiteSettings')
    if SiteSettings.objects.exists():
        return
    SiteSettings.objects.create(
        logo_url='',
        tagline='Architectes de solutions numériques haute performance. Sécurité. Précision. Innovation.',
        nav_links=NAV_LINKS,
        services_links=SERVICES_LINKS,
        legal_links=LEGAL_LINKS,
        social_links=SOCIAL_LINKS,
        copyright_text="© 2024 Soken's Digital. Sécurité. Précision. Haute Performance.",
    )


def remove_settings(apps, schema_editor):
    SiteSettings = apps.get_model('marketing', 'SiteSettings')
    SiteSettings.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0016_sitesettings'),
    ]

    operations = [
        migrations.RunPython(seed_settings, remove_settings),
    ]
