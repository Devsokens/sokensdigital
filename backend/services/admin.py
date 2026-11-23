from django.contrib import admin

from services.models import Deliverable, ServiceOffer, ServicePeriod, Subscription

admin.site.register(ServiceOffer)
admin.site.register(Subscription)
admin.site.register(ServicePeriod)
admin.site.register(Deliverable)
