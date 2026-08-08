from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from core.models import AuditLog, Notification, User
from .models import Client, CompanyAsset, AdministrativeRecord, LeaveRequest

@receiver(pre_save, sender=Client)
def client_status_change(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = Client.objects.get(pk=instance.pk)
            if old_instance.status != instance.status:
                AuditLog.objects.log_action(
                    None, "STATUS_CHANGE", "Client", instance.id,
                    f"Status changed from {old_instance.status} to {instance.status}",
                    "127.0.0.1"
                )
        except Client.DoesNotExist:
            pass

@receiver(pre_save, sender=CompanyAsset)
def asset_holder_change(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = CompanyAsset.objects.get(pk=instance.pk)
            if old_instance.current_holder != instance.current_holder:
                holder_name = instance.current_holder.email if instance.current_holder else "None"
                AuditLog.objects.log_action(
                    None, "HOLDER_CHANGE", "CompanyAsset", instance.id,
                    f"Holder changed to {holder_name}",
                    "127.0.0.1"
                )
        except CompanyAsset.DoesNotExist:
            pass

@receiver(post_save, sender=AdministrativeRecord)
def admin_record_public_notification(sender, instance, created, **kwargs):
    """
    Notification globale à la création d'un registre public. Ne se
    redéclenche pas sur les sauvegardes suivantes (ex. finalize()) —
    seule la création initiale en is_public_internally=True notifie,
    pour éviter de renotifier toute l'entreprise à chaque modification.
    """
    if created and instance.is_public_internally:
        active_user_ids = User.objects.filter(is_active=True).values_list('id', flat=True)
        Notification.objects.bulk_create([
            Notification(
                user_id=user_id,
                title=f'Nouveau document administratif — {instance.title}',
                message=f'"{instance.title}" a été publié au registre administratif.',
                notification_type=Notification.NotificationType.ADMIN_RECORD,
                entity_type='AdministrativeRecord',
                entity_id=str(instance.pk),
            )
            for user_id in active_user_ids
        ])

@receiver(pre_save, sender=LeaveRequest)
def leave_request_status_notification(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = LeaveRequest.objects.get(pk=instance.pk)
            if old_instance.status != instance.status:
                Notification.objects.create(
                    user=instance.user,
                    title="Mise à jour de congé",
                    message=f"Le statut de votre demande a été mis à jour vers {instance.status}.",
                    notification_type=Notification.NotificationType.LEAVE_REQUEST,
                    entity_type="LeaveRequest",
                    entity_id=instance.id,
                    link=f"/leaves/{instance.id}"
                )
        except LeaveRequest.DoesNotExist:
            pass
