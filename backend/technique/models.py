from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.models import LoggedModel, User
from administration.models import Client
from django_cryptography.fields import encrypt

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
    A_FAIRE = 'A_FAIRE', 'À faire'
    EN_COURS = 'EN_COURS', 'En cours'
    EN_REVISION = 'EN_REVISION', 'En révision'
    TERMINE = 'TERMINE', 'Terminé'

class TaskPriority(models.TextChoices):
    BASSE = 'BASSE', 'Basse'
    MOYENNE = 'MOYENNE', 'Moyenne'
    HAUTE = 'HAUTE', 'Haute'
    CRITIQUE = 'CRITIQUE', 'Critique'

class TicketStatus(models.TextChoices):
    NOUVEAU = 'NOUVEAU', 'Nouveau'
    ASSIGNE = 'ASSIGNE', 'Assigné'
    RESOLU = 'RESOLU', 'Résolu'
    FERME = 'FERME', 'Fermé'

class TicketSeverity(models.TextChoices):
    BASSE = 'BASSE', 'Basse'
    MOYENNE = 'MOYENNE', 'Moyenne'
    HAUTE = 'HAUTE', 'Haute'
    CRITIQUE = 'CRITIQUE', 'Critique'

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

    class Meta(LoggedModel.Meta):
        # Colonnes réellement filtrées par ProjectViewSet.filterset_fields —
        # sans index, chaque filtre force un parcours complet de la table.
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['client']),
            models.Index(fields=['project_manager']),
        ]

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
    priority = models.CharField(max_length=50, choices=TaskPriority.choices, default=TaskPriority.MOYENNE)
    estimated_hours = models.DecimalField(max_digits=7, decimal_places=2)
    actual_hours = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    due_date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-priority', 'due_date']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['phase']),
            # Couvre l'ordering par défaut : sans lui, chaque liste de
            # tâches trie en mémoire après lecture complète.
            models.Index(fields=['-priority', 'due_date']),
        ]

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
    status = models.CharField(max_length=50, choices=TicketStatus.choices, default=TicketStatus.NOUVEAU)
    severity = models.CharField(max_length=50, choices=TicketSeverity.choices, default=TicketSeverity.MOYENNE)
    assigned_developer = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['project']),
            models.Index(fields=['assigned_developer']),
        ]

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


# ---------------------------------------------------------------------------
# Maintenance — applications et sites livrés que l'équipe technique entretient
# ---------------------------------------------------------------------------

class MaintenanceFrequency(models.TextChoices):
    TROIS_PAR_SEMAINE = 'TROIS_PAR_SEMAINE', '3 fois par semaine'
    HEBDOMADAIRE = 'HEBDOMADAIRE', 'Hebdomadaire'
    BIMENSUELLE = 'BIMENSUELLE', 'Toutes les 2 semaines'
    MENSUELLE = 'MENSUELLE', 'Mensuelle'


class MaintainedAppType(models.TextChoices):
    SITE_WEB = 'SITE_WEB', 'Site web'
    APP_WEB = 'APP_WEB', 'Application web'
    APP_MOBILE = 'APP_MOBILE', 'Application mobile'
    API = 'API', 'API / service'
    AUTRE = 'AUTRE', 'Autre'


class MaintainedApp(LoggedModel):
    """Une application ou un site livré au client, que l'équipe technique
    doit entretenir périodiquement.

    Porte deux natures de données très différentes :
    - la fiche descriptive (nom, URL, stack, hébergeur...), lisible par
      toute l'équipe technique ;
    - les accès (URL admin, identifiants), chiffrés au repos et
      volontairement exclus du serializer de liste — voir
      MaintainedAppSerializer / MaintainedAppSecretsSerializer.
    """

    name = models.CharField(max_length=255)
    app_type = models.CharField(max_length=20, choices=MaintainedAppType.choices, default=MaintainedAppType.SITE_WEB)
    url = models.URLField(blank=True, help_text='URL publique de production')
    description = models.TextField(blank=True)

    client = models.ForeignKey(
        'administration.Client', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='maintained_apps',
    )
    project = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='maintained_apps',
    )

    # Infos essentielles — stack, hébergement, dépôt.
    tech_stack = models.CharField(max_length=255, blank=True, help_text='Ex: Next.js, Django, PostgreSQL')
    hosting_provider = models.CharField(max_length=255, blank=True, help_text='Ex: Vercel, Render, OVH')
    repository_url = models.URLField(blank=True)

    # Accès à l'espace d'administration — chiffrés au repos (AES via
    # django-cryptography), même traitement que administration.ClientDocument.
    # name : ces valeurs ouvrent des systèmes de production, une fuite de dump
    # SQL ne doit pas suffire à les lire.
    admin_url = models.URLField(blank=True)
    admin_username = encrypt(models.CharField(max_length=255, blank=True, default=''))
    admin_password = encrypt(models.CharField(max_length=255, blank=True, default=''))
    access_notes = encrypt(models.TextField(blank=True, default=''))

    # Attribution — décidée par le responsable de l'équipe technique
    # (Chef de Projet / Admin / Super-Admin, cf. CanAssignMaintenance).
    assigned_to = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='maintained_apps',
    )
    assigned_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_maintenance_apps',
    )
    assigned_at = models.DateTimeField(null=True, blank=True)

    maintenance_frequency = models.CharField(
        max_length=20, choices=MaintenanceFrequency.choices,
        default=MaintenanceFrequency.TROIS_PAR_SEMAINE,
    )
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(LoggedModel.Meta):
        ordering = ['name']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['is_active']),
            models.Index(fields=['assigned_to']),
        ]

    def __str__(self):
        return self.name

    @property
    def expected_reports_per_week(self):
        return {
            MaintenanceFrequency.TROIS_PAR_SEMAINE: 3,
            MaintenanceFrequency.HEBDOMADAIRE: 1,
            MaintenanceFrequency.BIMENSUELLE: 0.5,
            MaintenanceFrequency.MENSUELLE: 0.25,
        }.get(self.maintenance_frequency, 0)


class MaintenanceServiceAccount(LoggedModel):
    """Compte d'un service tiers utilisé PAR une application maintenue
    (hébergeur, base de données, mail transactionnel, CDN, analytics...).

    Séparé de MaintainedApp parce qu'une même app en cumule facilement
    cinq ou six, chacun avec ses propres identifiants — les entasser en
    champs texte sur l'app aurait été ingérable.
    """

    app = models.ForeignKey(MaintainedApp, on_delete=models.CASCADE, related_name='service_accounts')
    service_name = models.CharField(max_length=255, help_text='Ex: Cloudinary, Supabase, SendGrid')
    url = models.URLField(blank=True)
    username = encrypt(models.CharField(max_length=255, blank=True, default=''))
    password = encrypt(models.CharField(max_length=255, blank=True, default=''))
    notes = encrypt(models.TextField(blank=True, default=''))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(LoggedModel.Meta):
        ordering = ['service_name']

    def __str__(self):
        return f'{self.service_name} ({self.app.name})'


class MaintenanceReport(LoggedModel):
    """Compte-rendu d'une session de maintenance, visible par toute
    l'équipe technique."""

    class Status(models.TextChoices):
        OK = 'OK', 'Tout fonctionne'
        DEGRADE = 'DEGRADE', 'Dégradé — à surveiller'
        INCIDENT = 'INCIDENT', 'Incident — action requise'

    app = models.ForeignKey(MaintainedApp, on_delete=models.CASCADE, related_name='reports')
    performed_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, related_name='maintenance_reports',
    )
    performed_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OK)

    # Points de contrôle usuels — cochés à chaque passage.
    site_reachable = models.BooleanField(default=True, help_text='Le site/app répond')
    backups_verified = models.BooleanField(default=False, help_text='Sauvegardes vérifiées')
    updates_applied = models.BooleanField(default=False, help_text='Mises à jour appliquées')
    ssl_valid = models.BooleanField(default=True, help_text='Certificat SSL valide')

    summary = models.TextField(help_text='Ce qui a été fait / constaté')
    next_actions = models.TextField(blank=True, help_text='À faire au prochain passage')

    class Meta(LoggedModel.Meta):
        ordering = ['-performed_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['app', '-performed_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.app.name} — {self.performed_at:%Y-%m-%d} ({self.status})'
