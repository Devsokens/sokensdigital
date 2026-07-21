from django.test import TestCase
from administration.tasks import (
    follow_up_reminders, auto_archive, document_expiry,
    expired_contracts, generate_pdf, import_payslips
)

class AdministrationTaskTests(TestCase):
    def test_all_tasks(self):
        follow_up_reminders()
        auto_archive()
        document_expiry()
        expired_contracts()
        generate_pdf('00000000-0000-0000-0000-000000000000')
        import_payslips('/dummy/path')
