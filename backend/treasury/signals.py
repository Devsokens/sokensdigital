from django.db.models.signals import post_save
from django.dispatch import receiver

from treasury.models import CashEntry, BankEntry, CapitalContribution
from treasury.tasks import (
    post_cash_entry_journal_entry,
    post_bank_entry_journal_entry,
)


@receiver(post_save, sender=CashEntry)
def on_cash_entry_created(sender, instance, created, **kwargs):
    """
    Quand CashEntry créée:
    - Auto-post JournalEntry (Caisse / Client ou Banque)
    Signal: post_save sur CashEntry
    """
    if created and instance.reconciled_at is not None:
        # Déclencher task async pour poster comptabilité
        post_cash_entry_journal_entry.delay(str(instance.id))


@receiver(post_save, sender=BankEntry)
def on_bank_entry_created(sender, instance, created, **kwargs):
    """
    Quand BankEntry créée:
    - Auto-post JournalEntry (Banque / Client, Banque, Capital, Caisse)
    Signal: post_save sur BankEntry
    """
    if created and instance.reconciled_at is not None:
        post_bank_entry_journal_entry.delay(str(instance.id))


@receiver(post_save, sender=CapitalContribution)
def on_capital_contribution_posted(sender, instance, created, **kwargs):
    """
    Quand CapitalContribution validée + status=COMPTABILISEE:
    - Auto-post JournalEntry (Banque / Capital)
    """
    if instance.status == CapitalContribution.Status.COMPTABILISEE and instance.posted_at is None:
        from treasury.tasks import post_capital_contribution_journal_entry
        post_capital_contribution_journal_entry.delay(str(instance.id))
