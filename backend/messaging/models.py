"""
Couche de synchronisation PostgreSQL du module Messagerie (cahier des
charges §5.1.A). Le flux de messages lui-même (contenu, réactions, pièces
jointes) vit exclusivement dans Firestore — voir core/firestore_client.py
et §5.1.B/§5.3 du cahier. Ces deux modèles ne font QUE gouverner qui a le
droit d'être dans quel salon côté Django (RBAC, appartenance département/
projet) ; ils ne dupliquent jamais le contenu des messages.

NOTE ARCHITECTURE (à trancher avec l'équipe, pas résolu unilatéralement
ici) : un système de salons Firestore ad-hoc existe déjà (core/views.py
pour les salons Département, projects/views.py pour les salons Projet),
sans table de sync PostgreSQL — il appelle directement
core.firestore_client.upsert_chat_room()/set_chat_room_members(). Ce
module ajoute la couche de gouvernance PostgreSQL prévue par le cahier des
charges SANS toucher à ce système existant (pour ne pas casser un flux
déjà en prod). Les deux coexistent tant qu'une décision de consolidation
n'est pas prise — voir le rapport final pour le détail.

Autre point à trancher : project_id pointe ici vers technique.Project
(département Technique, développé dans cette session) — il existe AUSSI
un modèle Project distinct dans l'app `projects` (pré-existante, main),
non lié à celui-ci. Les salons de projet créés via projects/views.py ne
sont pas visibles ici tant que ce doublon n'est pas résolu.
"""
import uuid

from django.db import models

from core.models import LoggedModel, Department, User
from technique.models import Project


class ChannelMetadata(LoggedModel):
    class ChannelType(models.TextChoices):
        DEPARTMENT = 'DEPARTMENT', 'Département'
        PROJECT = 'PROJECT', 'Projet'
        DIRECT = 'DIRECT', 'Direct'
        GROUP = 'GROUP', 'Groupe'

    # Clé unique indexée pointant vers le document Firestore
    # conversations/{firestore_conversation_id} — jamais None une fois le
    # signal de création Firestore exécuté (voir tasks.sync_channel_to_firestore).
    firestore_conversation_id = models.CharField(max_length=255, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=ChannelType.choices)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, null=True, blank=True, related_name='channels',
    )
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, null=True, blank=True, related_name='channels',
    )
    is_private = models.BooleanField(default=False)

    class Meta(LoggedModel.Meta):
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['type']),
        ]

    def __str__(self):
        return f'{self.get_type_display()} — {self.name}'


class ChannelParticipant(LoggedModel):
    channel = models.ForeignKey(ChannelMetadata, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='channel_participations')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta(LoggedModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=['channel', 'user'], name='unique_channel_participant'),
        ]

    def __str__(self):
        return f'{self.user} in {self.channel}'
