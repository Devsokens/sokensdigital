from django.contrib import admin
from .models import ChannelMetadata, ChannelParticipant

admin.site.register(ChannelMetadata)
admin.site.register(ChannelParticipant)
