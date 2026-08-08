from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ChannelMetadataViewSet, ChannelParticipantViewSet

router = DefaultRouter()
router.register(r'channels', ChannelMetadataViewSet, basename='channel')

urlpatterns = [
    path('', include(router.urls)),
    path(
        'channels/<uuid:channel_pk>/participants/',
        ChannelParticipantViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='channel-participants-list',
    ),
    path(
        'channels/<uuid:channel_pk>/participants/<uuid:pk>/',
        ChannelParticipantViewSet.as_view({'delete': 'destroy'}),
        name='channel-participants-detail',
    ),
]
