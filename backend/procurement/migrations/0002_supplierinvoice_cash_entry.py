# Ajoute SupplierInvoice.cash_entry après coup — dépend de treasury.CashEntry,
# qui lui-même dépend de procurement.SupplierInvoice (supplier_invoice FK) :
# ce découpage en 2 migrations évite le cycle procurement<->treasury.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0001_initial'),
        ('treasury', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplierinvoice',
            name='cash_entry',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='paid_supplier_invoice', to='treasury.cashentry'),
        ),
    ]
