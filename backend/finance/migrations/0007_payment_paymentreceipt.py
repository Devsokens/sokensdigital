# Generated migration — Payment + PaymentReceipt models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('finance', '0006_finance_settings'),
    ]

    operations = [
        migrations.CreateModel(
            name='Payment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('payment_date', models.DateField()),
                ('payment_method', models.CharField(choices=[('CHEQUE', 'Chèque'), ('VIREMENT', 'Virement'), ('ESPECES', 'Espèces'), ('CARTE', 'Carte bancaire'), ('AUTRE', 'Autre')], max_length=20)),
                ('status', models.CharField(choices=[('EN_ATTENTE', 'En attente'), ('RECU', 'Reçu'), ('ENREGISTRE', 'Enregistré')], default='EN_ATTENTE', max_length=20)),
                ('received_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='finance.invoice')),
                ('received_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='received_payments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='PaymentReceipt',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('receipt_number', models.CharField(editable=False, max_length=20, unique=True)),
                ('issued_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='issued_receipts', to=settings.AUTH_USER_MODEL)),
                ('payment', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='receipt', to='finance.payment')),
            ],
            options={
                'ordering': ['-created_at'],
                'abstract': False,
            },
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(fields=['invoice', 'status'], name='finance_pay_invoice_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(fields=['payment_date'], name='finance_pay_payment_x9y8z7_idx'),
        ),
    ]
