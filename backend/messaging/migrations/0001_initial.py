import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
        ('technique', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ChannelMetadata',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('firestore_conversation_id', models.CharField(db_index=True, max_length=255, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('type', models.CharField(choices=[
                    ('DEPARTMENT', 'Département'), ('PROJECT', 'Projet'),
                    ('DIRECT', 'Direct'), ('GROUP', 'Groupe'),
                ], max_length=20)),
                ('is_private', models.BooleanField(default=False)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='channels', to='core.department')),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='channels', to='technique.project')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='ChannelParticipant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('channel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='messaging.channelmetadata')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='channel_participations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.AddIndex(
            model_name='channelmetadata',
            index=models.Index(fields=['created_at'], name='messaging_cm_created_idx'),
        ),
        migrations.AddIndex(
            model_name='channelmetadata',
            index=models.Index(fields=['type'], name='messaging_cm_type_idx'),
        ),
        migrations.AddIndex(
            model_name='channelparticipant',
            index=models.Index(fields=['created_at'], name='messaging_cp_created_idx'),
        ),
        migrations.AddConstraint(
            model_name='channelparticipant',
            constraint=models.UniqueConstraint(fields=['channel', 'user'], name='unique_channel_participant'),
        ),
    ]
