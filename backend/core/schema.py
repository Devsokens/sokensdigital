from drf_spectacular.extensions import OpenApiAuthenticationExtension


class FirebaseAuthenticationScheme(OpenApiAuthenticationExtension):
    """Tells drf-spectacular how to document FirebaseAuthentication — without
    this, Swagger UI has no "Authorize" button and every endpoint looks
    unauthenticated in the docs, even though it isn't."""

    target_class = 'core.authentication.FirebaseAuthentication'
    name = 'firebaseAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'Firebase ID token',
            'description': 'Paste a Firebase ID token (from signInWithEmailAndPassword → user.getIdToken()).',
        }
