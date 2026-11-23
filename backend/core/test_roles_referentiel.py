"""Référentiel des rôles 2026 : 13 rôles, plafond de cumul, reclassement des
anciens rôles, cloisonnement des sous-traitants."""
from importlib import import_module

from django.apps import apps
from rest_framework.test import APIClient, APITestCase

from core.constants import (
    ALL_ROLES, DEFAULT_ROLE_PERMISSIONS, ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_RESPONSABLE_ADMINISTRATIF,
    ROLE_RESPONSABLE_MARKETING_COM, ROLE_RESPONSABLE_OPERATIONS, ROLE_RESPONSABLE_TECHNIQUE,
    ROLE_SOUS_TRAITANT_COMMERCIAL, ROLE_SOUS_TRAITANT_DEV, ROLE_SUPER_ADMIN,
)
from core.models import AuditLog, Role, User
from core.serializers import APP_ROLE_TO_DJANGO_ROLE, normalize_app_roles


def _user(email, *roles):
    user = User.objects.create(email=email)
    for name in roles:
        user.roles.add(Role.objects.get_or_create(name=name)[0])
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class ReferentielTests(APITestCase):
    def test_thirteen_roles_everywhere(self):
        self.assertEqual(len(ALL_ROLES), 13)
        self.assertEqual(set(DEFAULT_ROLE_PERMISSIONS), set(ALL_ROLES))
        self.assertEqual(set(APP_ROLE_TO_DJANGO_ROLE.values()), set(ALL_ROLES))

    def test_normalize_legacy_and_cap(self):
        self.assertEqual(normalize_app_roles(['DIRECTEUR_FINANCIER', 'COMPTABLE', 'AUTRE']), ['COMPTABLE'])
        self.assertEqual(
            normalize_app_roles(['SUPER_ADMIN', 'CAISSIER', 'RESPONSABLE_RH', 'RESPONSABLE_OPERATIONS']),
            ['SUPER_ADMIN', 'RESPONSABLE_OPERATIONS', 'RESPONSABLE_ADMINISTRATIF'],
        )

    def test_migration_reclassifies_legacy_roles_and_caps(self):
        migration = import_module('core.migrations.0022_referentiel_roles_2026')
        legacy_df = Role.objects.create(name='Directeur Financier', permissions={'achats': ['voir']})
        legacy_rh = Role.objects.create(name='Responsable RH')
        legacy_support = Role.objects.create(name='Support Client')
        user = User.objects.create(email='multi@x.dev')
        user.roles.add(legacy_df, legacy_rh, legacy_support)
        migration.forwards(apps, None)
        names = set(user.roles.values_list('name', flat=True))
        # Reclassés : Comptable, Resp. Administratif, Resp. Technique -> plafonné à 2.
        self.assertEqual(len(names), 2)
        self.assertEqual(names, {ROLE_RESPONSABLE_TECHNIQUE, ROLE_RESPONSABLE_ADMINISTRATIF})
        self.assertFalse(Role.objects.filter(name__in=['Directeur Financier', 'Responsable RH', 'Support Client']).exists())
        self.assertTrue(AuditLog.objects.filter(action='ROLES_PLAFONNES', entity_id=str(user.pk)).exists())
        self.assertIn('voir', Role.objects.get(name=ROLE_COMPTABLE).permissions.get('achats', []))


class SubcontractorIsolationTests(APITestCase):
    def test_subcontractors_have_no_finance_nor_company_dashboard(self):
        dev = _client(_user('st@x.dev', ROLE_SOUS_TRAITANT_DEV))
        self.assertEqual(dev.get('/api/v1/finance/disbursement-requests/').status_code, 403)
        self.assertEqual(dev.get('/api/v1/dashboard/').status_code, 403)
        self.assertEqual(dev.get('/api/v1/finance/invoices/').status_code, 403)

    def test_subcontractor_commercial_cannot_send_quotes(self):
        from decimal import Decimal
        from marketing.models import Quote, QuoteLine
        st = _user('stc@x.dev', ROLE_SOUS_TRAITANT_COMMERCIAL)
        quote = Quote.objects.create(created_by=st, client_name='X')
        QuoteLine.objects.create(quote=quote, service_title='A', quantity=Decimal('1'), unit_price=Decimal('1000'))
        client = _client(st)
        self.assertEqual(client.post(f'/api/v1/marketing/quotes/{quote.pk}/send/', {}, format='json').status_code, 403)
        # Ni conversion en facture, ni paramètres des documents.
        self.assertEqual(client.post(f'/api/v1/marketing/quotes/{quote.pk}/convert-to-invoice/', {}, format='json').status_code, 403)
        self.assertEqual(client.patch('/api/v1/marketing/quote-settings/', {'footer_note': 'x'}, format='json').status_code, 403)
        # Mais son propre devis et ses leads restent accessibles.
        self.assertEqual(client.get(f'/api/v1/marketing/quotes/{quote.pk}/').status_code, 200)
        self.assertEqual(client.get('/api/v1/marketing/leads/').status_code, 200)

    def test_internal_staff_keeps_access(self):
        self.assertEqual(_client(_user('dev@x.dev', ROLE_DEVELOPER)).get('/api/v1/finance/disbursement-requests/').status_code, 200)
        ops = _client(_user('ops@x.dev', ROLE_RESPONSABLE_OPERATIONS))
        self.assertEqual(ops.get('/api/v1/dashboard/').status_code, 200)
        mkt = _client(_user('mkt@x.dev', ROLE_RESPONSABLE_MARKETING_COM))
        self.assertEqual(mkt.get('/api/v1/marketing/leads/').status_code, 200)
        self.assertEqual(_client(_user('sa@x.dev', ROLE_SUPER_ADMIN)).get('/api/v1/finance/invoices/').status_code, 200)
