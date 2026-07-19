import json
import logging
import os

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        self._init_firebase()

    def _init_firebase(self):
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return

        cred_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
        cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')

        try:
            if cred_json:
                cred = credentials.Certificate(json.loads(cred_json))
                firebase_admin.initialize_app(cred)
            elif cred_path:
                firebase_admin.initialize_app(credentials.Certificate(cred_path))
            else:
                logger.warning(
                    'Firebase Admin SDK was not initialized: set '
                    'FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS. '
                    'Endpoints using FirebaseAuthentication will fail until then.'
                )
        except (ValueError, json.JSONDecodeError) as exc:
            logger.error('Failed to initialize Firebase Admin SDK: %s', exc)
