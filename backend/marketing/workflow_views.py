"""Vues du parcours d'une demande entre Marketing et Technique."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import AuditLog
from core.notifications import notify, notify_roles
from core.permissions import has_role
from marketing.models import Lead, Specification
from marketing.workflow import BY_ACTION, MARKETING_SIDE, TECHNIQUE_SIDE, available_transitions


def serialize_lead(lead: Lead, user) -> dict:
    """Vue d'une demande dans le parcours, telle que les deux départements
    la lisent. Inclut les actions ouvertes à cet utilisateur, pour que
    l'interface n'affiche pas de bouton qui échouerait.

    Champs complets (décision du 10/09/2026) : la carte doit permettre de
    voir toutes les informations de la demande et son cahier des charges
    joint, dans n'importe quel département par lequel elle passe — pas
    seulement un résumé, ce qui obligeait jusqu'ici à rouvrir la demande
    ailleurs pour la lire en entier."""
    return {
        'id': str(lead.id),
        'reference': lead.tracking_reference,
        'first_name': lead.first_name,
        'last_name': lead.last_name,
        'company_name': lead.company_name,
        'email': lead.email,
        'phone': lead.phone,
        'message': lead.message,
        'source': lead.source,
        'source_display': lead.get_source_display(),
        'estimated_value': str(lead.estimated_value) if lead.estimated_value else None,
        'created_at': lead.created_at.isoformat(),
        'workflow_stage': lead.workflow_stage,
        'workflow_stage_display': lead.get_workflow_stage_display(),
        # Cahier des charges déjà fourni par le client via le formulaire
        # public (bucket privé `demandes-projet`, voir core.storage et
        # docs/ROADMAP_TECHNIQUE.md) — distinct de `specification`, qui est
        # celui que Technique rédige/joint plus tard dans le parcours.
        'attachment_url': lead.attachment_url or None,
        'attachment_name': lead.attachment_name or None,
        'specification': (
            {
                'id': str(lead.specification.id),
                'spec_number': lead.specification.spec_number,
                'title': lead.specification.title,
                'status': lead.specification.status,
            }
            if lead.specification_id
            else None
        ),
        'available_actions': [
            {'action': t.action, 'label': t.label}
            for t in available_transitions(lead, user)
        ],
        'can_reject': has_role(user, *MARKETING_SIDE, *TECHNIQUE_SIDE),
    }


class SubmittedProjectListView(APIView):
    """Demandes en cours de parcours, filtrables par étape.

    Les deux départements lisent la même liste : Marketing ouvre son espace
    « projets soumis », Technique son espace de gestion, chacun sur les
    étapes qui le concernent. Une seule source évite que les deux vues
    divergent sur ce qu'est une demande en cours.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not has_role(request.user, *MARKETING_SIDE, *TECHNIQUE_SIDE):
            return Response(status=status.HTTP_403_FORBIDDEN)

        queryset = Lead.objects.select_related('specification').exclude(
            status=Lead.Status.PERDU,
        )
        stages = request.query_params.getlist('stage')
        if stages:
            queryset = queryset.filter(workflow_stage__in=stages)

        return Response([serialize_lead(lead, request.user) for lead in queryset])


class LeadWorkflowActionView(APIView):
    """Déclenche une transition sur une demande."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        lead = get_object_or_404(Lead.objects.select_related('specification'), pk=pk)
        action = (request.data.get('action') or '').strip()

        transition = BY_ACTION.get(action)
        if transition is None:
            raise serializers.ValidationError({'action': f'Action inconnue : « {action} ».'})

        if lead.workflow_stage != transition.source:
            # L'état a bougé depuis que l'écran a été chargé — deux personnes
            # travaillant sur la même demande, typiquement. On le dit plutôt
            # que d'appliquer une transition depuis un état inattendu.
            raise serializers.ValidationError({
                'action': (
                    f'Cette demande est à l\'étape « {lead.get_workflow_stage_display()} », '
                    f'l\'action demandée part de « {Lead.WorkflowStage(transition.source).label} ».'
                ),
            })

        if not has_role(request.user, *transition.roles):
            return Response(
                {'detail': "Votre rôle ne permet pas cette action sur le parcours."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Le cahier des charges peut être joint dans le même geste que la
        # transmission : c'est ce que fait Technique en pratique, et l'exiger
        # en deux appels ferait exister un état intermédiaire sans raison.
        specification_id = request.data.get('specification_id')
        if specification_id:
            lead.specification = get_object_or_404(Specification, pk=specification_id)

        if transition.requires_specification and not lead.specification_id:
            raise serializers.ValidationError({
                'specification_id': 'Un cahier des charges doit être joint avant cette étape.',
            })

        previous_stage = lead.workflow_stage
        lead.workflow_stage = transition.target
        lead.save(update_fields=['workflow_stage', 'specification'])

        AuditLog.objects.create(
            user=request.user, action='WORKFLOW', entity_type='Lead', entity_id=str(lead.pk),
            details={
                'reference': lead.tracking_reference,
                'action': transition.action,
                'from': previous_stage,
                'to': transition.target,
            },
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        _notify_receiving_side(lead, transition, request.user)
        return Response(serialize_lead(lead, request.user))


class RejectLeadView(APIView):
    """Refuse une demande soumise — depuis n'importe quel département par
    lequel elle est passée (Marketing ou Technique), pas seulement celui
    qui la détient à l'instant du refus : décision du 10/09/2026, la
    demande a pu transiter par les deux avant d'être jugée non viable.

    Clôture via `status = PERDU` (réutilise l'exclusion déjà en place de
    SubmittedProjectListView) plutôt qu'un état de workflow_stage
    supplémentaire — un rejet est une fin, pas une étape de plus dans un
    parcours qui n'en a que pour avancer.

    Double confirmation exigée côté frontend, pas ici : le backend n'a
    aucun moyen de distinguer un deuxième clic d'un premier, c'est un choix
    d'UX, pas d'autorisation — voir components/admin/submitted-projects.tsx.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        lead = get_object_or_404(Lead, pk=pk)
        if not has_role(request.user, *MARKETING_SIDE, *TECHNIQUE_SIDE):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if lead.status == Lead.Status.PERDU:
            return Response({'detail': 'Cette demande est déjà rejetée.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            raise serializers.ValidationError({'reason': 'Un motif de rejet est obligatoire.'})

        lead.status = Lead.Status.PERDU
        lead.rejection_reason = reason
        lead.save(update_fields=['status', 'rejection_reason'])

        AuditLog.objects.create(
            user=request.user, action='WORKFLOW', entity_type='Lead', entity_id=str(lead.pk),
            details={'reference': lead.tracking_reference, 'action': 'rejeter', 'reason': reason},
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        label = lead.company_name or f'{lead.first_name} {lead.last_name}'.strip()
        # Rejet d'un projet soumis = action très critique (décision du
        # 10/09/2026) — e-mail aux deux départements en plus du push : ni
        # l'un ni l'autre ne doit apprendre le refus après coup.
        notify_roles(
            (*MARKETING_SIDE, *TECHNIQUE_SIDE),
            title=f'{lead.tracking_reference} — Demande rejetée',
            message=f'La demande « {label} » a été rejetée. Motif : {reason}',
            notification_type='GENERAL',
            link='/admin/marketing/leads',
            email=True,
            exclude=request.user,
        )

        return Response(serialize_lead(lead, request.user))


def _notify_receiving_side(lead, transition, actor) -> None:
    """Prévient le département qui reçoit la demande.

    Sans cela, la demande attend dans un écran que personne n'a de raison
    d'ouvrir — c'est exactement là que les dossiers dorment.
    """
    from core.models import User

    receiving_roles = (
        TECHNIQUE_SIDE if transition.target in {
            Lead.WorkflowStage.CHEZ_TECHNIQUE,
            Lead.WorkflowStage.VALIDE_CLIENT,
        } else MARKETING_SIDE
    )
    recipients = (
        User.objects.filter(is_active=True, roles__name__in=receiving_roles)
        .exclude(pk=actor.pk)
        .distinct()
    )
    label = lead.company_name or f'{lead.first_name} {lead.last_name}'.strip()
    for user in recipients:
        notify(
            user=user,
            title=f'{lead.tracking_reference} — {Lead.WorkflowStage(transition.target).label}',
            message=f'La demande « {label} » vous a été transmise.',
            notification_type='FOLLOW_UP',
            link='/admin/marketing/projets-soumis'
            if receiving_roles is MARKETING_SIDE
            else '/admin/technique/projets-soumis',
        )
