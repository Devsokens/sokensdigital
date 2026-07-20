from django.urls import path
from rest_framework.routers import DefaultRouter

from marketing.views import (
    BlogPostViewSet,
    LeadViewSet,
    PublicBlogDetailView,
    PublicBlogListView,
    PublicLeadCreateView,
    SocialPostViewSet,
    marketing_dashboard,
)

router = DefaultRouter()
router.register('leads', LeadViewSet, basename='lead')
router.register('cms/blog', BlogPostViewSet, basename='blog-post')
router.register('social-posts', SocialPostViewSet, basename='social-post')

urlpatterns = [
    path('dashboard/', marketing_dashboard, name='marketing-dashboard'),
] + router.urls

public_urlpatterns = [
    path('leads/', PublicLeadCreateView.as_view(), name='public-lead-create'),
    path('cms/blog/', PublicBlogListView.as_view(), name='public-blog-list'),
    path('cms/blog/<slug:slug>/', PublicBlogDetailView.as_view(), name='public-blog-detail'),
]
