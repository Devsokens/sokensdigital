from rest_framework import serializers

from core.models import User
from core.sanitize import sanitize_html, sanitize_plain_text
from core.serializers import UserBriefSerializer
from marketing.models import (
    BlogPost, ContractSettings, Lead, PageSection, Quote, QuoteLine, QuoteSettings, ServiceContract, ShowcaseProject,
    SiteSettings, SocialMediaCredentials, SocialPost, Specification, SpecificationLine,
    TestimonialSubmission,
)


class LeadPublicCreateSerializer(serializers.ModelSerializer):
    """Public intake — the site vitrine's 'Démarrer un projet' form. No
    status/assigned_to/qualification_score: those are internal-only.
    `estimated_value` IS accepted here (unlike the others) — it's the
    wizard's own "Budget estimé" field, and populating it is what makes
    the "pipeline pondéré" dashboard metric mean anything for organic
    web leads instead of always being null."""

    class Meta:
        model = Lead
        fields = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'source', 'message', 'estimated_value']


class TestimonialSubmissionPublicCreateSerializer(serializers.ModelSerializer):
    """Public intake — bouton « Laisser un témoignage » de l'accueil. Pas de
    `status` : reste EN_ATTENTE par défaut, décidé en revue, jamais par le
    visiteur lui-même."""

    class Meta:
        model = TestimonialSubmission
        fields = ['name', 'role', 'company_name', 'email', 'quote']


class LeadSerializer(serializers.ModelSerializer):
    assigned_to = UserBriefSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )
    # Fixé par la conversion (marketing.conversion), jamais par le payload.
    client = serializers.PrimaryKeyRelatedField(read_only=True)
    client_name = serializers.CharField(source='client.company_name', read_only=True, default=None)

    class Meta:
        model = Lead
        fields = [
            'id', 'first_name', 'last_name', 'company_name', 'email', 'phone',
            'source', 'message', 'status', 'assigned_to', 'assigned_to_id',
            'qualification_score', 'estimated_value', 'contacts', 'documents',
            'attachment_url', 'attachment_name',
            'client', 'client_name', 'created_at',
        ]
        read_only_fields = ['attachment_url', 'attachment_name']

    def to_representation(self, instance):
        # Liens de consultation signés à chaque lecture : un document joint
        # doit rester consultable, pas seulement 7 jours après son envoi.
        from core.storage import PROJECT_REQUEST_BUCKET_NAME, resign_stored_url, sign_private_path
        data = super().to_representation(instance)
        docs = []
        for doc in data.get('documents') or []:
            if not isinstance(doc, dict):
                continue
            doc = {k: v for k, v in doc.items() if k != 'path'}
            stored = next((d for d in (instance.documents or []) if isinstance(d, dict) and d.get('id') == doc.get('id')), {})
            # Seuls les documents dont le serveur a fixé le chemin (dossier
            # du lead) sont signés ; un ancien lien écrit par le client n'est
            # jamais re-signé (il pourrait viser un autre fichier privé).
            path = stored.get('path') or ''
            try:
                if path.startswith(f'leads/{instance.pk}/'):
                    doc['url'] = sign_private_path(path)
                elif path:
                    doc['url'] = ''
            except Exception:
                doc['url'] = ''
            docs.append(doc)
        data['documents'] = docs
        # Pièce du formulaire public : écrite par le serveur seul, dans le
        # dossier de la référence de suivi du lead.
        if data.get('attachment_url') and instance.tracking_reference:
            data['attachment_url'] = resign_stored_url(
                data['attachment_url'], PROJECT_REQUEST_BUCKET_NAME, f'{instance.tracking_reference}/',
            )
        return data

    def validate_documents(self, value):
        # Écriture : on ne peut que RETIRER des documents existants (les
        # ajouts passent par POST /leads/<id>/documents/). Les entrées
        # renvoyées par le client sont remplacées par la version en base —
        # sinon un chemin ou une URL injectés seraient signés par le serveur
        # et ouvriraient n'importe quel fichier privé.
        if not isinstance(value, list):
            raise serializers.ValidationError('Liste de documents attendue.')
        existing = {d.get('id'): d for d in ((self.instance.documents if self.instance else None) or []) if isinstance(d, dict)}
        kept_ids = {d.get('id') for d in value if isinstance(d, dict)}
        return [doc for doc_id, doc in existing.items() if doc_id in kept_ids]

    def create(self, validated_data):
        contacts = validated_data.get('contacts') or []
        if contacts and isinstance(contacts, list) and len(contacts) > 0:
            first = contacts[0]
            if isinstance(first, dict):
                if not validated_data.get('first_name'):
                    validated_data['first_name'] = first.get('first_name', '')
                if not validated_data.get('last_name'):
                    validated_data['last_name'] = first.get('last_name', '')
                if not validated_data.get('email'):
                    validated_data['email'] = first.get('email', '')
                if not validated_data.get('phone'):
                    validated_data['phone'] = first.get('phone', '')
        return super().create(validated_data)

    def update(self, instance, validated_data):
        contacts = validated_data.get('contacts')
        if contacts is not None and isinstance(contacts, list) and len(contacts) > 0:
            first = contacts[0]
            if isinstance(first, dict):
                if 'first_name' not in validated_data and first.get('first_name'):
                    validated_data['first_name'] = first.get('first_name')
                if 'last_name' not in validated_data and first.get('last_name'):
                    validated_data['last_name'] = first.get('last_name')
                if 'email' not in validated_data and first.get('email'):
                    validated_data['email'] = first.get('email')
                if 'phone' not in validated_data and first.get('phone'):
                    validated_data['phone'] = first.get('phone')
        return super().update(instance, validated_data)

    def validate_qualification_score(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError('Le score doit être compris entre 0 et 100.')
        return value


class BlogPostSerializer(serializers.ModelSerializer):
    """Full read/write shape — Responsable Marketing/Super-Admin only."""

    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = BlogPost
        fields = ['id', 'title', 'slug', 'author', 'cover_image', 'content', 'status', 'published_at', 'created_at']
        read_only_fields = ['slug', 'author']

    def validate_content(self, value):
        # Défense contre XSS stockée : le HTML produit par l'éditeur Tiptap
        # admin est rendu tel quel sur le site public (dangerouslySetInnerHTML,
        # frontend/components/blog/article-content.tsx) — la restriction
        # côté éditeur n'est pas une frontière de sécurité, un appel API
        # direct la contourne entièrement. Nettoyage ici, au plus près du
        # stockage, quel que soit le chemin d'écriture.
        return sanitize_html(value)


class BlogPostPublicSerializer(serializers.ModelSerializer):
    """What the public site vitrine reads — only PUBLIE posts are ever
    reachable through this (enforced in the view's queryset, not here)."""

    author = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = ['title', 'slug', 'author', 'cover_image', 'content', 'published_at']

    def get_author(self, obj) -> str | None:
        if not obj.author:
            return None
        return f'{obj.author.first_name} {obj.author.last_name}'.strip()


class SocialPostSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = SocialPost
        fields = [
            'id', 'title', 'content', 'image_path', 'additional_images',
            'platform', 'scheduled_at', 'status', 'published_at', 'post_url',
            'author', 'notes', 'tags', 'created_at',
        ]
        read_only_fields = ['status', 'published_at', 'post_url', 'author']

    def validate(self, attrs):
        image_path = attrs.get('image_path', getattr(self.instance, 'image_path', ''))
        if not image_path:
            raise serializers.ValidationError({'image_path': 'Une image est requise pour publier sur Facebook ou Instagram.'})
        return attrs


class SocialMediaCredentialsSerializer(serializers.ModelSerializer):
    """The access token is write_only — GET never echoes back a live
    secret, even to a Super-Admin's own browser network tab. The frontend
    uses facebook_configured/instagram_configured (computed, read-only) to
    show "connecté"/"non connecté" without ever seeing the token itself;
    re-saving requires pasting it again (matches how most integrations'
    "reconnect" flows work)."""

    updated_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = SocialMediaCredentials
        fields = [
            'facebook_page_id', 'facebook_access_token', 'instagram_business_account_id',
            'facebook_configured', 'instagram_configured', 'updated_by', 'updated_at',
        ]
        extra_kwargs = {'facebook_access_token': {'write_only': True, 'required': False}}


class QuoteLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteLine
        fields = ['id', 'service_title', 'description', 'quantity', 'unit_price', 'total_line', 'amount_label']
        read_only_fields = ['total_line']


class QuoteSerializer(serializers.ModelSerializer):
    """Lines are nested and fully replaced on update (delete-then-recreate)
    — quotes are small documents, not worth a diffing PATCH. No status
    lock: the owning department (Commercial owner/Responsable Marketing/
    Super-Admin, see IsCommercialOwnerOrReadCollaborator) can edit and
    update a quote whatever its status (docs/backend-specifications.md §7.2)."""

    created_by = UserBriefSerializer(read_only=True)
    lines = QuoteLineSerializer(many=True, required=False)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'lead', 'created_by', 'client_name', 'intro_message',
            'subject', 'description', 'project_duration', 'payment_terms', 'issue_date',
            'expiry_date', 'status', 'discount_amount', 'total_ht', 'total_ttc',
            'tracking_token', 'sent_at', 'opened_at', 'signed_at', 'signature_url', 'parent_quote', 'version',
            'document_color', 'lines', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'quote_number', 'status', 'total_ht', 'total_ttc', 'tracking_token',
            'sent_at', 'opened_at', 'signed_at', 'signature_url', 'parent_quote', 'version', 'updated_at',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        if not validated_data.get('payment_terms'):
            validated_data['payment_terms'] = QuoteSettings.load().default_payment_terms
        quote = Quote.objects.create(**validated_data)
        for line_data in lines_data:
            QuoteLine.objects.create(quote=quote, **line_data)
        quote.refresh_from_db()
        return quote

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                QuoteLine.objects.create(quote=instance, **line_data)
        instance.refresh_from_db()
        return instance


class SpecificationLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecificationLine
        fields = ['id', 'interface_name', 'objective']


class SpecificationListSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = Specification
        fields = ['id', 'spec_number', 'spec_type', 'title', 'status', 'created_by', 'created_at', 'updated_at']


class SpecificationSerializer(serializers.ModelSerializer):
    """Same lines-fully-replaced-on-update convention as QuoteSerializer —
    no status lock either, this is a collaborative internal document."""

    created_by = UserBriefSerializer(read_only=True)
    lines = SpecificationLineSerializer(many=True, required=False)

    class Meta:
        model = Specification
        fields = [
            'id', 'spec_number', 'spec_type', 'title', 'client_name', 'intro_message',
            'description', 'document_color', 'status', 'created_by', 'lines',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['spec_number', 'created_by', 'updated_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        spec = Specification.objects.create(**validated_data)
        for line_data in lines_data:
            SpecificationLine.objects.create(specification=spec, **line_data)
        spec.refresh_from_db()
        return spec

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                SpecificationLine.objects.create(specification=instance, **line_data)
        instance.refresh_from_db()
        return instance


class PageSectionSerializer(serializers.ModelSerializer):
    """Admin shape — Responsable Marketing/Super-Admin. `page`/`section_key`
    are read-only: the set of sections is fixed by the real page template,
    only their content is editable (see PageSection docstring)."""

    class Meta:
        model = PageSection
        fields = [
            'id', 'page', 'section_key', 'order', 'is_active', 'kicker', 'title',
            'subtitle', 'cta_label', 'cta_link', 'cta_secondary_label',
            'cta_secondary_link', 'items', 'extra', 'created_at',
        ]
        read_only_fields = ['page', 'section_key', 'order']


class PageSectionPublicSerializer(serializers.ModelSerializer):
    """What the public site vitrine reads — no id/is_active, and the view's
    queryset already filters to is_active=True only."""

    class Meta:
        model = PageSection
        fields = [
            'section_key', 'kicker', 'title', 'subtitle', 'cta_label', 'cta_link',
            'cta_secondary_label', 'cta_secondary_link', 'items', 'extra',
        ]


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Same shape for admin (read/write) and public (read) — nothing here
    is sensitive, it's the header/footer content every visitor already
    sees rendered on every page."""

    class Meta:
        model = SiteSettings
        fields = [
            'logo_url', 'tagline', 'contact_email', 'contact_phone', 'services_links',
            'legal_links', 'social_links', 'copyright_text',
            'cgu_text', 'cgv_text', 'mentions_legales_text', 'politique_confidentialite_text',
        ]

    # Ces 4 champs sont désormais du HTML produit par l'éditeur Tiptap admin
    # (voir site-settings-form.tsx) et rendu tel quel sur le site public via
    # dangerouslySetInnerHTML (components/sections/legal-page.tsx) — même
    # frontière de sécurité que BlogPostSerializer.validate_content
    # ci-dessus : la restriction de l'éditeur n'en est pas une, un appel API
    # direct la contournerait entièrement.
    def validate_cgu_text(self, value):
        return sanitize_html(value)

    def validate_cgv_text(self, value):
        return sanitize_html(value)

    def validate_mentions_legales_text(self, value):
        return sanitize_html(value)

    def validate_politique_confidentialite_text(self, value):
        return sanitize_html(value)


class BlogCommentCreateSerializer(serializers.Serializer):
    """Commentaire public sur un article de blog — pseudo libre (pas de
    compte), texte court. Ni l'un ni l'autre n'est du HTML : sanitize_plain_text
    (dans la vue, après is_valid()) retire toute balise en défense en
    profondeur, même si le rendu React ne les interprète jamais."""

    pseudo = serializers.CharField(max_length=40, trim_whitespace=True)
    text = serializers.CharField(max_length=1000, trim_whitespace=True)

    def validate_pseudo(self, value):
        if len(sanitize_plain_text(value)) < 2:
            raise serializers.ValidationError('Pseudo trop court (2 caractères minimum).')
        return value

    def validate_text(self, value):
        if len(sanitize_plain_text(value)) < 2:
            raise serializers.ValidationError('Commentaire trop court.')
        return value


class ShowcaseProjectSerializer(serializers.ModelSerializer):
    """Admin shape — Responsable Marketing/Super-Admin. `slug` is
    read-only-on-write-but-editable-if-blank: auto-derived from `title` the
    first time it's saved (see model.save()), then stays stable."""

    class Meta:
        model = ShowcaseProject
        fields = [
            'id', 'slug', 'category', 'sector', 'type', 'featured', 'show_on_homepage',
            'order', 'is_active', 'status_tag', 'tag', 'title', 'description', 'visual_icon',
            'project_url', 'video_src', 'images', 'scene_variants', 'client', 'technologies',
            'timeline', 'lead_name', 'lead_role', 'challenge', 'stats', 'solution',
            'solution_points', 'summary', 'challenge_summary', 'solution_summary', 'created_at',
        ]


class ShowcaseProjectPublicSerializer(serializers.ModelSerializer):
    """What the public site vitrine reads — no id/is_active, and the view's
    queryset already filters to is_active=True only."""

    class Meta:
        model = ShowcaseProject
        fields = [
            'slug', 'category', 'sector', 'type', 'featured', 'status_tag', 'tag', 'title',
            'description', 'visual_icon', 'project_url', 'video_src', 'images', 'scene_variants',
            'client', 'technologies', 'timeline', 'lead_name', 'lead_role', 'challenge', 'stats',
            'solution', 'solution_points', 'summary', 'challenge_summary', 'solution_summary',
        ]


class QuoteTrackSerializer(serializers.ModelSerializer):
    """Public, token-authenticated view — no internal identifiers
    (created_by, tracking_token itself) leak into the response."""

    lines = QuoteLineSerializer(many=True, read_only=True)
    company_stamp_url = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            'quote_number', 'client_name', 'intro_message', 'subject', 'description',
            'project_duration', 'payment_terms', 'issue_date', 'expiry_date', 'status',
            'discount_amount', 'total_ht', 'total_ttc', 'lines', 'signed_at', 'signature_url',
            'company_stamp_url',
        ]

    def get_company_stamp_url(self, obj) -> str:
        return QuoteSettings.load().company_stamp_url


class QuoteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteSettings
        fields = [
            'company_address', 'company_phone', 'company_email', 'company_rccm', 'company_nif', 'company_stamp_url',
            'payment_methods', 'default_payment_terms', 'footer_note', 'amount_basis',
        ]


class ContractSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractSettings
        fields = [
            'provider_identity', 'provider_signatory', 'city', 'watermark', 'watermark_url',
            'watermark_opacity', 'apply_stamp',
        ]

    def validate_watermark_opacity(self, value):
        if not 1 <= value <= 100:
            raise serializers.ValidationError("L'opacité doit être comprise entre 1 et 100 %.")
        return value


class ServiceContractSerializer(serializers.ModelSerializer):
    """Contrat de prestation de services. Seul un brouillon se modifie ;
    envoyé ou signé, son contenu est figé (le statut reste modifiable)."""

    quote_number = serializers.CharField(source='quote.quote_number', read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()

    CONTENT_FIELDS = (
        'client', 'quote', 'client_name', 'client_legal_form', 'client_address', 'client_rccm',
        'client_nif', 'client_representative', 'client_email', 'preamble', 'services_description',
        'start_date', 'duration', 'renewal', 'renewal_notice_days', 'amount', 'amount_basis',
        'payment_schedule', 'first_payment_days', 'payment_methods', 'late_penalty_rate',
        'expenses_covered', 'expenses_threshold', 'confidentiality_years', 'liability_cap',
        'insurance', 'annex_specifications', 'annex_pricing', 'signing_date', 'client_signatory',
        'provider_signatory', 'document_color', 'show_header',
    )

    class Meta:
        model = ServiceContract
        fields = [
            'id', 'contract_number', 'status', 'quote_number', 'created_by_name', 'sent_at',
            'created_at', 'updated_at',
            'client', 'quote', 'client_name', 'client_legal_form', 'client_address', 'client_rccm',
            'client_nif', 'client_representative', 'client_email', 'preamble', 'services_description',
            'start_date', 'duration', 'renewal', 'renewal_notice_days', 'amount', 'amount_basis',
            'payment_schedule', 'first_payment_days', 'payment_methods', 'late_penalty_rate',
            'expenses_covered', 'expenses_threshold', 'confidentiality_years', 'liability_cap',
            'insurance', 'annex_specifications', 'annex_pricing', 'signing_date', 'client_signatory',
            'provider_signatory', 'document_color', 'show_header',
        ]
        read_only_fields = ['contract_number', 'sent_at', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return ''
        full = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return full or user.email or ''

    def validate_payment_schedule(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("L'échéancier doit être une liste.")
        cleaned, total = [], 0
        for term in value:
            if not isinstance(term, dict):
                raise serializers.ValidationError('Échéance invalide.')
            label = sanitize_plain_text(str(term.get('label') or '')).strip()
            try:
                pct = float(term.get('percentage') or 0)
            except (TypeError, ValueError):
                raise serializers.ValidationError('Pourcentage invalide.')
            if pct <= 0 or pct > 100:
                raise serializers.ValidationError('Chaque échéance doit être comprise entre 0 et 100 %.')
            total += pct
            cleaned.append({'label': label, 'percentage': int(pct) if pct.is_integer() else pct})
        if cleaned and abs(total - 100) > 0.01:
            raise serializers.ValidationError(f'Les échéances totalisent {total:g} % au lieu de 100 %.')
        return cleaned

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Le montant ne peut pas être négatif.')
        return value

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status != ServiceContract.Status.BROUILLON:
            changed = [
                f for f in self.CONTENT_FIELDS
                if f in attrs and attrs[f] != getattr(instance, f)
            ]
            if changed:
                raise serializers.ValidationError(
                    {'detail': 'Ce contrat a été envoyé : son contenu ne peut plus être modifié. Repassez-le en brouillon pour le corriger.'}
                )
        return attrs
