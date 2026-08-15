"""
Fixtures partagées pour tous les tests du backend Soken's Digital.
"""
import pytest
from core.models import User, Role, Department


@pytest.fixture
def department(db):
    """Département Technique par défaut."""
    return Department.objects.create(name='Technique', description='Département Technique')


@pytest.fixture
def admin_department(db):
    """Département Administration par défaut — get_or_create, not create:
    core.migrations.0002_seed_default_departments already seeds a
    department named 'Administration' on a fresh test DB."""
    dept, _ = Department.objects.get_or_create(name='Administration', defaults={'description': 'Département Administration'})
    return dept


# ---- Rôles ----
# get_or_create everywhere below, not create — core.migrations.0003_seed_role_permissions
# pre-seeds every role name on a fresh test DB, so a plain create() collides
# on the unique `name` constraint.

@pytest.fixture
def role_super_admin(db):
    role, _ = Role.objects.get_or_create(name='Super-Administrateur', defaults={'description': 'Super Admin'})
    return role


@pytest.fixture
def role_admin(db):
    role, _ = Role.objects.get_or_create(name='Administrateur', defaults={'description': 'Admin'})
    return role


@pytest.fixture
def role_project_manager(db):
    role, _ = Role.objects.get_or_create(name='Chef de Projet', defaults={'description': 'PM'})
    return role


@pytest.fixture
def role_developer(db):
    role, _ = Role.objects.get_or_create(name='Développeur', defaults={'description': 'Dev'})
    return role


@pytest.fixture
def role_directeur_financier(db):
    role, _ = Role.objects.get_or_create(name='Directeur Financier', defaults={'description': 'DF'})
    return role


@pytest.fixture
def role_commercial(db):
    role, _ = Role.objects.get_or_create(name='Commercial', defaults={'description': 'Commercial'})
    return role


@pytest.fixture
def role_rh_manager(db):
    role, _ = Role.objects.get_or_create(name='Responsable RH', defaults={'description': 'RH'})
    return role


# ---- Utilisateurs avec rôles ----

@pytest.fixture
def super_admin_user(db, role_super_admin, department):
    user = User.objects.create_user(
        email='superadmin@sokens.digital',
        password='SuperAdmin1234!',
        first_name='Super',
        last_name='Admin',
    )
    user.roles.add(role_super_admin)
    user.department = department
    user.save()
    return user


@pytest.fixture
def admin_user(db, role_admin, admin_department):
    user = User.objects.create_user(
        email='admin@sokens.digital',
        password='AdminUser1234!',
        first_name='Admin',
        last_name='User',
    )
    user.roles.add(role_admin)
    user.department = admin_department
    user.save()
    return user


@pytest.fixture
def pm_user(db, role_project_manager, department):
    user = User.objects.create_user(
        email='pm@sokens.digital',
        password='ProjectMgr1234!',
        first_name='Chef',
        last_name='Projet',
    )
    user.roles.add(role_project_manager)
    user.department = department
    user.save()
    return user


@pytest.fixture
def dev_user(db, role_developer, department):
    user = User.objects.create_user(
        email='dev@sokens.digital',
        password='Developer1234!',
        first_name='Développeur',
        last_name='Senior',
    )
    user.roles.add(role_developer)
    user.department = department
    user.save()
    return user


@pytest.fixture
def commercial_user(db, role_commercial, admin_department):
    user = User.objects.create_user(
        email='commercial@sokens.digital',
        password='Commercial1234!',
        first_name='Commercial',
        last_name='Agent',
    )
    user.roles.add(role_commercial)
    user.department = admin_department
    user.save()
    return user


@pytest.fixture
def rh_user(db, role_rh_manager, admin_department):
    user = User.objects.create_user(
        email='rh@sokens.digital',
        password='RHManager1234!',
        first_name='Responsable',
        last_name='RH',
    )
    user.roles.add(role_rh_manager)
    user.department = admin_department
    user.save()
    return user


@pytest.fixture
def regular_user(db, department):
    """Utilisateur sans rôle spécifique (collaborateur standard)."""
    return User.objects.create_user(
        email='collab@sokens.digital',
        password='Collaborator1234!',
        first_name='Collaborateur',
        last_name='Standard',
    )


@pytest.fixture
def api_client():
    """Client API DRF pour les tests."""
    from rest_framework.test import APIClient
    return APIClient()
