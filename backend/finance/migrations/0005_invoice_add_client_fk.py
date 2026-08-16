# Generated migration — Invoice.client FK + client_name nullable

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('administration', '0001_initial'),  # Client model from administration app
        ('finance', '0004_invoice_quote'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='client',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invoices', to='administration.client'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='client_name',
            field=models.CharField(blank=True, help_text='Utilisé si pas de client FK (legacy)', max_length=255),
        ),
    ]
