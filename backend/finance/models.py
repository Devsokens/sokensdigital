from django.db import models

from core.models import LoggedModel, User
from projects.models import Project


class DisbursementRequest(LoggedModel):
    """docs/backend-specifications.md §6.3. Only the N1 initiation step is
    implemented — N2/N3 approval (Directeur Financier/Super-Admin) and
    execution (Comptable) belong to the rest of the Finance department,
    not built yet. `status` only ever reaches EN_ATTENTE_N1 through this
    module; the later values exist on the enum so a future migration
    isn't needed to add the approval workflow."""

    class Status(models.TextChoices):
        EN_ATTENTE_N1 = 'EN_ATTENTE_N1', 'En attente (N1)'
        EN_ATTENTE_N2 = 'EN_ATTENTE_N2', 'En attente (N2)'
        APPROUVE = 'APPROUVE', 'Approuvé'
        REJETE = 'REJETE', 'Rejeté'
        EXECUTE = 'EXECUTE', 'Exécuté'

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='disbursement_requests')
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='disbursement_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    beneficiary = models.CharField(max_length=255)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_ATTENTE_N1)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['project']),
        ]

    def __str__(self):
        return f'{self.beneficiary} — {self.amount} ({self.status})'

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({'amount': 'Le montant doit être positif.'})
