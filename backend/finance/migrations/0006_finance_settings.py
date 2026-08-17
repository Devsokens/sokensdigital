# Generated migration — FinanceSettings model for VAT rate + account defaults

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_invoice_add_client_fk'),
    ]

    operations = [
        migrations.CreateModel(
            name='FinanceSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vat_rate', models.DecimalField(decimal_places=2, default='0.18', help_text='Taux TVA appliqué par défaut aux nouvelles factures (ex: 0.18 = 18%)', max_digits=4)),
                ('default_client_account_code', models.CharField(blank=True, default='411', help_text='Code compte Client (ex: 411 = Clients en France)', max_length=20)),
                ('default_sales_account_code', models.CharField(blank=True, default='706', help_text='Code compte Prestations (ex: 706 = Prestations de services)', max_length=20)),
                ('default_vat_collected_account_code', models.CharField(blank=True, default='4457', help_text='Code compte TVA collectée (ex: 4457)', max_length=20)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'Finance Settings',
            },
        ),
    ]
