from django.core.exceptions import ValidationError
from django.db import models

from core.models import LoggedModel, User


class Project(LoggedModel):
    class Status(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        EN_PAUSE = 'EN_PAUSE', 'En pause'
        TERMINE = 'TERMINE', 'Terminé'
        ANNULE = 'ANNULE', 'Annulé'

    class Priority(models.TextChoices):
        BASSE = 'BASSE', 'Basse'
        MOYENNE = 'MOYENNE', 'Moyenne'
        HAUTE = 'HAUTE', 'Haute'

    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_COURS)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MOYENNE)
    category = models.CharField(max_length=100, blank=True)
    lead_project_manager = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='led_projects'
    )
    team_members = models.ManyToManyField(User, through='ProjectMember', related_name='projects', blank=True)
    pinned_by = models.ManyToManyField(User, related_name='pinned_projects', blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)

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


class ProjectTask(LoggedModel):
    class Status(models.TextChoices):
        TODO = 'TODO', 'À faire'
        IN_PROGRESS = 'IN_PROGRESS', 'En cours'
        IN_REVIEW = 'IN_REVIEW', 'En révision'
        DONE = 'DONE', 'Terminé'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TODO)
    due_date = models.DateField(null=True, blank=True)
    progress = models.PositiveSmallIntegerField(default=0)
    assignees = models.ManyToManyField(User, related_name='project_tasks', blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(LoggedModel.Meta):
        ordering = ['created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['project', 'status']),
        ]

    def clean(self):
        super().clean()
        if not (0 <= self.progress <= 100):
            raise ValidationError({'progress': 'La progression doit être comprise entre 0 et 100.'})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.project.name} — {self.title}'


class ProjectTaskComment(LoggedModel):
    task = models.ForeignKey(ProjectTask, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='project_task_comments')
    body = models.TextField()

    class Meta(LoggedModel.Meta):
        ordering = ['created_at']

    def __str__(self):
        return f'{self.author} on {self.task}'


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
    task = models.ForeignKey(
        ProjectTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='timesheets',
    )
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
            # NULL task values don't collide under a unique constraint (SQL
            # NULL <> NULL), so entries with no task attributed can still
            # stack per (project, user, date) — only same-task duplicates
            # for the same day are rejected.
            models.UniqueConstraint(fields=['project', 'task', 'user', 'date'], name='unique_timesheet_per_task_per_day'),
        ]

    def __str__(self):
        return f'{self.user} — {self.project} — {self.date} ({self.hours}h)'

    def clean(self):
        super().clean()
        if not (0 < self.hours <= 24):
            raise ValidationError({'hours': 'Le nombre d\'heures doit être compris entre 0 et 24.'})
