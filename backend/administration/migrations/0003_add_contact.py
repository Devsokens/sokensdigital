import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('administration', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('first_name', models.CharField(max_length=255)),
                ('last_name', models.CharField(max_length=255)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('phone', models.CharField(blank=True, max_length=50)),
                ('role', models.CharField(blank=True, max_length=255)),
                ('is_primary', models.BooleanField(default=False)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contacts', to='administration.client')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.AddField(
            model_name='clientinteraction',
            name='contact',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='interactions', to='administration.contact'),
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['created_at'], name='administrat_created_ct001_idx'),
        ),
    ]
