from django.db import models
from django.utils.text import slugify

from core.models import LoggedModel, User


class Lead(LoggedModel):
    class Source(models.TextChoices):
        FORMULAIRE_CONTACT = 'FORMULAIRE_CONTACT', 'Formulaire de contact'
        FORMULAIRE_DEVIS = 'FORMULAIRE_DEVIS', 'Formulaire de devis'
        APPEL_ENTRANT = 'APPEL_ENTRANT', 'Appel entrant'
        SITE_WEB = 'SITE_WEB', 'Site web'
        EVENEMENT = 'EVENEMENT', 'Événement'

    class Status(models.TextChoices):
        NOUVEAU = 'NOUVEAU', 'Nouveau'
        QUALIFIE = 'QUALIFIE', 'Qualifié'
        PROPOSITION_EN_COURS = 'PROPOSITION_EN_COURS', 'Proposition en cours'
        PERDU = 'PERDU', 'Perdu'
        CONVERTI = 'CONVERTI', 'Converti'

    # `client` (FK -> ClientAccount) omitted — ClientAccount isn't defined
    # yet (docs/backend-specifications.md §13, open question). Add once
    # clarified; the /convert/ endpoint depends on it too and is not
    # implemented for the same reason.
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=30, choices=Source.choices)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.NOUVEAU)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_leads')
    qualification_score = models.PositiveSmallIntegerField(default=0)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['assigned_to']),
        ]

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.company_name or "particulier"})'

    def clean(self):
        super().clean()
        if not (0 <= self.qualification_score <= 100):
            from django.core.exceptions import ValidationError
            raise ValidationError({'qualification_score': 'Le score doit être compris entre 0 et 100.'})


class BlogPost(LoggedModel):
    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        PUBLIE = 'PUBLIE', 'Publié'

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='blog_posts')
    excerpt = models.TextField(blank=True)
    # Rich content as structured JSON blocks — mirrors frontend's
    # lib/blog/types.ts `Block[]` shape exactly (p/h2/h3/code/table/compare/
    # callout), NOT a single HTML string. The original spec's
    # `content_html` was written before checking what the frontend already
    # renders; a flat HTML string would have meant rebuilding the blog
    # article renderer from scratch. `callout` blocks and `visual_icon`
    # store an icon *name* (e.g. "ShieldCheck"), not a component — the
    # frontend maps name -> lucide-react component itself.
    content = models.JSONField(default=list)
    visual_icon = models.CharField(max_length=100, blank=True)
    visual_label = models.CharField(max_length=255, blank=True)
    visual_sublabel = models.CharField(max_length=255, blank=True)
    tags = models.JSONField(default=list)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.BROUILLON)
    published_at = models.DateTimeField(null=True, blank=True)
    meta_description = models.CharField(max_length=300, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-published_at', '-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['slug']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)
