# Generated migration — DocumentAttachment model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('contenttypes', '0002_remove_content_type_name'),
        ('core', '0008_add_support_permissions'),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentAttachment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('object_id', models.CharField(max_length=255)),
                ('document_type', models.CharField(choices=[('CHEQUE', 'Chèque'), ('BORDEREAU', 'Bordereau de versement'), ('BANK_STATEMENT', 'Attestation de virement'), ('INVOICE', 'Facture'), ('RECEIPT', 'Reçu'), ('QUOTE', 'Devis'), ('CONTRACT', 'Contrat'), ('OTHER', 'Autre')], max_length=20)),
                ('file', models.FileField(upload_to='documents/%Y/%m/%d/')),
                ('file_name', models.CharField(max_length=255)),
                ('file_size', models.BigIntegerField(default=0)),
                ('notes', models.TextField(blank=True)),
                ('content_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='contenttypes.contenttype')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_attachments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'abstract': False,
            },
        ),
        migrations.AddIndex(
            model_name='documentattachment',
            index=models.Index(fields=['content_type', 'object_id'], name='core_docume_content_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='documentattachment',
            index=models.Index(fields=['document_type'], name='core_docume_document_x9y8z7_idx'),
        ),
    ]
