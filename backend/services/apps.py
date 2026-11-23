from django.apps import AppConfig


class ServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'services'
    verbose_name = 'Abonnements de services'

    def ready(self):
        from django.db.models.signals import post_save

        from finance.models import Payment

        def payment_saved(sender, instance, **kwargs):
            # Tout encaissement (reçu ou enregistré) peut solder la facture
            # d'une période : on tente l'ouverture, sans effet sinon.
            if instance.status in (Payment.Status.RECU, Payment.Status.ENREGISTRE):
                from services.activation import on_invoice_paid
                on_invoice_paid(instance.invoice)

        post_save.connect(payment_saved, sender=Payment, dispatch_uid='services_open_period_on_payment')
