from django.apps import AppConfig

class TechniqueConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'technique'
    verbose_name = 'Département Technique'

    def ready(self):
        import technique.signals
