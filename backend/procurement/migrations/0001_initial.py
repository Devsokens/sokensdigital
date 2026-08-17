# Generated migration — Initial procurement app (Supplier, ProcurementRequest, SupplierQuote, SupplierInvoice)
# NOTE: modèle CashVoucher (pièce de caisse) fusionné dans treasury.CashEntry
# dès cette migration initiale — jamais déployé sous sa forme d'origine, cf.
# docs/AUDIT_LOGIQUE_METIER_TRESORERIE_2026-08.md §H3.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0010_documentattachment'),
    ]

    operations = [
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('name', models.CharField(max_length=255)),
                ('siret', models.CharField(blank=True, max_length=14, null=True, unique=True)),
                ('email', models.EmailField(max_length=254)),
                ('phone', models.CharField(max_length=50)),
                ('address', models.TextField()),
                ('city', models.CharField(blank=True, max_length=100)),
                ('postal_code', models.CharField(blank=True, max_length=20)),
                ('country', models.CharField(default='Sénégal', max_length=100)),
                ('bank_account', models.CharField(help_text='IBAN ou compte local', max_length=50)),
                ('bank_name', models.CharField(blank=True, max_length=255)),
                ('contact_person', models.CharField(max_length=255)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'ordering': ['name'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='ProcurementRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('estimated_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(choices=[('BROUILLON', 'Brouillon'), ('EN_ATTENTE_RCF', 'En attente RCF'), ('EN_ATTENTE_MANAGER', 'En attente Gérant'), ('APPROUVEE', 'Approuvée'), ('REJETEE', 'Rejetée'), ('EN_COURS', 'En cours (devis/décaissement)'), ('TERMINEE', 'Terminée (achat fait)')], default='BROUILLON', max_length=20)),
                ('rejection_reason', models.TextField(blank=True)),
                ('rcf_approved_at', models.DateTimeField(blank=True, null=True)),
                ('manager_approved_at', models.DateTimeField(blank=True, null=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='procurement_requests', to='core.department')),
                ('manager_approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_procurements_manager', to=settings.AUTH_USER_MODEL)),
                ('rcf_approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_procurements_rcf', to=settings.AUTH_USER_MODEL)),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='procurement_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='SupplierQuote',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('quote_number', models.CharField(editable=False, max_length=20, unique=True)),
                ('quote_date', models.DateField(default=django.utils.timezone.now)),
                ('amount_ht', models.DecimalField(decimal_places=2, max_digits=12)),
                ('vat_rate', models.DecimalField(decimal_places=2, default='0.18', max_digits=4)),
                ('amount_ttc', models.DecimalField(decimal_places=2, editable=False, max_digits=12)),
                ('status', models.CharField(choices=[('BROUILLON', 'Brouillon'), ('EN_ATTENTE', 'En attente validation'), ('VALIDE', 'Validé'), ('REJETE', 'Rejeté')], default='BROUILLON', max_length=20)),
                ('rcf_validated_at', models.DateTimeField(blank=True, null=True)),
                ('manager_validated_at', models.DateTimeField(blank=True, null=True)),
                ('manager_validated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='validated_quotes_manager', to=settings.AUTH_USER_MODEL)),
                ('procurement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='quotes', to='procurement.procurementrequest')),
                ('rcf_validated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='validated_quotes_rcf', to=settings.AUTH_USER_MODEL)),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='quotes', to='procurement.supplier')),
            ],
            options={
                'ordering': ['-quote_date'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='SupplierInvoice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('invoice_number', models.CharField(max_length=20, unique=True)),
                ('invoice_date', models.DateField()),
                ('due_date', models.DateField(blank=True, null=True)),
                ('amount_ht', models.DecimalField(decimal_places=2, max_digits=12)),
                ('vat_rate', models.DecimalField(decimal_places=2, default='0.18', max_digits=4)),
                ('amount_ttc', models.DecimalField(decimal_places=2, editable=False, max_digits=12)),
                ('status', models.CharField(choices=[('RECUE', 'Reçue'), ('VALIDEE', 'Validée'), ('PAYEE', 'Payée')], default='RECUE', max_length=20)),
                ('received_at', models.DateTimeField(auto_now_add=True)),
                ('validated_at', models.DateTimeField(blank=True, null=True)),
                ('procurement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoices', to='procurement.procurementrequest')),
                ('quote', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invoices', to='procurement.supplierquote')),
                ('received_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='received_invoices', to=settings.AUTH_USER_MODEL)),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='invoices', to='procurement.supplier')),
                ('validated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='validated_supplier_invoices', to=settings.AUTH_USER_MODEL)),
                # cash_entry (FK vers treasury.CashEntry) ajouté par procurement/0002 —
                # doit être créé après treasury/0001 pour éviter la dépendance
                # circulaire procurement<->treasury au niveau des migrations.
            ],
            options={
                'ordering': ['-invoice_date'],
                'abstract': False,
            },
        ),
        migrations.AddIndex(
            model_name='supplier',
            index=models.Index(fields=['name'], name='procurement_s_name_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='procurementrequest',
            index=models.Index(fields=['status'], name='procurement_p_status_x9y8z7_idx'),
        ),
    ]
