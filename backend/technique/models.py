from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.models import LoggedModel, User
from administration.models import Client

class ProjectStatus(models.TextChoices):
    PROSPECTION = 'PROSPECTION', 'Prospection'
    DEVIS_ENVOYE = 'DEVIS_ENVOYE', 'Devis Envoyé'
    NEGOCIATION = 'NEGOCIATION', 'Négociation'
    EN_COURS = 'EN_COURS', 'En Cours'
    EN_RECETTE = 'EN_RECETTE', 'En Recette'
    LIVRE = 'LIVRE', 'Livré'
    CLOS = 'CLOS', 'Clos'

class PhaseStatus(models.TextChoices):
    A_FAIRE = 'A_FAIRE', 'À Faire'
    EN_COURS = 'EN_COURS', 'En Cours'
    TERMINE = 'TERMINE', 'Terminé'

class DocumentType(models.TextChoices):
    CAHIER_CHARGES = 'CAHIER_CHARGES', 'Cahier des Charges'
    SPECIFICATION = 'SPECIFICATION', 'Spécification'
    LIVRABLE = 'LIVRABLE', 'Livrable'
    RECETTE = 'RECETTE', 'Recette'
    RAPPORT = 'RAPPORT', 'Rapport'
    AUTRE = 'AUTRE', 'Autre'

class TaskStatus(models.TextChoices):
    BACKLOG = 'BACKLOG', 'Backlog'
    TODO = 'TODO', 'To Do'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    REVIEW = 'REVIEW', 'Review'
    DONE = 'DONE', 'Done'

class TaskPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'

class TicketStatus(models.TextChoices):
    NEW = 'NEW', 'New'
    ASSIGNED = 'ASSIGNED', 'Assigned'
    RESOLVED = 'RESOLVED', 'Resolved'
    CLOSED = 'CLOSED', 'Closed'

class TicketSeverity(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'

class Project(LoggedModel):
    client = models.ForeignKey('administration.Client', on_delete=models.PROTECT, related_name='projects')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2)
    cost_rate = models.DecimalField(max_digits=8, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    actual_end_date = models.DateField(null=True, blank=True)
    project_manager = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='managed_projects')
    members = models.ManyToManyField('core.User', related_name='projects_member')
    status = models.CharField(max_length=50, choices=ProjectStatus.choices, default=ProjectStatus.PROSPECTION)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def total_cost(self):
        total_hours = sum(t.actual_hours for t in self.tasks.all())
        return total_hours * self.cost_rate

    @property
    def is_over_budget(self):
        return self.total_cost > self.budget

    def __str__(self):
        return self.name

class ProjectPhase(LoggedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='phases')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=50, choices=PhaseStatus.choices, default=PhaseStatus.A_FAIRE)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']
        unique_together = ['project', 'order']

    def clean(self):
        if self.end_date and self.project and self.project.end_date:
            if self.end_date > self.project.end_date:
                raise ValidationError({'end_date': 'Phase end_date cannot be after project end_date.'})
        # Défense en profondeur : la vue bloque déjà ce cas (ProjectPhaseViewSet.
        # perform_update), mais le modèle doit aussi refuser un TERMINE sans
        # LIVRABLE pour tout appelant qui contourne la vue (admin Django,
        # shell, script, autre app).
        if self.status == PhaseStatus.TERMINE and self.pk:
            if not self.documents.filter(document_type=DocumentType.LIVRABLE).exists():
                raise ValidationError({
                    'status': 'Impossible de terminer une phase sans document de type LIVRABLE.',
                })

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.project.name} - {self.name}"

class ProjectDocument(LoggedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='documents')
    phase = models.ForeignKey(ProjectPhase, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    document_type = models.CharField(max_length=50, choices=DocumentType.choices, default=DocumentType.AUTRE)
    uploaded_by = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='uploaded_documents')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Task(LoggedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    phase = models.ForeignKey(ProjectPhase, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    status = models.CharField(max_length=50, choices=TaskStatus.choices, default=TaskStatus.BACKLOG)
    priority = models.CharField(max_length=50, choices=TaskPriority.choices, default=TaskPriority.MEDIUM)
    estimated_hours = models.DecimalField(max_digits=7, decimal_places=2)
    actual_hours = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    due_date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', 'due_date']

    def __str__(self):
        return self.name

class TimeEntry(LoggedModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='time_entries')
    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='time_entries')
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    date = models.DateField()
    description = models.TextField()

    class Meta:
        ordering = ['-date', '-created_at']

    def clean(self):
        if self.date and self.date > timezone.now().date():
            raise ValidationError({'date': 'Date cannot be in the future.'})
        # Défense en profondeur : plafond 24h/jour déjà vérifié côté
        # serializer (TimeEntrySerializer.validate), reproduit ici pour
        # bloquer aussi un .save() direct (admin Django, shell, script).
        if self.user_id and self.date and self.hours is not None:
            qs = TimeEntry.objects.filter(user_id=self.user_id, date=self.date)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            total = qs.aggregate(total=models.Sum('hours'))['total'] or 0
            if total + self.hours > 24:
                raise ValidationError({
                    'hours': 'Total hours for a user on a given date cannot exceed 24 hours.',
                })

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} - {self.task.name} ({self.hours}h)"

class Ticket(LoggedModel):
    client = models.ForeignKey('administration.Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=50, choices=TicketStatus.choices, default=TicketStatus.NEW)
    severity = models.CharField(max_length=50, choices=TicketSeverity.choices, default=TicketSeverity.MEDIUM)
    assigned_developer = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class KnowledgeBase(LoggedModel):
    title = models.CharField(max_length=255)
    content = models.TextField()
    tags = models.JSONField(default=list, blank=True)  # List of tag strings
    created_by = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='kb_articles')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title
