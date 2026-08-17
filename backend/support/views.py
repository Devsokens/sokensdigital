from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_SUPPORT_CLIENT
from core.permissions import has_role
from marketing.ratelimit import get_client_ip, is_rate_limited
from support.models import FAQEntry, SupportTicket, TicketMessage
from support.serializers import (
    FAQPublicSerializer,
    FAQSerializer,
    SupportTicketListSerializer,
    SupportTicketPublicCreateSerializer,
    SupportTicketPublicDetailSerializer,
    SupportTicketPublicReplySerializer,
    SupportTicketSerializer,
    TicketMessageSerializer,
)

SUPPORT_ROLES = (ROLE_SUPPORT_CLIENT, ROLE_ADMIN, ROLE_SUPER_ADMIN)

PUBLIC_TICKET_RATE_LIMIT = 5  # per IP
PUBLIC_TICKET_RATE_WINDOW = 60  # seconds


class IsSupportStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, *SUPPORT_ROLES)


# --- Public (no auth) ------------------------------------------------------

@extend_schema(
    tags=['Support Client'],
    summary='List published FAQ entries (public site)',
    description='No auth. Only PUBLIC-audience, published entries — the internal knowledge base stays staff-only.',
)
class PublicFAQListView(generics.ListAPIView):
    queryset = FAQEntry.objects.filter(audience=FAQEntry.Audience.PUBLIC, is_published=True)
    serializer_class = FAQPublicSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []


@extend_schema(
    tags=['Support Client'],
    summary='Open a support ticket from the public chat widget',
    description='No auth. Rate-limited to 5 requests/minute/IP. Returns access_token, the '
    "visitor's only credential to poll/reply to their own ticket afterwards.",
    request=SupportTicketPublicCreateSerializer,
    responses={201: SupportTicketPublicCreateSerializer, 429: None},
)
class PublicTicketCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = get_client_ip(request)
        if is_rate_limited(f'ticketrate:{ip}', PUBLIC_TICKET_RATE_LIMIT, PUBLIC_TICKET_RATE_WINDOW):
            return Response(
                {'detail': 'Trop de requêtes. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = SupportTicketPublicCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return Response(SupportTicketPublicCreateSerializer(ticket).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['Support Client'],
    summary='Poll a ticket by its access token (public)',
    description='No auth — the access_token itself is the credential, same pattern as '
    'quote tracking_token. Used by the chat widget to poll for staff replies.',
)
class PublicTicketDetailView(generics.RetrieveAPIView):
    # messages__author (pas juste messages) : TicketMessageSerializer.author
    # traverse toujours la FK, un ticket avec 10 messages sans ce prefetch
    # = 10 requêtes en plus par affichage.
    queryset = SupportTicket.objects.prefetch_related('messages__author')
    serializer_class = SupportTicketPublicDetailSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    lookup_field = 'access_token'
    lookup_url_kwarg = 'access_token'


@extend_schema(
    tags=['Support Client'],
    summary='Reply to a ticket by its access token (public)',
    description='No auth — the access_token is the credential. Rate-limited to 5 requests/minute/IP.',
    request=SupportTicketPublicReplySerializer,
    responses={201: TicketMessageSerializer},
)
class PublicTicketReplyView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, access_token):
        ip = get_client_ip(request)
        if is_rate_limited(f'ticketreplyrate:{ip}', PUBLIC_TICKET_RATE_LIMIT, PUBLIC_TICKET_RATE_WINDOW):
            return Response(
                {'detail': 'Trop de requêtes. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        ticket = get_object_or_404(SupportTicket, access_token=access_token)
        serializer = SupportTicketPublicReplySerializer(data=request.data, context={'ticket': ticket})
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        return Response(TicketMessageSerializer(message).data, status=status.HTTP_201_CREATED)


# --- Staff (authenticated) --------------------------------------------------

@extend_schema_view(
    list=extend_schema(tags=['Support Client'], summary='List FAQ / knowledge base entries'),
    create=extend_schema(tags=['Support Client'], summary='Create a FAQ / knowledge base entry'),
    retrieve=extend_schema(tags=['Support Client'], summary='Get a FAQ entry'),
    update=extend_schema(tags=['Support Client'], summary='Update a FAQ entry'),
    partial_update=extend_schema(tags=['Support Client'], summary='Update a FAQ entry'),
    destroy=extend_schema(tags=['Support Client'], summary='Delete a FAQ entry'),
)
class FAQViewSet(viewsets.ModelViewSet):
    queryset = FAQEntry.objects.all()
    serializer_class = FAQSerializer
    permission_classes = [IsSupportStaff]


@extend_schema_view(
    list=extend_schema(tags=['Support Client'], summary='List support tickets'),
    retrieve=extend_schema(tags=['Support Client'], summary='Get a support ticket'),
    partial_update=extend_schema(tags=['Support Client'], summary='Update ticket status/assignee'),
)
class SupportTicketViewSet(viewsets.ModelViewSet):
    queryset = SupportTicket.objects.select_related('assigned_to').prefetch_related('messages__author')
    permission_classes = [IsSupportStaff]
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'list':
            return SupportTicketListSerializer
        return SupportTicketSerializer

    @extend_schema(
        tags=['Support Client'],
        summary='Reply to a ticket (staff)',
        request=SupportTicketPublicReplySerializer,
        responses={201: TicketMessageSerializer},
    )
    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        ticket = self.get_object()
        serializer = SupportTicketPublicReplySerializer(data=request.data, context={'ticket': ticket})
        serializer.is_valid(raise_exception=True)
        message = TicketMessage.objects.create(
            ticket=ticket, sender_type=TicketMessage.SenderType.STAFF, author=request.user,
            body=serializer.validated_data['message'],
        )
        if ticket.status == SupportTicket.Status.OUVERT:
            ticket.status = SupportTicket.Status.EN_COURS
            ticket.save(update_fields=['status'])
        return Response(TicketMessageSerializer(message).data, status=status.HTTP_201_CREATED)
