"""Référentiel des rôles 2026 : 13 rôles (Super-Admin + 12 fonctionnels).

Anciens rôles reclassés (décision du 23/11/2026) :
- Administrateur, Responsable RH      -> Responsable Administratif
- Directeur Financier                 -> Comptable
- Support Client, Consultant          -> Responsable Technique
- Responsable Marketing               -> Responsable Marketing & Communication

Puis plafond de cumul : 2 rôles fonctionnels au plus par utilisateur (les
plus élevés sont gardés, les autres retirés et journalisés dans l'audit).
Les profils Firestore (source des rôles côté interface) sont alignés de la
même façon quand les identifiants Firebase sont disponibles.
"""
import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def forwards(apps, schema_editor):
    from core.constants import (
        DEFAULT_ROLE_PERMISSIONS, FUNCTIONAL_ROLES, LEGACY_ROLE_MAPPING, MAX_FUNCTIONAL_ROLES, ROLE_SUPER_ADMIN,
    )

    Role = apps.get_model('core', 'Role')
    User = apps.get_model('core', 'User')
    AuditLog = apps.get_model('core', 'AuditLog')

    # 1. Rôles du référentiel présents, avec leurs permissions par défaut.
    for name, perms in DEFAULT_ROLE_PERMISSIONS.items():
        role, created = Role.objects.get_or_create(name=name, defaults={'permissions': perms})
        if not created and not role.permissions:
            role.permissions = perms
            role.save(update_fields=['permissions'])

    # 2. Anciens rôles : utilisateurs et permissions reportés, rôle supprimé.
    for old_name, new_name in LEGACY_ROLE_MAPPING.items():
        old = Role.objects.filter(name=old_name).first()
        if not old:
            continue
        new = Role.objects.get(name=new_name)
        for user in User.objects.filter(roles=old):
            user.roles.add(new)
            user.roles.remove(old)
        merged = dict(new.permissions or {})
        for module, actions in (old.permissions or {}).items():
            merged[module] = sorted(set(merged.get(module, [])) | set(actions or []))
        new.permissions = merged
        new.save(update_fields=['permissions'])
        old.delete()

    # 3. Tout autre rôle hors référentiel : retiré.
    allowed = set(DEFAULT_ROLE_PERMISSIONS)
    for role in Role.objects.exclude(name__in=allowed):
        role.delete()

    # 4. Plafond : 2 rôles fonctionnels au plus (priorité = ordre du référentiel).
    priority = {name: i for i, name in enumerate(FUNCTIONAL_ROLES)}
    for user in User.objects.prefetch_related('roles'):
        functional = sorted(
            (r for r in user.roles.all() if r.name != ROLE_SUPER_ADMIN),
            key=lambda r: priority.get(r.name, 99),
        )
        extra = functional[MAX_FUNCTIONAL_ROLES:]
        if extra:
            user.roles.remove(*extra)
            AuditLog.objects.create(
                user=None, action='ROLES_PLAFONNES', entity_type='User', entity_id=str(user.pk),
                details={'retires': [r.name for r in extra], 'regle': '2 rôles fonctionnels maximum'},
            )

    # 5. Profils Firestore alignés (best effort : sans identifiants Firebase,
    #    en dev, l'interface normalise de toute façon les anciens noms).
    try:
        from core import firestore_client
        from core.serializers import normalize_app_roles
        client = firestore_client._get_client()
        for snap in client.collection('profiles').stream():
            data = snap.to_dict() or {}
            current = list(data.get('roles') or ([data['role']] if data.get('role') else []))
            target = normalize_app_roles(current)
            if target != current:
                update = {'roles': target}
                if data.get('role') and data.get('role') not in target:
                    update['role'] = target[0] if target else None
                snap.reference.update(update)
    except Exception:
        logger.warning('Profils Firestore non alignés (identifiants Firebase indisponibles ?)', exc_info=True)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_signataires_designes'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
