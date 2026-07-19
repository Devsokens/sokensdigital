import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sokens_backend.settings')

app = Celery('sokens_backend')

# Reads CELERY_* settings from settings.py (the "CELERY_" prefix is what
# `namespace='CELERY'` tells Celery to strip when looking them up).
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discovers a `tasks.py` in every installed app (core, hr, projects,
# finance, marketing, ...) as those apps get built out.
app.autodiscover_tasks()
