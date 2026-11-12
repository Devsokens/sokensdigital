"""Suppression du compte plateforme d'une personne.

Le compte (connexion Firebase + profil Firestore + rôles) est supprimé ; la
ligne `User` Django est conservée, car elle porte l'identité de la fiche
employé et tout l'historique rattaché à ce user_id (audit log, besoins
validés, timesheets…). Une vraie suppression de la ligne casserait ces
liens, ou supprimerait la fiche employé en cascade.

Utilisé par la suppression d'un utilisateur (la fiche employé reste) et par
la suppression d'un employé (son compte part avec lui).
"""

import logging

from django.db import transaction
from django.utils import timezone

from core.firestore_client import delete_profile, invalidate_role_cache
from core.models import AuditLog

logger = logging.getLogger(__name__)


class AccountDeletionError(Exception):
    """Le compte Firebase n'a pas pu être supprimé — rien n'a été modifié."""


def delete_platform_account(user, actor=None, ip_address=None):
    if user.account_deleted_at:
        return

    if user.firebase_uid:
        from firebase_admin import auth as firebase_auth

        # Firebase d'abord : si la connexion ne peut pas être coupée, on ne
        # marque rien comme supprimé côté Django (sinon la personne pourrait
        # encore se connecter avec un compte présenté comme supprimé).
        try:
            firebase_auth.delete_user(user.firebase_uid)
        except firebase_auth.UserNotFoundError:
            pass
        except Exception as exc:
            logger.exception('Suppression Firebase impossible pour %s', user.firebase_uid)
            raise AccountDeletionError('Le compte de connexion n\'a pas pu être supprimé.') from exc
        try:
            delete_profile(user.firebase_uid)
        except Exception:
            # Profil orphelin sans compte de connexion : sans conséquence
            # pour l'accès, journalisé pour nettoyage.
            logger.exception('Suppression du profil Firestore impossible pour %s', user.firebase_uid)
        invalidate_role_cache(user.firebase_uid)

    with transaction.atomic():
        user.firebase_uid = None
        user.is_active = False
        user.is_gerant = False
        user.permission_overrides = {}
        user.account_deleted_at = timezone.now()
        user.save(update_fields=[
            'firebase_uid', 'is_active', 'is_gerant', 'permission_overrides', 'account_deleted_at',
        ])
        user.roles.clear()
        AuditLog.objects.log_action(
            user=actor,
            action='USER_ACCOUNT_DELETE',
            entity_type='User',
            entity_id=str(user.pk),
            details={'name': f'{user.first_name} {user.last_name}'.strip()},
            ip_address=ip_address,
        )
