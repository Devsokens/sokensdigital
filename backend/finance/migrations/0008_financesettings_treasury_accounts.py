from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0007_payment_paymentreceipt'),
    ]

    operations = [
        migrations.AddField(
            model_name='financesettings',
            name='default_purchases_account_code',
            field=models.CharField(blank=True, default='601', help_text='Code compte Achats (ex: 601 = Achats de marchandises)', max_length=20),
        ),
        migrations.AddField(
            model_name='financesettings',
            name='default_vat_deductible_account_code',
            field=models.CharField(blank=True, default='4456', help_text='Code compte TVA déductible (ex: 4456)', max_length=20),
        ),
        migrations.AddField(
            model_name='financesettings',
            name='default_supplier_account_code',
            field=models.CharField(blank=True, default='401', help_text='Code compte Fournisseurs (ex: 401)', max_length=20),
        ),
        migrations.AddField(
            model_name='financesettings',
            name='default_cash_account_code',
            field=models.CharField(blank=True, default='530', help_text='Code compte Caisse physique (ex: 530)', max_length=20),
        ),
        migrations.AddField(
            model_name='financesettings',
            name='default_bank_account_code',
            field=models.CharField(blank=True, default='512', help_text='Code compte Banque (ex: 512)', max_length=20),
        ),
        migrations.AddField(
            model_name='financesettings',
            name='default_capital_account_code',
            field=models.CharField(blank=True, default='101', help_text='Code compte Capital social (ex: 101)', max_length=20),
        ),
    ]
