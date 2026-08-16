# Generated migration — Initial treasury app (CashEntry, BankEntry, CapitalContribution)
# CashEntry fusionne l'ancien procurement.CashVoucher (jamais déployé sous sa
# forme d'origine) — un seul modèle "pièce de caisse" pour tout le projet,
# cf. docs/AUDIT_LOGIQUE_METIER_TRESORERIE_2026-08.md §H3.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('finance', '0008_financesettings_treasury_accounts'),
        ('procurement', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CashEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('voucher_number', models.CharField(blank=True, editable=False, max_length=20, unique=True)),
                ('type', models.CharField(choices=[('ENTREE', 'Entrée'), ('SORTIE', 'Sortie')], max_length=10)),
                ('source', models.CharField(choices=[('CLIENT_ESPECES', 'Client paie en espèces'), ('RETRAIT_BANQUE', 'Retrait compte bancaire'), ('DEPOT_BANQUE', 'Dépôt espèces → banque'), ('DEPENSE_OPERATIONNELLE', 'Dépense opérationnelle'), ('FOURNISSEUR_ESPECES', 'Paiement fournisseur en espèces')], max_length=30)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('date', models.DateField(default=django.utils.timezone.now)),
                ('reference', models.CharField(blank=True, help_text='N° pièce caisse, etc.', max_length=255)),
                ('description', models.TextField(blank=True)),
                ('reconciled_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_cash_entries', to=settings.AUTH_USER_MODEL)),
                ('disbursement', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cash_entries', to='finance.disbursementrequest')),
                ('payment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cash_entries', to='finance.payment')),
                ('reconciled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reconciled_cash_entries', to=settings.AUTH_USER_MODEL)),
                ('supplier_invoice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cash_entries', to='procurement.supplierinvoice')),
            ],
            options={
                'ordering': ['-date', '-created_at'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='CapitalContribution',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(choices=[('BROUILLON', 'Brouillon'), ('DOCUMENTS_TRANSMIS', 'Documents transmis'), ('VALIDEE', 'Validée (Finance)'), ('ENREGISTREE', 'Enregistrée légalement'), ('COMPTABILISEE', 'Comptabilisée')], default='BROUILLON', max_length=20)),
                ('contribution_date', models.DateField(default=django.utils.timezone.now, help_text='Date préévue apport')),
                ('validated_at', models.DateTimeField(blank=True, null=True)),
                ('posted_at', models.DateTimeField(blank=True, null=True)),
                ('posted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='posted_capital_contributions', to=settings.AUTH_USER_MODEL)),
                ('validated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='validated_capital_contributions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-contribution_date'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='BankEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('type', models.CharField(choices=[('ENTREE', 'Crédit'), ('SORTIE', 'Débit')], max_length=10)),
                ('source', models.CharField(choices=[('APPORT_CAPITAL', 'Apport capital'), ('CLIENT_CHEQUE', 'Client paie chèque'), ('CLIENT_VIREMENT', 'Client paie virement'), ('CAISSE_DEPOT', 'Dépôt espèces caisse'), ('FOURNISSEUR_CHEQUE', 'Paiement fournisseur chèque'), ('FOURNISSEUR_VIREMENT', 'Paiement fournisseur virement'), ('RETRAIT_ESPECES', 'Retrait espèces')], max_length=30)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('date', models.DateField(default=django.utils.timezone.now)),
                ('reference', models.CharField(help_text='N° chèque, N° virement, etc.', max_length=255)),
                ('description', models.TextField(blank=True)),
                ('reconciled_at', models.DateTimeField(blank=True, null=True)),
                ('bank_transaction', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bank_entry', to='finance.banktransaction')),
                ('capital_contribution', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bank_entries', to='treasury.capitalcontribution')),
                ('cash_entry', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bank_entries', to='treasury.cashentry')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_bank_entries', to=settings.AUTH_USER_MODEL)),
                ('disbursement', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bank_entries', to='finance.disbursementrequest')),
                ('payment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bank_entries', to='finance.payment')),
                ('reconciled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reconciled_bank_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-date', '-created_at'],
                'abstract': False,
            },
        ),
        migrations.AddField(
            model_name='capitalcontribution',
            name='bank_entry',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='capital_contribution', to='treasury.bankentry'),
        ),
        migrations.AddIndex(
            model_name='cashentry',
            index=models.Index(fields=['type', 'source'], name='treasury_c_type_s_source_idx'),
        ),
        migrations.AddIndex(
            model_name='cashentry',
            index=models.Index(fields=['date'], name='treasury_c_date_idx'),
        ),
        migrations.AddIndex(
            model_name='bankentry',
            index=models.Index(fields=['type', 'source'], name='treasury_b_type_s_source_idx'),
        ),
        migrations.AddIndex(
            model_name='bankentry',
            index=models.Index(fields=['date'], name='treasury_b_date_idx'),
        ),
    ]
