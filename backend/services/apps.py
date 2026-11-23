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

        # Tableau de bord global (clé `subscriptions`) : abonnements actifs,
        # revenu récurrent, mois impayés — à jour dès qu'un abonnement ou une
        # période change (création, suspension, résiliation, suppression).
        from django.db.models.signals import post_delete

        from finance.invoice_deletion import invalidate_dashboards
        from services.models import ServicePeriod, Subscription
        for model in (Subscription, ServicePeriod):
            post_save.connect(invalidate_dashboards, sender=model, dispatch_uid=f'svc-dash-save-{model.__name__}')
            post_delete.connect(invalidate_dashboards, sender=model, dispatch_uid=f'svc-dash-del-{model.__name__}')

        post_save.connect(payment_saved, sender=Payment, dispatch_uid='services_open_period_on_payment')
