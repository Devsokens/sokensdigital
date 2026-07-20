from rest_framework.routers import DefaultRouter

from finance.views import DisbursementRequestViewSet

router = DefaultRouter()
router.register('disbursement-requests', DisbursementRequestViewSet, basename='disbursement-request')
urlpatterns = router.urls
