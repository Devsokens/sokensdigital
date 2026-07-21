import firebase_admin
from firebase_admin import auth, credentials
from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model

User = get_user_model()

# Note: Firebase Admin must be initialized in apps.py or settings.py
# with proper service account credentials.

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
            raise exceptions.AuthenticationFailed('Firebase token does not contain an email address.')

        try:
            # Get or create the user based on email (USERNAME_FIELD)
            user, created = User.objects.get_or_create(
                email=email,
                defaults={'is_active': True}
            )
            
        except Exception as e:
            raise exceptions.AuthenticationFailed('Could not create or retrieve user.')

        return (user, decoded_token)
