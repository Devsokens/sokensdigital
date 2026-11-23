from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from administration.models import Client
from core.constants import (
    ROLE_COMMERCIAL, ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_RESPONSABLE_MARKETING_COM, ROLE_RESPONSABLE_TECHNIQUE,
    ROLE_SOUS_TRAITANT_COMMERCIAL, ROLE_SUPER_ADMIN,
)
from core.models import AuditLog, Role, User
from finance.models import Invoice, Payment
from services.billing import ht_for_ttc
from services.models import ServiceOffer, ServicePeriod, Subscription, add_months

BASE = '/api/v1/services'


def _user(email, *roles):
    user = User.objects.create(email=email)
    for name in roles:
        user.roles.add(Role.objects.get_or_create(name=name)[0])
    return user


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class CatalogueTests(APITestCase):
    def test_grid_is_seeded(self):
        pro = ServiceOffer.objects.get(code='com-pro')
        self.assertEqual(pro.price_ttc, Decimal('150000'))
        self.assertEqual(pro.quotas['publications'], 12)
        self.assertEqual(ServiceOffer.objects.get(code='hebergement-domaine').kind, 'ANNUEL')
        self.assertEqual(ServiceOffer.objects.get(code='maintenance-premium').response_sla_hours, 4)

    def test_ht_for_ttc_hits_exact_ttc(self):
        for ttc in (Decimal('75000'), Decimal('150000'), Decimal('15000'), Decimal('40000')):
            ht = ht_for_ttc(ttc, Decimal('0.18'), Decimal('0.01'), [])
            total = ht + (ht * Decimal('0.18')).quantize(Decimal('0.01')) + (ht * Decimal('0.01')).quantize(Decimal('0.01'))
            self.assertEqual(total, ttc)

    def test_add_months_clamps(self):
        self.assertEqual(add_months(date(2026, 1, 31), 1), date(2026, 2, 28))


class SubscriptionFlowTests(APITestCase):
    def setUp(self):
        self.mkt = _user('mkt@x.dev', ROLE_RESPONSABLE_MARKETING_COM)
        self.compta = _user('compta@x.dev', ROLE_COMPTABLE)
        self.client_co = Client.objects.create(company_name='Hôtel Test')
        self.offer = ServiceOffer.objects.get(code='com-pro')
        self.sub = Subscription.objects.create(client=self.client_co, offer=self.offer, start_date=date(2026, 11, 1))
        self.api = _client(self.mkt)

    def _generate(self, api=None):
        return (api or self.api).post(f'{BASE}/subscriptions/{self.sub.pk}/generate-invoice/', {}, format='json')

    def _pay(self, period, amount=None):
        invoice = Invoice.objects.get(pk=period.invoice_id)
        if invoice.status == Invoice.Status.BROUILLON:
            Invoice.objects.filter(pk=invoice.pk).update(status=Invoice.Status.VALIDEE)
            invoice.refresh_from_db()
        Payment.objects.create(invoice=invoice, amount=amount or invoice.amount_ttc, payment_date=timezone.now().date(),
                               payment_method='VIREMENT', status=Payment.Status.RECU)
        period.refresh_from_db()

    def test_generate_invoice_is_exact_and_not_doubled(self):
        res = self._generate(_client(self.compta))
        self.assertEqual(res.status_code, 201, res.content)
        period = ServicePeriod.objects.get(pk=res.json()['id'])
        self.assertEqual(period.invoice.amount_ttc, Decimal('150000.00'))
        self.assertEqual(period.invoice.status, Invoice.Status.BROUILLON)
        self.assertEqual((period.period_start, period.period_end), (date(2026, 11, 1), date(2026, 11, 30)))
        # Période impayée : pas de seconde facture.
        self.assertEqual(self._generate().status_code, 400)

    def test_period_opens_only_when_fully_paid_then_quota_enforced(self):
        period = ServicePeriod.objects.get(pk=self._generate().json()['id'])
        self._pay(period, Decimal('50000'))
        self.assertEqual(period.status, ServicePeriod.Status.EN_ATTENTE_PAIEMENT)
        # Production refusée tant que le mois n'est pas payé.
        res = self.api.post(f'{BASE}/deliverables/', {'period': str(period.pk), 'kind': 'VIDEO', 'title': 'v'}, format='json')
        self.assertEqual(res.status_code, 400)
        self._pay(period, Decimal('100000'))
        self.assertEqual(period.status, ServicePeriod.Status.OUVERT)
        self.assertEqual(period.quotas_alloues['videos'], 2)

        ids = []
        for i in range(3):
            res = self.api.post(f'{BASE}/deliverables/', {'period': str(period.pk), 'kind': 'VIDEO', 'title': f'v{i}'}, format='json')
            self.assertEqual(res.status_code, 201, res.content)
            ids.append(res.json()['id'])
        for i, pk in enumerate(ids):
            for step in ('CONTROLE_INTERNE', 'VALIDE_CLIENT'):
                self.assertEqual(self.api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': step}, format='json').status_code, 200)
            res = self.api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': 'PUBLIE'}, format='json')
            self.assertEqual(res.status_code, 200 if i < 2 else 400, res.content)
        self.assertEqual(period.remaining()['videos'], 0)
        # Saut d'étape interdit.
        res = self.api.post(f'{BASE}/deliverables/', {'period': str(period.pk), 'kind': 'PUBLICATION', 'title': 'p'}, format='json')
        self.assertEqual(self.api.post(f'{BASE}/deliverables/{res.json()["id"]}/transition/', {'status': 'PUBLIE'}, format='json').status_code, 400)

    def test_close_requires_report_and_carry_over_is_audited(self):
        period = ServicePeriod.objects.get(pk=self._generate().json()['id'])
        self._pay(period)
        url = f'{BASE}/periods/{period.pk}/close/'
        self.assertEqual(self.api.post(url, {}, format='json').status_code, 400)
        self.assertEqual(self.api.post(url, {'report_url': 'javascript:alert(1)'}, format='json').status_code, 400)
        self.assertEqual(self.api.post(url, {'report_url': 'https://r.example/1', 'carry_over': {'videos': 1}}, format='json').status_code, 400)
        self.assertEqual(self.api.post(url, {'report_url': 'https://r.example/1', 'carry_over': {'videos': 5}, 'carry_reason': 'x'}, format='json').status_code, 400)
        res = self.api.post(url, {'report_url': 'https://r.example/1', 'carry_over': {'videos': 1}, 'carry_reason': 'Tournage reporté par le client'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(AuditLog.objects.filter(action='QUOTA_REPORTE').exists())
        # Le report s'ajoute au mois suivant, à son ouverture.
        nxt = ServicePeriod.objects.get(pk=self._generate().json()['id'])
        self.assertEqual(nxt.period_start, date(2026, 12, 1))
        self._pay(nxt)
        self.assertEqual(nxt.quotas_alloues['videos'], 3)

    def test_premium_requires_meeting(self):
        self.sub.offer = ServiceOffer.objects.get(code='com-premium')
        self.sub.save()
        period = ServicePeriod.objects.get(pk=self._generate().json()['id'])
        self._pay(period)
        url = f'{BASE}/periods/{period.pk}/close/'
        self.assertEqual(self.api.post(url, {'report_notes': 'ok'}, format='json').status_code, 400)
        self.assertEqual(self.api.post(url, {'report_notes': 'ok', 'meeting_held': True}, format='json').status_code, 200)


class PermissionTests(APITestCase):
    def setUp(self):
        self.client_co = Client.objects.create(company_name='C')
        self.com = Subscription.objects.create(client=self.client_co, offer=ServiceOffer.objects.get(code='com-essentiel'),
                                               start_date=date(2026, 11, 1))
        self.mnt = Subscription.objects.create(client=self.client_co, offer=ServiceOffer.objects.get(code='maintenance-pro'),
                                               start_date=date(2026, 11, 1))

    def test_subcontractors_and_developers_have_no_access(self):
        for role in (ROLE_SOUS_TRAITANT_COMMERCIAL, ROLE_DEVELOPER):
            api = _client(_user(f'{role[:5]}@x.dev', role))
            self.assertEqual(api.get(f'{BASE}/subscriptions/').status_code, 403)
            self.assertEqual(api.get(f'{BASE}/dashboard/').status_code, 403)

    def test_poles_are_separated(self):
        tech = _client(_user('t@x.dev', ROLE_RESPONSABLE_TECHNIQUE))
        ids = {s['id'] for s in tech.get(f'{BASE}/subscriptions/').json()['results']}
        self.assertEqual(ids, {str(self.mnt.pk)})
        self.assertEqual(tech.post(f'{BASE}/subscriptions/{self.com.pk}/generate-invoice/', {}, format='json').status_code, 404)

    def test_commercial_reads_only_his_portfolio(self):
        other = _client(_user('c2@x.dev', ROLE_COMMERCIAL))
        self.assertEqual(other.get(f'{BASE}/subscriptions/{self.com.pk}/').status_code, 404)
        self.assertEqual(other.get(f'{BASE}/subscriptions/').json()['results'], [])
        self.assertEqual(other.get(f'{BASE}/dashboard/').json()['active_count'], 0)
        # Commercial + Responsable Technique : maintenance complète, communication limitée.
        both = _client(_user('c3@x.dev', ROLE_COMMERCIAL, ROLE_RESPONSABLE_TECHNIQUE))
        ids = {s['id'] for s in both.get(f'{BASE}/subscriptions/').json()['results']}
        self.assertEqual(ids, {str(self.mnt.pk)})

    def test_commercial_reads_but_cannot_write(self):
        seller = _user('c@x.dev', ROLE_COMMERCIAL)
        self.client_co.assigned_to = seller
        self.client_co.save()
        com = _client(seller)
        self.assertEqual(com.get(f'{BASE}/subscriptions/{self.com.pk}/').status_code, 200)
        self.assertEqual(com.post(f'{BASE}/subscriptions/{self.com.pk}/generate-invoice/', {}, format='json').status_code, 403)
        res = com.post(f'{BASE}/subscriptions/', {'client': self.client_co.pk, 'offer': ServiceOffer.objects.get(code='com-pro').pk,
                                                  'start_date': '2026-12-01'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_ponctual_offer_cannot_be_subscribed(self):
        sa = _client(_user('sa@x.dev', ROLE_SUPER_ADMIN))
        res = sa.post(f'{BASE}/subscriptions/', {'client': self.client_co.pk, 'offer': ServiceOffer.objects.get(code='com-visuel').pk,
                                                 'start_date': '2026-12-01'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_dashboard_flags_unpaid_and_sla(self):
        from technique.models import Ticket
        sa = _client(_user('sa2@x.dev', ROLE_SUPER_ADMIN))
        self.assertEqual(sa.post(f'{BASE}/subscriptions/{self.com.pk}/generate-invoice/', {}, format='json').status_code, 201)
        ticket = Ticket.objects.create(client=self.client_co, title='Site en panne', description='x')
        Ticket.objects.filter(pk=ticket.pk).update(created_at=timezone.now() - timedelta(hours=30))
        data = sa.get(f'{BASE}/dashboard/').json()
        self.assertEqual(len(data['unpaid_started']), 1)
        self.assertEqual([t['title'] for t in data['sla_overdue']], ['Site en panne'])
        self.assertIn('COMMUNICATION', data['mrr'])


class CoherenceTests(APITestCase):
    def setUp(self):
        self.sa = _client(_user('sa-coh@x.dev', ROLE_SUPER_ADMIN))
        self.client_co = Client.objects.create(company_name='Coh')
        self.offer = ServiceOffer.objects.get(code='com-pro')

    def _create(self, **extra):
        data = {'client': self.client_co.pk, 'offer': self.offer.pk, 'start_date': '2026-12-01', **extra}
        return self.sa.post(f'{BASE}/subscriptions/', data, format='json')

    def test_duplicate_active_subscription_refused(self):
        self.assertEqual(self._create().status_code, 201)
        self.assertEqual(self._create().status_code, 400)

    def test_quote_must_be_accepted(self):
        from marketing.models import Quote
        quote = Quote.objects.create(client_name='Coh')
        self.assertEqual(self._create(quote=str(quote.pk)).status_code, 400)
        Quote.objects.filter(pk=quote.pk).update(status=Quote.Status.ACCEPTE)
        self.assertEqual(self._create(quote=str(quote.pk)).status_code, 201)

    def test_paid_draft_does_not_open_period_until_validated(self):
        from services.activation import on_invoice_paid
        sub = Subscription.objects.create(client=self.client_co, offer=self.offer, start_date=date(2026, 11, 1))
        period = ServicePeriod.objects.get(pk=self.sa.post(f'{BASE}/subscriptions/{sub.pk}/generate-invoice/', {}, format='json').json()['id'])
        invoice = period.invoice
        # Paiement direct en base sur un brouillon (ancien comportement) : pas d'ouverture.
        Payment.objects.create(invoice=invoice, amount=invoice.amount_ttc, payment_date=timezone.now().date(),
                               payment_method='VIREMENT', status=Payment.Status.RECU)
        period.refresh_from_db()
        self.assertEqual(period.status, ServicePeriod.Status.EN_ATTENTE_PAIEMENT)
        Invoice.objects.filter(pk=invoice.pk).update(status=Invoice.Status.VALIDEE)
        invoice.refresh_from_db()
        self.assertTrue(on_invoice_paid(invoice))


class CronEndpointTests(APITestCase):
    def test_cron_requires_secret(self):
        import os
        from unittest.mock import patch
        url = '/api/v1/cron/daily/'
        with patch.dict(os.environ, {'CRON_SECRET': ''}):
            self.assertEqual(self.client.post(url).status_code, 404)
        with patch.dict(os.environ, {'CRON_SECRET': 's3cret'}):
            self.assertEqual(self.client.post(url, HTTP_X_CRON_SECRET='bad').status_code, 403)
            res = self.client.post(url, HTTP_X_CRON_SECRET='s3cret')
            self.assertEqual(res.status_code, 200)
            self.assertIn('send_quote_and_invoice_reminders', res.json())


class EssentielQuotaTests(APITestCase):
    def test_video_outside_formula_is_refused(self):
        mkt = _user('mkt2@x.dev', ROLE_RESPONSABLE_MARKETING_COM)
        api = _client(mkt)
        sub = Subscription.objects.create(client=Client.objects.create(company_name='C'),
                                          offer=ServiceOffer.objects.get(code='com-essentiel'), start_date=date(2026, 11, 1))
        period = ServicePeriod.objects.get(pk=api.post(f'{BASE}/subscriptions/{sub.pk}/generate-invoice/', {}, format='json').json()['id'])
        Invoice.objects.filter(pk=period.invoice_id).update(status=Invoice.Status.VALIDEE)
        Payment.objects.create(invoice=Invoice.objects.get(pk=period.invoice_id), amount=period.invoice.amount_ttc,
                               payment_date=timezone.now().date(), payment_method='VIREMENT', status=Payment.Status.RECU)
        pk = api.post(f'{BASE}/deliverables/', {'period': str(period.pk), 'kind': 'VIDEO', 'title': 'v'}, format='json').json()['id']
        for step in ('CONTROLE_INTERNE', 'VALIDE_CLIENT'):
            api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': step}, format='json')
        res = api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': 'PUBLIE'}, format='json')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertEqual(res.json()['code'], 'quota_exceeded')

    def test_communication_cannot_skip_to_livre(self):
        api = _client(_user('mkt3@x.dev', ROLE_RESPONSABLE_MARKETING_COM))
        sub = Subscription.objects.create(client=Client.objects.create(company_name='D'),
                                          offer=ServiceOffer.objects.get(code='com-pro'), start_date=date(2026, 11, 1))
        period = ServicePeriod.objects.get(pk=api.post(f'{BASE}/subscriptions/{sub.pk}/generate-invoice/', {}, format='json').json()['id'])
        Invoice.objects.filter(pk=period.invoice_id).update(status=Invoice.Status.VALIDEE)
        Payment.objects.create(invoice=Invoice.objects.get(pk=period.invoice_id), amount=period.invoice.amount_ttc,
                               payment_date=timezone.now().date(), payment_method='VIREMENT', status=Payment.Status.RECU)
        pk = api.post(f'{BASE}/deliverables/', {'period': str(period.pk), 'kind': 'PUBLICATION', 'title': 'p'}, format='json').json()['id']
        api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': 'CONTROLE_INTERNE'}, format='json')
        self.assertEqual(api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': 'LIVRE'}, format='json').status_code, 400)
        api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': 'VALIDE_CLIENT'}, format='json')
        self.assertEqual(api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': 'LIVRE'}, format='json').status_code, 400)
        self.assertEqual(api.post(f'{BASE}/deliverables/{pk}/transition/', {'status': 'PUBLIE'}, format='json').status_code, 200)

    def test_carry_over_applies_when_next_month_already_open(self):
        api = _client(_user('mkt4@x.dev', ROLE_RESPONSABLE_MARKETING_COM))
        sub = Subscription.objects.create(client=Client.objects.create(company_name='E'),
                                          offer=ServiceOffer.objects.get(code='com-pro'), start_date=date(2026, 11, 1))

        def gen_and_pay():
            p = ServicePeriod.objects.get(pk=api.post(f'{BASE}/subscriptions/{sub.pk}/generate-invoice/', {}, format='json').json()['id'])
            Invoice.objects.filter(pk=p.invoice_id).update(status=Invoice.Status.VALIDEE)
            Payment.objects.create(invoice=Invoice.objects.get(pk=p.invoice_id), amount=p.invoice.amount_ttc,
                                   payment_date=timezone.now().date(), payment_method='VIREMENT', status=Payment.Status.RECU)
            p.refresh_from_db()
            return p

        nov = gen_and_pay()
        dec = gen_and_pay()
        self.assertEqual(dec.status, ServicePeriod.Status.OUVERT)
        res = api.post(f'{BASE}/periods/{nov.pk}/close/', {'report_url': 'https://r.example/1', 'carry_over': {'publications': 1},
                                                           'carry_reason': 'Tournage reporté'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        dec.refresh_from_db()
        self.assertEqual(dec.quotas_alloues['publications'], 13)
