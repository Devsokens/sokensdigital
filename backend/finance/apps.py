from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'finance'

    def ready(self):
        from django.db.models.signals import post_delete, post_save

        from finance.invoice_deletion import invalidate_dashboards
        from finance.models import Invoice, JournalEntry, Payment, TransactionLine

        # L'analytique Finance est mise en cache : elle doit refléter les
        # données réelles dès qu'une facture, un versement ou une écriture
        # change (y compris une suppression).
        for model in (Invoice, Payment, JournalEntry, TransactionLine):
            post_save.connect(invalidate_dashboards, sender=model, dispatch_uid=f'fin-dash-save-{model.__name__}')
            post_delete.connect(invalidate_dashboards, sender=model, dispatch_uid=f'fin-dash-del-{model.__name__}')
