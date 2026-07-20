from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from core.models import LoggedModel, User

# Standard monthly-hours divisor used to derive an hourly cost from a gross
# monthly salary (35h/week legal reference, France/OHADA-aligned). Not a
# per-employee setting yet — revisit if contracts with different weekly
# hours are introduced.
HOURS_PER_MONTH = Decimal('151.67')


class EmployeeProfile(LoggedModel):
    class Status(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        INACTIF = 'INACTIF', 'Inactif'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    position = models.CharField(max_length=255, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    gross_monthly_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    base_hourly_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIF)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.user} — {self.position or "Sans poste"}'

    def save(self, *args, **kwargs):
        if self.gross_monthly_salary is not None:
            self.base_hourly_cost = (self.gross_monthly_salary / HOURS_PER_MONTH).quantize(Decimal('0.01'))
        else:
            self.base_hourly_cost = None
        super().save(*args, **kwargs)


class Contract(LoggedModel):
    class ContractType(models.TextChoices):
        CDI = 'CDI', 'CDI'
        CDD = 'CDD', 'CDD'
        STAGE = 'STAGE', 'Stage'
        FREELANCE = 'FREELANCE', 'Freelance'

    class Status(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        TERMINE = 'TERMINE', 'Terminé'

    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name='contracts')
    contract_type = models.CharField(max_length=10, choices=ContractType.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    signed_at = models.DateField(null=True, blank=True)
    # Google Drive share link — no upload pipeline yet (see
    # docs/backend-specifications.md), pasted by hand for now.
    file_url = models.URLField(blank=True, null=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIF)

    class Meta(LoggedModel.Meta):
        ordering = ['-start_date']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['employee', 'status']),
        ]

    def __str__(self):
        return f'{self.contract_type} — {self.employee}'

    def clean(self):
        super().clean()
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError({'end_date': 'La date de fin ne peut pas précéder la date de début.'})


class Payslip(LoggedModel):
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name='payslips')
    period_month = models.PositiveSmallIntegerField()
    period_year = models.PositiveSmallIntegerField()
    file_url = models.URLField()

    class Meta(LoggedModel.Meta):
        ordering = ['-period_year', '-period_month']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['employee', 'period_year', 'period_month']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'period_year', 'period_month'], name='unique_payslip_period'
            ),
        ]

    def __str__(self):
        return f'{self.employee} — {self.period_month}/{self.period_year}'

    def clean(self):
        super().clean()
        if not (1 <= self.period_month <= 12):
            raise ValidationError({'period_month': 'Le mois doit être compris entre 1 et 12.'})
