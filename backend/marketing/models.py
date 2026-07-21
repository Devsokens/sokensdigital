import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from core.models import LoggedModel, User

# Placeholder — no confirmed VAT rate for Soken's Digital's jurisdiction
# anywhere in the specs gathered so far. 18% is the common OHADA/CEMAC
# baseline; replace with a real configured rate (or a per-Quote override)
# once Finance/Comptabilité confirms it.
DEFAULT_VAT_RATE = Decimal('0.18')


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
    # Not in the original spec's Lead field list — added to make the
    # "pipeline commercial pondéré" dashboard calc
    # (docs/backend-specifications.md §7.5) possible at all. Without an
    # estimated deal value there is nothing to weight; `Quote.total_ht`
    # would be the more precise source once Quote exists, but Quote isn't
    # built yet (§7.2, ⏳).
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

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


class SocialPost(LoggedModel):
    class Platform(models.TextChoices):
        LINKEDIN = 'LINKEDIN', 'LinkedIn'
        TWITTER = 'TWITTER', 'Twitter/X'
        FACEBOOK = 'FACEBOOK', 'Facebook'
        INSTAGRAM = 'INSTAGRAM', 'Instagram'
        YOUTUBE = 'YOUTUBE', 'YouTube'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Brouillon'
        SCHEDULED = 'SCHEDULED', 'Programmé'
        PUBLISHED = 'PUBLISHED', 'Publié'
        FAILED = 'FAILED', 'Échec'
        CANCELLED = 'CANCELLED', 'Annulé'

    title = models.CharField(max_length=255)
    content = models.TextField()
    image_path = models.URLField(blank=True)
    additional_images = models.JSONField(default=list)
    platform = models.CharField(max_length=20, choices=Platform.choices)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    post_url = models.URLField(blank=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='social_posts')
    notes = models.TextField(blank=True)
    tags = models.JSONField(default=list)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['platform']),
        ]

    def __str__(self):
        return f'{self.title} ({self.platform})'

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.platform == self.Platform.TWITTER and len(self.content) > 280:
            raise ValidationError({'content': 'Twitter/X est limité à 280 caractères.'})
        if self.platform == self.Platform.INSTAGRAM and not self.image_path:
            raise ValidationError({'image_path': 'Instagram nécessite une image.'})


class Quote(LoggedModel):
    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        ENVOYE = 'ENVOYE', 'Envoyé'
        ACCEPTE = 'ACCEPTE', 'Accepté'
        REFUSE = 'REFUSE', 'Refusé'

    # `client` (FK -> ClientAccount) omitted — same open question as Lead
    # (docs/backend-specifications.md §13).
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotes')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotes')
    quote_number = models.CharField(max_length=20, unique=True, editable=False)
    issue_date = models.DateField(default=timezone.now)
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.BROUILLON)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    total_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'), editable=False)
    total_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'), editable=False)
    # Crypto-random, not a sequential/guessable ID — this token IS the
    # public tracking link's authentication (docs/backend-specifications.md
    # §7.2 `/api/v1/public/quotes/track/{tracking_token}/`).
    tracking_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    opened_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    # Versioning for the /clone/ endpoint — a sent quote is read-only, a
    # new edit becomes a new Quote row (parent_quote -> original, version
    # incremented), never an in-place edit of something already sent.
    parent_quote = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='versions')
    version = models.PositiveSmallIntegerField(default=1)

    class Meta(LoggedModel.Meta):
        ordering = ['-created_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['created_by']),
        ]

    def __str__(self):
        return self.quote_number

    @property
    def is_locked(self):
        return self.status != self.Status.BROUILLON

    def recalculate_totals(self):
        subtotal = sum((line.total_line for line in self.lines.all()), Decimal('0'))
        self.total_ht = subtotal - self.discount_amount
        self.total_ttc = (self.total_ht * (1 + DEFAULT_VAT_RATE)).quantize(Decimal('0.01'))
        self.save(update_fields=['total_ht', 'total_ttc'])

    def save(self, *args, **kwargs):
        if not self.quote_number:
            year = timezone.now().year
            last = Quote.objects.filter(quote_number__startswith=f'DEV-{year}-').order_by('-quote_number').first()
            seq = int(last.quote_number.split('-')[2]) + 1 if last else 1
            self.quote_number = f'DEV-{year}-{seq:05d}'
        super().save(*args, **kwargs)


class QuoteLine(LoggedModel):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='lines')
    service_title = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1'))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    # Recalculated server-side on every save — never trust a client-supplied
    # total_line (docs/backend-specifications.md §7.2).
    total_line = models.DecimalField(max_digits=12, decimal_places=2, editable=False)

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes

    def __str__(self):
        return f'{self.service_title} x{self.quantity}'

    def save(self, *args, **kwargs):
        self.total_line = (self.quantity * self.unit_price).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)
        self.quote.recalculate_totals()


class PageSection(LoggedModel):
    """A single editable "slot" of the public marketing site — one row per
    section of one public page (docs/backend-specifications.md §7.3). The
    set of sections per page is fixed (mirrors the real page template, e.g.
    `app/page.tsx`'s hero/services/testimonials/... order) — this model
    lets Marketing edit the copy of each slot, not add/remove slots, so
    there's no create/destroy endpoint, only list + partial_update.

    `items` is a flexible JSON list whose shape depends on `section_key`
    (documented per-key in SectionKey below) — same "structured blocks, not
    freeform HTML" reasoning as BlogPost.content."""

    class Page(models.TextChoices):
        ACCUEIL = 'ACCUEIL', 'Accueil'
        EXPERTISE = 'EXPERTISE', 'Expertise'
        SUIVI_PROJET = 'SUIVI_PROJET', 'Suivi de projet'

    class SectionKey(models.TextChoices):
        # --- Accueil ---
        # items: [{value, label}] — the 3 stat callouts under the hero.
        HERO = 'hero', 'Hero'
        # items: [{icon, title, description}]
        SERVICES = 'services', 'Services'
        # items unused — the carousel content itself is still driven by
        # lib/projects/projects.ts on the frontend until the public
        # "Projets vitrine" module exists; only title/subtitle are editable.
        RECENT_PROJECTS = 'recent_projects', 'Projets récents'
        # items: [{quote, name, role}]
        TESTIMONIALS = 'testimonials', 'Témoignages'
        # items: [{name, role, bio, photo_url}]
        TEAM = 'team', 'Équipe'
        # items: [{name, logo_url}]
        PARTNER_LOGOS = 'partner_logos', 'Logos partenaires'
        # items unused — posts themselves still come from lib/blog/posts.ts
        # until the public blog is wired to BlogPost; only title/cta editable.
        BLOG_INSIGHTS = 'blog_insights', 'Aperçu blog'
        # items unused — title/subtitle/cta only.
        CTA = 'cta', 'CTA final'
        # --- Expertise ---
        # items: [{label, sublabel}] — single entry, the visual panel caption.
        EXPERTISE_HERO = 'expertise_hero', 'Hero (Expertise)'
        # items: [{icon, title, description}]
        STRATEGIC_ADVANTAGES = 'strategic_advantages', 'Avantages stratégiques'
        # items: [{phase, title, description}]
        PROCESS_TIMELINE = 'process_timeline', 'Processus'
        # items: [{name, label}]
        TECH_STACK = 'tech_stack', 'Stack technique'
        # items unused — title/subtitle/cta only.
        FEATURED_CASE_STUDY = 'featured_case_study', 'Étude de cas vedette'
        # --- Suivi de projet ---
        # items unused — title/subtitle only (the search form itself isn't editable content).
        TRACKING_HERO = 'tracking_hero', 'Hero (Suivi de projet)'
        # items: [{icon, title, description}]
        TRACKING_FEATURES = 'tracking_features', 'Fonctionnalités mises en avant'

    page = models.CharField(max_length=20, choices=Page.choices)
    section_key = models.CharField(max_length=30, choices=SectionKey.choices)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    kicker = models.CharField(max_length=255, blank=True)
    title = models.CharField(max_length=255, blank=True)
    subtitle = models.TextField(blank=True)
    cta_label = models.CharField(max_length=100, blank=True)
    cta_link = models.CharField(max_length=255, blank=True)
    cta_secondary_label = models.CharField(max_length=100, blank=True)
    cta_secondary_link = models.CharField(max_length=255, blank=True)
    items = models.JSONField(default=list, blank=True)

    class Meta(LoggedModel.Meta):
        ordering = ['page', 'order']
        constraints = [
            models.UniqueConstraint(fields=['page', 'section_key'], name='unique_page_section'),
        ]
        indexes = LoggedModel.Meta.indexes + [models.Index(fields=['page'])]

    def __str__(self):
        return f'{self.get_page_display()} — {self.get_section_key_display()}'
