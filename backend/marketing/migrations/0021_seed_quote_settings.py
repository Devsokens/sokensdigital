from django.db import migrations

PAYMENT_METHODS = [
    {'label': 'Espèces'},
    {'label': 'Transaction Mobile money sur le numéro 077 61 77 76'},
]

DEFAULT_PAYMENT_TERMS = [
    {'label': 'Acompte à la commande', 'percentage': 20},
    {'label': 'Acompte au début des travaux', 'percentage': 30},
    {'label': 'Solde à la livraison', 'percentage': 50},
]

FOOTER_NOTE = (
    "Le présent devis est établi sur la base du périmètre fonctionnel validé. "
    "Toute demande de fonctionnalités ou prestations supplémentaires fera l'objet "
    "d'un devis complémentaire et si nécessaire d'un ajustement des délais."
)


def seed_settings(apps, schema_editor):
    QuoteSettings = apps.get_model('marketing', 'QuoteSettings')
    if QuoteSettings.objects.exists():
        return
    QuoteSettings.objects.create(
        company_address='Quartier Louis,\nLibreville, Gabon',
        company_phone='+241 060 001 333 / +241 065 04 25 61',
        company_email='sokensdigital@gmail.com',
        payment_methods=PAYMENT_METHODS,
        default_payment_terms=DEFAULT_PAYMENT_TERMS,
        footer_note=FOOTER_NOTE,
    )


def remove_settings(apps, schema_editor):
    QuoteSettings = apps.get_model('marketing', 'QuoteSettings')
    QuoteSettings.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0020_quote_client_name_quote_description_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_settings, remove_settings),
    ]
