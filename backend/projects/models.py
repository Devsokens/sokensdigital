from django.core.exceptions import ValidationError
from django.db import models

from core.models import LoggedModel, User


class Project(LoggedModel):
    class Status(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        EN_PAUSE = 'EN_PAUSE', 'En pause'
        TERMINE = 'TERMINE', 'Terminé'
        ANNULE = 'ANNULE', 'Annulé'

    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_COURS)
    lead_project_manager = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='led_projects'
    )
    team_members = models.ManyToManyField(User, through='ProjectMember', related_name='projects', blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({'end_date': 'La date de fin ne peut pas précéder la date de début.'})


class ProjectMember(LoggedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='project_memberships')

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['project', 'user']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['project', 'user'], name='unique_project_member'),
        ]

    def __str__(self):
        return f'{self.user} @ {self.project}'


class Timesheet(LoggedModel):
    class Status(models.TextChoices):
        SOUMIS = 'SOUMIS', 'Soumis'
        VALIDE = 'VALIDE', 'Validé'
        REJETE = 'REJETE', 'Rejeté'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='timesheets')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='timesheets')
    date = models.DateField()
    hours = models.DecimalField(max_digits=4, decimal_places=2)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SOUMIS)

    class Meta(LoggedModel.Meta):
        ordering = ['-date']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['user', 'date']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['project', 'user', 'date'], name='unique_timesheet_per_day'),
        ]

    def __str__(self):
        return f'{self.user} — {self.project} — {self.date} ({self.hours}h)'

    def clean(self):
        super().clean()
        if not (0 < self.hours <= 24):
            raise ValidationError({'hours': 'Le nombre d\'heures doit être compris entre 0 et 24.'})
