from django.db import migrations, models


def delete_all_posts(apps, schema_editor):
    # Simplifying the model (dropping excerpt/tags/visual_icon/label/
    # sublabel/meta_description, content JSON -> HTML string) makes every
    # existing row's data meaningless — wipe them rather than carry over
    # content nothing can render correctly anymore. Deleted before the
    # schema changes below so there's no JSON-list-in-a-TextField artifact.
    BlogPost = apps.get_model('marketing', 'BlogPost')
    BlogPost.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0014_seed_blog_posts'),
    ]

    operations = [
        migrations.RunPython(delete_all_posts, migrations.RunPython.noop),
        migrations.RenameField(
            model_name='blogpost',
            old_name='visual_image',
            new_name='cover_image',
        ),
        migrations.RemoveField(model_name='blogpost', name='excerpt'),
        migrations.RemoveField(model_name='blogpost', name='visual_icon'),
        migrations.RemoveField(model_name='blogpost', name='visual_label'),
        migrations.RemoveField(model_name='blogpost', name='visual_sublabel'),
        migrations.RemoveField(model_name='blogpost', name='tags'),
        migrations.RemoveField(model_name='blogpost', name='meta_description'),
        migrations.AlterField(
            model_name='blogpost',
            name='content',
            field=models.TextField(blank=True),
        ),
    ]
