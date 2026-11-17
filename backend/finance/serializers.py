from decimal import Decimal

from django.db import models
from rest_framework import serializers

from core.serializers import UserBriefSerializer
from core.models import DocumentAttachment, User
from core.storage import sign_private_path
from finance.models import (
    Account,
    AccountingPeriod,
    BankStatementImport,
    BankTransaction,
    DisbursementLine,
    DisbursementQuote,
    DisbursementRequest,
    Invoice,
    JournalEntry,
    Payment,
    PaymentReceipt,
    TaxDeclaration,
    TransactionLine,
)
from projects.models import Project


class DisbursementLineSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = DisbursementLine
        fields = ['id', 'label', 'quantity', 'unit_price', 'total']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le nombre d\'unités doit être positif.')
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError('Le prix unitaire ne peut pas être négatif.')
        return value


class DisbursementQuoteSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = DisbursementQuote
        fields = ['id', 'original_filename', 'url', 'created_at']

    def get_url(self, obj):
        # Signée à chaque lecture plutôt que stockée : voir
        # DisbursementQuote.storage_path.
        return sign_private_path(obj.storage_path)


class DisbursementRequestSerializer(serializers.ModelSerializer):
    requested_by = UserBriefSerializer(read_only=True)
    decided_by = UserBriefSerializer(read_only=True)
    rcf_decided_by = UserBriefSerializer(read_only=True)
    executed_by = UserBriefSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        source='project', queryset=Project.objects.all(), write_only=True, required=False, allow_null=True,
    )
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    beneficiary_user_id = serializers.PrimaryKeyRelatedField(
        source='beneficiary_user', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )
    beneficiary_user = UserBriefSerializer(read_only=True)
    lines = DisbursementLineSerializer(many=True, required=False)
    quotes = DisbursementQuoteSerializer(many=True, read_only=True)
    # Calculé à partir des lignes quand il y en a ; obligatoire sinon.
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    beneficiary = serializers.CharField(max_length=255, required=False, allow_blank=True)

    class Meta:
        model = DisbursementRequest
        fields = [
            'id', 'reference', 'request_date', 'project', 'project_id', 'project_name', 'requested_by', 'amount',
            'beneficiary', 'beneficiary_user', 'beneficiary_user_id', 'reason', 'lines', 'quotes',
            'status', 'rejection_reason', 'rcf_decided_by', 'rcf_decided_at', 'decided_by', 'decided_at',
            'executed_by', 'executed_at', 'created_at',
            'department', 'department_name', 'rcf_signature_url', 'gerant_signature_url',
        ]
        read_only_fields = [
            'reference', 'project', 'requested_by', 'status', 'rejection_reason', 'rcf_decided_by',
            'rcf_decided_at', 'decided_by', 'decided_at', 'executed_by', 'executed_at',
            'department', 'rcf_signature_url', 'gerant_signature_url',
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant doit être positif.')
        return value

    def validate(self, attrs):
        lines = attrs.get('lines') or []
        if lines:
            total = sum((line['quantity'] * line['unit_price'] for line in lines), Decimal('0'))
            if total <= 0:
                raise serializers.ValidationError({'lines': 'Le total des lignes doit être positif.'})
            attrs['amount'] = total.quantize(Decimal('0.01'))
            if not attrs.get('reason'):
                # Résumé lisible pour les écrans qui affichent `reason`
                # (achats, recherche, tableau de bord).
                attrs['reason'] = '; '.join(line['label'] for line in lines)[:1000]
        elif 'amount' not in attrs:
            raise serializers.ValidationError({'lines': 'Ajoutez au moins une ligne au besoin.'})

        beneficiary_user = attrs.get('beneficiary_user')
        if beneficiary_user:
            attrs['beneficiary'] = f'{beneficiary_user.first_name} {beneficiary_user.last_name}'.strip() or beneficiary_user.email
        elif not (attrs.get('beneficiary') or '').strip():
            raise serializers.ValidationError({'beneficiary': 'Le bénéficiaire est obligatoire.'})
        return attrs

    def create(self, validated_data):
        lines = validated_data.pop('lines', [])
        request = DisbursementRequest.objects.create(**validated_data)
        DisbursementLine.objects.bulk_create([
            DisbursementLine(request=request, order=index, **line) for index, line in enumerate(lines)
        ])
        return request


class DisbursementRequestListSerializer(DisbursementRequestSerializer):
    """Liste : le nombre de devis seulement — signer l'URL de chaque devis
    de chaque ligne coûterait un appel au stockage par fichier. Les URLs
    viennent avec le détail (retrieve)."""
    quotes = None
    quotes_count = serializers.SerializerMethodField()

    class Meta(DisbursementRequestSerializer.Meta):
        fields = [f for f in DisbursementRequestSerializer.Meta.fields if f != 'quotes'] + ['quotes_count']

    def get_quotes_count(self, obj):
        return len(obj.quotes.all())


class AccountingPeriodSerializer(serializers.ModelSerializer):
    closed_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = AccountingPeriod
        fields = ['id', 'label', 'start_date', 'end_date', 'status', 'closed_by', 'closed_at', 'created_at']
        read_only_fields = ['status', 'closed_by', 'closed_at']


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'code', 'name', 'account_class']


class TransactionLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = TransactionLine
        fields = ['id', 'account', 'account_code', 'account_name', 'label', 'debit', 'credit', 'lettrage_code']
        read_only_fields = ['lettrage_code']

    def validate(self, attrs):
        debit = attrs.get('debit') or Decimal('0')
        credit = attrs.get('credit') or Decimal('0')
        if debit and credit:
            raise serializers.ValidationError('Une ligne ne peut être à la fois débitrice et créditrice.')
        if not debit and not credit:
            raise serializers.ValidationError('Une ligne doit avoir un débit ou un crédit non nul.')
        return attrs


class JournalEntrySerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)
    lines = TransactionLineSerializer(many=True)
    is_locked = serializers.BooleanField(read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            'id', 'period', 'journal_code', 'date', 'label', 'created_by',
            'source_invoice', 'is_locked', 'lines', 'created_at',
        ]
        read_only_fields = ['created_by', 'source_invoice']

    def validate(self, attrs):
        period = attrs.get('period') or getattr(self.instance, 'period', None)
        if period and period.status == period.Status.CLOTUREE:
            raise serializers.ValidationError("La période comptable est clôturée : aucune écriture n'est autorisée.")
        lines = attrs.get('lines')
        if lines is not None:
            if len(lines) < 2:
                raise serializers.ValidationError({'lines': "Une écriture doit comporter au moins deux lignes."})
            total_debit = sum((line['debit'] or Decimal('0') for line in lines), Decimal('0'))
            total_credit = sum((line['credit'] or Decimal('0') for line in lines), Decimal('0'))
            if total_debit != total_credit:
                raise serializers.ValidationError({'lines': f"L'écriture n'est pas équilibrée (débit {total_debit} ≠ crédit {total_credit})."})
        return attrs

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        entry = JournalEntry.objects.create(**validated_data)
        for line_data in lines_data:
            TransactionLine.objects.create(entry=entry, **line_data)
        return entry


class InvoiceSerializer(serializers.ModelSerializer):
    created_by = UserBriefSerializer(read_only=True)
    validated_by = UserBriefSerializer(read_only=True)
    client_company_name = serializers.CharField(source='client.company_name', read_only=True, allow_null=True)
    quote_number = serializers.CharField(source='quote.quote_number', read_only=True, allow_null=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    # Adresses proposées à l'envoi : client, puis demande (lead) du devis lié.
    contact_emails = serializers.SerializerMethodField()
    # Calculé à partir des lignes quand il y en a : facultatif à la saisie.
    amount_ht = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'client', 'client_name', 'client_company_name', 'quote', 'quote_number',
            'issue_date', 'due_date', 'lines', 'discount_amount', 'discount_reason', 'document_color',
            'amount_ht', 'vat_rate', 'vat_amount', 'css_rate', 'css_amount', 'amount_ttc', 'amount_paid',
            'contact_emails', 'status', 'created_by', 'validated_by', 'validated_at', 'created_at',
        ]
        read_only_fields = [
            'invoice_number', 'vat_amount', 'css_amount', 'amount_ttc', 'status', 'created_by', 'validated_by', 'validated_at',
            'client_company_name',
        ]

    def validate(self, data):
        """Ensure either client or client_name is provided."""
        instance = self.instance
        client = data.get('client', getattr(instance, 'client', None))
        client_name = data.get('client_name', getattr(instance, 'client_name', '') or '').strip()
        if not client and not client_name:
            raise serializers.ValidationError('Either client or client_name must be provided.')
        lines = data.get('lines', getattr(instance, 'lines', None) or [])
        discount = data.get('discount_amount', getattr(instance, 'discount_amount', None)) or Decimal('0')
        if discount < 0:
            raise serializers.ValidationError({'discount_amount': 'La réduction ne peut pas être négative.'})
        if lines:
            total = sum(Decimal(str(l['quantity'])) * Decimal(str(l['unit_price'])) for l in lines)
            if total <= 0:
                raise serializers.ValidationError({'lines': 'Le total des lignes doit être positif.'})
            if discount >= total:
                raise serializers.ValidationError({'discount_amount': 'La réduction doit être inférieure au total des prestations.'})
        elif data.get('amount_ht', getattr(instance, 'amount_ht', None)) is None:
            raise serializers.ValidationError({'lines': 'Ajoutez au moins une ligne.'})
        return data

    def get_contact_emails(self, obj):
        emails = []
        if obj.client_id and obj.client.email:
            emails.append(obj.client.email)
        lead = obj.quote.lead if obj.quote_id else None
        if lead:
            emails.append(lead.email)
            emails += [c.get('email') for c in (lead.contacts or []) if isinstance(c, dict)]
        return list(dict.fromkeys(e for e in emails if e))

    def validate_lines(self, value):
        """Chaque ligne : description, quantité > 0, prix unitaire (négatif pour une remise)."""
        if not isinstance(value, list):
            raise serializers.ValidationError('Format de lignes invalide.')
        cleaned = []
        for line in value:
            if not isinstance(line, dict):
                raise serializers.ValidationError('Format de ligne invalide.')
            description = str(line.get('description') or '').strip()
            try:
                quantity = Decimal(str(line.get('quantity') or 0))
                unit_price = Decimal(str(line.get('unit_price') or 0))
            except Exception:
                raise serializers.ValidationError('Quantité ou prix unitaire invalide.')
            if not description and not unit_price:
                continue  # ligne vide laissée dans le formulaire
            # Prix négatif accepté (ligne de remise) ; le total de la facture
            # reste contrôlé dans validate().
            if quantity <= 0:
                raise serializers.ValidationError('La quantité doit être positive.')
            note = str(line.get('note') or '').strip()[:255]
            cleaned.append({'description': description, 'quantity': str(quantity), 'unit_price': str(unit_price), 'note': note})
        return cleaned

    def validate_amount_ht(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant HT doit être positif.')
        return value

    def validate_vat_rate(self, value):
        # Pentest du 24/09/2026 (F2) : un taux négatif (ex: -0.99) faisait
        # ressortir un TTC très inférieur au HT — une facture de 1 000 000
        # HT sortait à 10 000 TTC, sous-facturant le client et rendant la
        # TVA collectée négative dans la déclaration.
        if not (0 <= value <= 1):
            raise serializers.ValidationError('Le taux de TVA doit être compris entre 0 et 1.')
        return value

    def validate_css_rate(self, value):
        # Taux dynamique (paramètres Finance, ajustable par facture), mais
        # borné : un taux négatif ou démesuré fausserait la taxe facturée.
        from finance.models import MAX_CSS_RATE
        if not (0 <= value <= MAX_CSS_RATE):
            raise serializers.ValidationError('Le taux de CSS doit être compris entre 0 et 0,2 (20 %).')
        return value

    def create(self, validated_data):
        # Taux non précisés : ceux des paramètres Finance au moment de
        # l'émission (ils restent ensuite figés sur la facture).
        from finance.models import FinanceSettings
        settings_obj = FinanceSettings.load()
        if 'vat_rate' not in self.initial_data:
            validated_data['vat_rate'] = settings_obj.vat_rate
        if 'css_rate' not in self.initial_data:
            validated_data['css_rate'] = settings_obj.css_rate
        return super().create(validated_data)


class BankTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankTransaction
        fields = ['id', 'date', 'label', 'amount', 'matched_line', 'status']
        read_only_fields = ['matched_line', 'status']


class BankStatementImportRowSerializer(serializers.Serializer):
    date = serializers.DateField()
    label = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class BankStatementImportSerializer(serializers.ModelSerializer):
    imported_by = UserBriefSerializer(read_only=True)
    transactions = BankTransactionSerializer(many=True, read_only=True)
    rows = BankStatementImportRowSerializer(many=True, write_only=True)

    class Meta:
        model = BankStatementImport
        fields = ['id', 'filename', 'imported_by', 'transactions', 'rows', 'created_at']
        read_only_fields = ['imported_by']

    def create(self, validated_data):
        rows = validated_data.pop('rows')
        statement = BankStatementImport.objects.create(**validated_data)
        BankTransaction.objects.bulk_create([
            BankTransaction(statement_import=statement, **row) for row in rows
        ])
        return statement


class TaxDeclarationSerializer(serializers.ModelSerializer):
    generated_by = UserBriefSerializer(read_only=True)
    validated_by = UserBriefSerializer(read_only=True)
    period_label = serializers.CharField(source='period.label', read_only=True)

    class Meta:
        model = TaxDeclaration
        fields = [
            'id', 'period', 'period_label', 'status', 'collected_vat',
            'deductible_vat', 'net_vat', 'generated_by', 'validated_by',
            'validated_at', 'created_at',
        ]
        read_only_fields = [
            'status', 'collected_vat', 'deductible_vat', 'net_vat',
            'generated_by', 'validated_by', 'validated_at',
        ]


class DocumentAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserBriefSerializer(read_only=True)
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = DocumentAttachment
        fields = [
            'id', 'document_type', 'document_type_display', 'file_name', 'file_size',
            'uploaded_by', 'notes', 'created_at',
        ]
        read_only_fields = ['file_size', 'uploaded_by', 'created_at']


class PaymentReceiptSerializer(serializers.ModelSerializer):
    issued_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = PaymentReceipt
        fields = ['id', 'receipt_number', 'issued_by', 'created_at']
        read_only_fields = ['receipt_number', 'issued_by', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    received_by = UserBriefSerializer(read_only=True)
    receipt = PaymentReceiptSerializer(read_only=True)
    attachments = DocumentAttachmentSerializer(many=True, read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_paid = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'amount', 'payment_date', 'payment_method', 'payment_method_display',
            'status', 'status_display', 'received_by', 'received_at', 'notes',
            'receipt', 'attachments', 'total_paid', 'remaining', 'created_at',
        ]
        read_only_fields = [
            'invoice', 'received_by', 'received_at', 'receipt', 'attachments',
            'total_paid', 'remaining', 'created_at',
        ]

    def get_total_paid(self, obj):
        """Total effectivement encaissé sur la facture.

        L'agrégat couvre déjà tous les versements RECU, celui-ci compris :
        y rajouter obj.amount le comptait deux fois et sous-évaluait d'autant
        le restant dû affiché.
        """
        return obj.invoice.payments.filter(status=Payment.Status.RECU).aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0')

    def get_remaining(self, obj):
        """Montant restant à payer."""
        total_paid = self.get_total_paid(obj)
        return max(Decimal('0'), obj.invoice.amount_ttc - total_paid)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant du versement doit être positif.')
        return value

    def validate(self, data):
        """Un versement ne peut pas dépasser le restant dû.

        Sans ce contrôle, une facture peut être encaissée au-delà de son
        montant TTC : le trop-perçu n'apparaît nulle part et fausse aussi
        bien le suivi client que le rapprochement comptable.
        """
        invoice = self.instance.invoice if self.instance else self.context.get('invoice')
        amount = data.get('amount')
        if invoice is None or amount is None:
            return data

        already_paid = invoice.payments.filter(
            status=Payment.Status.RECU,
        ).exclude(pk=self.instance.pk if self.instance else None).aggregate(
            total=models.Sum('amount'),
        )['total'] or Decimal('0')

        if already_paid + amount > invoice.amount_ttc:
            remaining = invoice.amount_ttc - already_paid
            raise serializers.ValidationError({
                'amount': (
                    f'Ce versement dépasse le restant dû sur la facture '
                    f'({remaining} FCFA).'
                ),
            })
        return data


class TaxRatesSerializer(serializers.ModelSerializer):
    """Taux par défaut des nouvelles factures (paramètres Finance)."""

    class Meta:
        from finance.models import FinanceSettings
        model = FinanceSettings
        fields = ['vat_rate', 'css_rate', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_vat_rate(self, value):
        from finance.models import MAX_VAT_RATE
        if not (0 <= value <= MAX_VAT_RATE):
            raise serializers.ValidationError('Le taux de TVA doit être compris entre 0 et 1.')
        return value

    def validate_css_rate(self, value):
        from finance.models import MAX_CSS_RATE
        if not (0 <= value <= MAX_CSS_RATE):
            raise serializers.ValidationError('Le taux de CSS doit être compris entre 0 et 0,2 (20 %).')
        return value
