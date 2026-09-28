from rest_framework import serializers

from finance.models import DisbursementRequest
from treasury.models import CashEntry, BankEntry, CapitalContribution

# Statuts d'un décaissement pouvant légitimement donner lieu à un règlement
# (pentest du 24/09/2026, T2) — une demande encore EN_ATTENTE_RCF/GERANT ou
# REJETE ne doit jamais pouvoir être payée en caisse/banque.
_PAYABLE_DISBURSEMENT_STATUSES = (
    DisbursementRequest.Status.APPROUVE, DisbursementRequest.Status.EXECUTE,
)


class CashEntrySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    reconciled_by_name = serializers.CharField(source='reconciled_by.get_full_name', read_only=True)

    class Meta:
        model = CashEntry
        fields = [
            'id', 'voucher_number', 'type', 'type_display', 'source', 'source_display',
            'amount', 'date', 'reference', 'description',
            'payment', 'disbursement', 'supplier_invoice',
            'created_by', 'created_by_name',
            'reconciled_by', 'reconciled_by_name', 'reconciled_at',
            'created_at'
        ]
        read_only_fields = [
            # 'created_by', 'reconciled_by', 'reconciled_at' ajoutés suite au
            # pentest du 24/09/2026 (T3) : un Caissier pouvait forger sa
            # propre pièce comme déjà rapprochée par quelqu'un d'autre (ex:
            # le Directeur Financier), à une date de son choix — la pièce
            # devenait alors immuable (_reject_if_reconciled) sans qu'aucune
            # écriture n'ait été postée au Grand Livre. Le rapprochement
            # passe désormais uniquement par l'action `reconcile`.
            'voucher_number', 'type_display', 'source_display', 'created_by', 'created_by_name',
            'reconciled_by', 'reconciled_by_name', 'reconciled_at',
        ]

    def validate_amount(self, value):
        # T1 (pentest du 24/09/2026) : un montant négatif était accepté et
        # faussait le solde de caisse, ce qui peut aussi masquer un vol.
        if value <= 0:
            raise serializers.ValidationError('Le montant doit être positif.')
        return value

    def validate_disbursement(self, value):
        if value is None:
            return value
        # T2 (pentest du 24/09/2026) : un décaissement jamais approuvé
        # pouvait être réglé en caisse, et plusieurs fois de suite — double
        # paiement réel, sans la moindre validation.
        if value.status not in _PAYABLE_DISBURSEMENT_STATUSES:
            raise serializers.ValidationError(
                "Ce décaissement n'est pas encore approuvé — il ne peut pas être réglé.",
            )
        already_paid = (
            CashEntry.objects.filter(disbursement=value).exists()
            or BankEntry.objects.filter(disbursement=value).exists()
        )
        if already_paid:
            raise serializers.ValidationError('Ce décaissement a déjà été réglé.')
        return value


class BankEntrySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    reconciled_by_name = serializers.CharField(source='reconciled_by.get_full_name', read_only=True)

    class Meta:
        model = BankEntry
        fields = [
            'id', 'type', 'type_display', 'source', 'source_display',
            'amount', 'date', 'reference', 'description',
            'payment', 'capital_contribution', 'disbursement', 'cash_entry',
            'bank_transaction',
            'created_by', 'created_by_name',
            'reconciled_by', 'reconciled_by_name', 'reconciled_at',
            'created_at'
        ]
        # Même durcissement que CashEntrySerializer (pentest du 24/09/2026,
        # T1/T2/T3 — même défaut par construction sur ce modèle jumeau).
        read_only_fields = [
            'type_display', 'source_display', 'created_by', 'created_by_name',
            'reconciled_by', 'reconciled_by_name', 'reconciled_at', 'bank_transaction'
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant doit être positif.')
        return value

    def validate_disbursement(self, value):
        if value is None:
            return value
        if value.status not in _PAYABLE_DISBURSEMENT_STATUSES:
            raise serializers.ValidationError(
                "Ce décaissement n'est pas encore approuvé — il ne peut pas être réglé.",
            )
        already_paid = (
            CashEntry.objects.filter(disbursement=value).exists()
            or BankEntry.objects.filter(disbursement=value).exists()
        )
        if already_paid:
            raise serializers.ValidationError('Ce décaissement a déjà été réglé.')
        return value


class CapitalContributionSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    validated_by_name = serializers.CharField(source='validated_by.get_full_name', read_only=True)
    posted_by_name = serializers.CharField(source='posted_by.get_full_name', read_only=True)

    class Meta:
        model = CapitalContribution
        fields = [
            'id', 'amount', 'status', 'status_display',
            'contribution_date',
            'bank_entry',
            'validated_by', 'validated_by_name', 'validated_at',
            'posted_by', 'posted_by_name', 'posted_at',
            'created_at'
        ]
        read_only_fields = [
            # 'status', 'validated_by', 'posted_by' ajoutés — même défaut de
            # construction que CashEntry/BankEntry (pentest du 24/09/2026) :
            # rien n'empêchait de créer un apport directement validé/posté,
            # en se déclarant soi-même validateur.
            'status', 'validated_by', 'posted_by', 'status_display', 'validated_by_name', 'posted_by_name',
            'validated_at', 'posted_at'
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Le montant doit être positif.')
        return value
