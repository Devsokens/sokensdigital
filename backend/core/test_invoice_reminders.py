from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from administration.models import Client
from core.constants import ROLE_COMMERCIAL, ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_RESPONSABLE_MARKETING_COM
from core.models import Role, User
from finance.models import Invoice, Payment
from services.billing import create_period_invoice
from services.models import ServiceOffer, Subscription


def _user(email, *roles, **kw):
    u = User.objects.create(email=email, **kw)
    for r in roles:
        u.roles.add(Role.objects.get_or_create(name=r)[0])
    return u


class InvoiceReminderTests(APITestCase):
    def setUp(self):
        self.author = _user('auteur@x.dev', ROLE_COMMERCIAL)
        self.compta = _user('compta@x.dev', ROLE_COMPTABLE)
        self.rcf = _user('rcf@x.dev', ROLE_DEVELOPER, is_rcf=True)
        self.mkt = _user('mkt@x.dev', ROLE_RESPONSABLE_MARKETING_COM)
        self.dev = _user('dev@x.dev', ROLE_DEVELOPER)
        self.client_co = Client.objects.create(company_name='Client X')

    def _invoice(self, **kw):
        inv = Invoice.objects.create(client=self.client_co, client_name='Client X', amount_ht=Decimal('1000'),
                                     due_date=timezone.now().date() - timedelta(days=3), created_by=self.author, **kw)
        Invoice.objects.filter(pk=inv.pk).update(status=Invoice.Status.VALIDEE)
        inv.refresh_from_db()
        return inv

    def _run(self):
        with patch('core.management.commands.send_quote_and_invoice_reminders.notify') as n,                 patch('core.mailer.send_mail') as mail:
            call_command('send_quote_and_invoice_reminders')
        mail.assert_not_called()  # jamais d'e-mail : relance interne uniquement
        for c in n.call_args_list:
            self.assertNotIn('email', c.kwargs)
        return {c.args[0].email: c.kwargs['title'] for c in n.call_args_list}

    def _notified(self, inv, sent):
        return {e for e, t in sent.items() if inv.invoice_number in t}

    def test_unpaid_notifies_department_and_finance_internally(self):
        inv = self._invoice()
        self.assertEqual(self._notified(inv, self._run()), {'auteur@x.dev', 'compta@x.dev', 'rcf@x.dev'})

    def test_paid_invoice_is_not_reminded(self):
        inv = self._invoice()
        Payment.objects.create(invoice=inv, amount=inv.amount_ttc, payment_date=timezone.now().date(),
                               payment_method='VIREMENT', status=Payment.Status.RECU)
        self.assertEqual(self._notified(inv, self._run()), set())

    def test_subscription_invoice_also_notifies_pole(self):
        sub = Subscription.objects.create(client=self.client_co, offer=ServiceOffer.objects.get(code='com-pro'),
                                          start_date=date.today() - timedelta(days=5))
        inv = create_period_invoice(sub, self.mkt).invoice
        Invoice.objects.filter(pk=inv.pk).update(status=Invoice.Status.VALIDEE)
        got = self._notified(inv, self._run())
        self.assertIn('mkt@x.dev', got)
        self.assertIn('compta@x.dev', got)
        self.assertNotIn('dev@x.dev', got)
