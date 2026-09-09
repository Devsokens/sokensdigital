"""Parcours d'une demande de projet entre Marketing et Technique.

Une demande arrivée par le portail public traverse les deux départements :

    Soumis                 → Marketing la reçoit et l'envoie au Technique
    En analyse technique   → Technique analyse et joint un cahier des charges
    Cahier des charges prêt→ Marketing le soumet au client
    Soumis au client       → Marketing signale la validation du client
    Validé par le client   → Technique bascule en développement
    En développement

Les transitions sont déclarées ici plutôt que dispersées dans les vues, pour
que la question « qui peut faire quoi, et depuis quel état » se lise d'un
bloc. Chacune nomme l'étape de départ, l'étape d'arrivée et les rôles admis.
"""

from dataclasses import dataclass

from core.constants import (
    ROLE_ADMIN,
    ROLE_COMMERCIAL,
    ROLE_DEVELOPER,
    ROLE_PROJECT_MANAGER,
    ROLE_RESPONSABLE_MARKETING,
)
from marketing.models import Lead

# Le Super-Administrateur n'est listé nulle part : `core.permissions.has_role`
# le fait passer toute vérification.
MARKETING_SIDE = (ROLE_RESPONSABLE_MARKETING, ROLE_COMMERCIAL, ROLE_ADMIN)
TECHNIQUE_SIDE = (ROLE_PROJECT_MANAGER, ROLE_DEVELOPER, ROLE_ADMIN)


@dataclass(frozen=True)
class Transition:
    action: str
    label: str
    source: str
    target: str
    roles: tuple[str, ...]
    #: L'action exige qu'un cahier des charges soit attaché à la demande.
    requires_specification: bool = False


TRANSITIONS: tuple[Transition, ...] = (
    Transition(
        action='envoyer_technique',
        label='Envoyer au technique',
        source=Lead.WorkflowStage.SOUMIS,
        target=Lead.WorkflowStage.CHEZ_TECHNIQUE,
        roles=MARKETING_SIDE,
    ),
    Transition(
        action='joindre_cdc',
        label='Transmettre le cahier des charges',
        source=Lead.WorkflowStage.CHEZ_TECHNIQUE,
        target=Lead.WorkflowStage.CDC_PRET,
        roles=TECHNIQUE_SIDE,
        # Sans cette exigence, l'étape « cahier des charges prêt » pourrait
        # être atteinte sans cahier des charges, et Marketing n'aurait rien
        # à soumettre au client.
        requires_specification=True,
    ),
    Transition(
        action='soumettre_client',
        label='Soumettre au client',
        source=Lead.WorkflowStage.CDC_PRET,
        target=Lead.WorkflowStage.SOUMIS_CLIENT,
        roles=MARKETING_SIDE,
    ),
    Transition(
        action='valider_client',
        label='Le client a validé',
        source=Lead.WorkflowStage.SOUMIS_CLIENT,
        target=Lead.WorkflowStage.VALIDE_CLIENT,
        roles=MARKETING_SIDE,
    ),
    Transition(
        action='demarrer_developpement',
        label='Passer en développement',
        source=Lead.WorkflowStage.VALIDE_CLIENT,
        target=Lead.WorkflowStage.EN_DEVELOPPEMENT,
        roles=TECHNIQUE_SIDE,
    ),
    Transition(
        action='renvoyer_technique',
        label='Renvoyer au technique',
        source=Lead.WorkflowStage.CDC_PRET,
        target=Lead.WorkflowStage.CHEZ_TECHNIQUE,
        roles=MARKETING_SIDE,
    ),
)

BY_ACTION = {transition.action: transition for transition in TRANSITIONS}


def available_transitions(lead: Lead, user) -> list[Transition]:
    """Transitions que cet utilisateur peut déclencher sur cette demande.

    Sert à l'interface : chaque département n'affiche que les boutons qui
    aboutiraient. Le contrôle réel reste côté vue — une liste d'actions
    n'est pas une autorisation.
    """
    from core.permissions import has_role

    return [
        transition
        for transition in TRANSITIONS
        if transition.source == lead.workflow_stage and has_role(user, *transition.roles)
    ]
