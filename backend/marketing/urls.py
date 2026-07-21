from django.urls import path
from rest_framework.routers import DefaultRouter

from marketing.views import (
    BlogPostViewSet,
    ImageUploadView,
    LeadViewSet,
    PageSectionViewSet,
    PublicBlogDetailView,
    PublicBlogListView,
    PublicLeadCreateView,
    PublicPageSectionListView,
    PublicQuoteTrackView,
    PublicShowcaseProjectDetailView,
    PublicShowcaseProjectListView,
    QuoteViewSet,
    ShowcaseProjectViewSet,
    SocialPostViewSet,
    VideoUploadView,
    marketing_dashboard,
)

router = DefaultRouter()
router.register('leads', LeadViewSet, basename='lead')
router.register('cms/blog', BlogPostViewSet, basename='blog-post')
router.register('cms/page-sections', PageSectionViewSet, basename='page-section')
router.register('cms/showcase-projects', ShowcaseProjectViewSet, basename='showcase-project')
router.register('social-posts', SocialPostViewSet, basename='social-post')
router.register('quotes', QuoteViewSet, basename='quote')

urlpatterns = [
    path('dashboard/', marketing_dashboard, name='marketing-dashboard'),
    path('cms/upload-image/', ImageUploadView.as_view(), name='upload-image'),
    path('cms/upload-video/', VideoUploadView.as_view(), name='upload-video'),
] + router.urls

public_urlpatterns = [
    path('leads/', PublicLeadCreateView.as_view(), name='public-lead-create'),
    path('cms/blog/', PublicBlogListView.as_view(), name='public-blog-list'),
    path('cms/blog/<slug:slug>/', PublicBlogDetailView.as_view(), name='public-blog-detail'),
    path('cms/page-sections/', PublicPageSectionListView.as_view(), name='public-page-sections'),
    path('showcase-projects/', PublicShowcaseProjectListView.as_view(), name='public-showcase-project-list'),
    path('showcase-projects/<slug:slug>/', PublicShowcaseProjectDetailView.as_view(), name='public-showcase-project-detail'),
    path('quotes/track/<uuid:tracking_token>/', PublicQuoteTrackView.as_view(), name='public-quote-track'),
]
