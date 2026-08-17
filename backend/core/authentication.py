import logging

from firebase_admin import auth
from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model

from core.models import hash_email

User = get_user_model()
logger = logging.getLogger(__name__)

# Firebase Admin is initialized once at startup in core.apps.CoreConfig.ready().


class FirebaseAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if not auth_header:
            return None

        parts = auth_header.split()
        if not parts or parts[0].lower() != 'bearer':
            return None

        if len(parts) == 1:
            raise exceptions.AuthenticationFailed('Invalid token header. No credentials provided.')
        elif len(parts) > 2:
            raise exceptions.AuthenticationFailed('Invalid token header. Token string should not contain spaces.')

        id_token = parts[1]

        try:
            # Verify token with Firebase
            decoded_token = auth.verify_id_token(id_token)
            uid = decoded_token.get('uid')
            email = decoded_token.get('email')
        except Exception:
            # Ne jamais renvoyer le message d'exception brut du SDK au
            # client (peut révéler des détails internes utiles pour
            # affiner une attaque) — logué côté serveur, générique côté
            # client.
            logger.warning('Firebase token verification failed', exc_info=True)
            raise exceptions.AuthenticationFailed('Invalid or expired authentication token.')

        if not email:
            raise exceptions.AuthenticationFailed(
                'Firebase token does not contain an email address.'
            )

        try:
            user = User.objects.get(firebase_uid=uid)
        except User.DoesNotExist:
            # No user linked to this Firebase UID yet. Check whether an
            # account was pre-provisioned for this email (e.g. via
            # `bootstrap_admin`, or created by an admin/RH endpoint ahead of
            # first login) via the deterministic email_hash, and link it
            # instead of creating a duplicate.
            existing = User.objects.filter(
                firebase_uid__isnull=True, email_hash=hash_email(email)
            ).first()
            if existing:
                existing.firebase_uid = uid
                existing.save(update_fields=['firebase_uid'])
                user = existing
            else:
                # Refuser l'auto-provisioning : un compte doit être créé
                # par un Super-Admin/RH (ProvisionUserView) AVANT qu'un
                # token Firebase ne soit accepté côté API. Sans ce garde,
                # n'importe qui capable de s'inscrire côté Firebase Auth
                # (self-signup Email/Password, indépendant des Firestore
                # rules qui n'interdisent que la création de *profil*)
                # obtenait un User Django actif et passait IsAuthenticated
                # partout — porte d'entrée pour un inconnu sans rôle.
                logger.warning('Firebase token verified for unprovisioned email: %s', email)
                raise exceptions.AuthenticationFailed(
                    "Aucun compte Soken's Digital associé à cette adresse. "
                    'Contactez un administrateur pour être provisionné.'
                )
        except Exception:
            raise exceptions.AuthenticationFailed('Could not retrieve user.')

        return (user, decoded_token)

    def authenticate_header(self, request):
        # Without this, DRF can't tell an "unauthenticated" 401 apart from
        # a "you're authenticated but not allowed" 403, and defaults every
        # anonymous request to 403 — wrong for a bearer-token API.
        return 'Bearer'
