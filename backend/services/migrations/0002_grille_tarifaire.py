"""Catalogue initial : grille tarifaire Soken's Digital (prix FCFA TTC),
sections 06 « Maintenance & hébergement » et 07 « Communication digitale ».
Modifiable ensuite depuis l'interface (responsable du pôle)."""
from decimal import Decimal

from django.db import migrations

OFFERS = [
    # code, nom, pôle, type, prix TTC, quotas, SLA (h), réunion, descriptif
    ('com-essentiel', 'Communication — Essentiel', 'COMMUNICATION', 'MENSUEL', 75000,
     {'reseaux': 1, 'publications': 8}, None, False,
     '1 réseau social, 8 publications, visuels et textes, gestion des messages, rapport mensuel'),
    ('com-pro', 'Communication — Pro', 'COMMUNICATION', 'MENSUEL', 150000,
     {'reseaux': 2, 'publications': 12, 'videos': 2, 'campagnes': 1}, None, False,
     '2 réseaux sociaux, 12 publications, 2 vidéos courtes, 1 campagne pub, rapport mensuel'),
    ('com-premium', 'Communication — Premium', 'COMMUNICATION', 'MENSUEL', 250000,
     {'reseaux': 3, 'publications': 20, 'videos': 4, 'campagnes': 3}, None, True,
     '3 réseaux sociaux, 20 publications, 4 vidéos courtes, 3 campagnes pub, rapport + réunion'),
    ('com-visuel', 'Visuel (affiche, flyer, post)', 'COMMUNICATION', 'PONCTUEL', 10000, {}, None, False, ''),
    ('com-video', 'Vidéo courte montée (≤ 60 s)', 'COMMUNICATION', 'PONCTUEL', 25000, {}, None, False, ''),
    ('com-campagne', 'Campagne sponsorisée (mise en place)', 'COMMUNICATION', 'PONCTUEL', 30000, {}, None, False, ''),
    ('com-evenement', "Couverture d'événement", 'COMMUNICATION', 'PONCTUEL', 50000, {}, None, False, 'À partir de 50 000 F'),
    ('com-plan', 'Plan de communication (3 mois)', 'COMMUNICATION', 'PONCTUEL', 150000, {}, None, False, ''),
    ('hebergement-domaine', 'Hébergement & domaine', 'MAINTENANCE', 'ANNUEL', 40000, {}, None, False,
     'Hébergement, nom de domaine (.com, .ga…), certificat HTTPS, sauvegarde hebdomadaire — mise en route 48 h'),
    ('maintenance-essentiel', 'Maintenance — Essentiel', 'MAINTENANCE', 'MENSUEL', 15000, {}, 72, False,
     'Mises à jour de sécurité, sauvegardes, surveillance 24h/24, correction des bugs'),
    ('maintenance-pro', 'Maintenance — Pro', 'MAINTENANCE', 'MENSUEL', 35000, {'heures_modif': 2}, 24, False,
     'Tout l’Essentiel, 2 h de modifications par mois, rapport mensuel'),
    ('maintenance-premium', 'Maintenance — Premium', 'MAINTENANCE', 'MENSUEL', 75000, {'heures_modif': 5}, 4, False,
     'Tout le Pro, 5 h de modifications par mois, test de sécurité tous les 3 mois, interlocuteur dédié'),
]


def seed(apps, schema_editor):
    ServiceOffer = apps.get_model('services', 'ServiceOffer')
    for i, (code, name, pole, kind, price, quotas, sla, meeting, features) in enumerate(OFFERS):
        ServiceOffer.objects.get_or_create(code=code, defaults={
            'name': name, 'pole': pole, 'kind': kind, 'price_ttc': Decimal(price), 'quotas': quotas,
            'response_sla_hours': sla, 'requires_meeting': meeting, 'features': features, 'sort_order': i,
        })


class Migration(migrations.Migration):
    dependencies = [('services', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
