"""E-mails liés au compte — invitation à la création, et tout ce qui touche
à l'accès plateforme lui-même plutôt qu'à un module métier particulier.
Même pattern que marketing/emails.py et projects/emails.py : texte + lien
d'action, via core.mailer.send_mail (l'unique point d'entrée e-mail de
l'application)."""

from django.conf import settings

from core import mailer


def send_user_invitation_email(user, password: str) -> bool:
    """Prévient un nouvel utilisateur que son accès à la plateforme est
    prêt, avec son mot de passe initial et un lien direct pour se
    connecter. Le mot de passe en clair dans le corps du mail est un choix
    assumé (demande explicite) — sans garde-fou supplémentaire (pas de lien
    de définition de mot de passe à la place), c'est ce qui a été demandé."""
    if not user.email:
        return False
    return mailer.send_template(
        'user_invitation',
        user.email,
        {'first_name': user.first_name, 'email': user.email, 'password': password},
        action_url=f'{settings.PUBLIC_SITE_URL}/connexion',
        action_label='Se connecter',
    )
