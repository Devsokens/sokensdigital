from firebase_admin import auth
from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model

User = get_user_model()

# Firebase Admin is initialized once at startup in core.apps.CoreConfig.ready().


class FirebaseAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if not auth_header:
            return None

        parts = auth_header.split()
        if parts[0].lower() != 'bearer':
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
        except Exception as e:
            raise exceptions.AuthenticationFailed(f'Invalid Firebase ID token: {str(e)}')

        if not email:
            raise exceptions.AuthenticationFailed(
                'Firebase token does not contain an email address.'
            )

        try:
            user = User.objects.get(firebase_uid=uid)
        except User.DoesNotExist:
            # No user linked to this Firebase UID yet. `email` is encrypted
            # at rest (non-deterministic ciphertext) so it can't be used in
            # a DB-level lookup — check in Python whether an account was
            # pre-provisioned for this email (e.g. via `bootstrap_admin`,
            # or created by an admin/RH endpoint ahead of first login) and
            # link it, instead of creating a duplicate.
            existing = next(
                (u for u in User.objects.filter(firebase_uid__isnull=True) if u.email == email),
                None,
            )
            if existing:
                existing.firebase_uid = uid
                existing.save(update_fields=['firebase_uid'])
                user = existing
            else:
                user = User.objects.create(email=email, firebase_uid=uid, is_active=True)
        except Exception:
            raise exceptions.AuthenticationFailed('Could not retrieve user.')

        return (user, decoded_token)
