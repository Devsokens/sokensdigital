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
    PublicQuoteAcceptView,
    PublicQuoteTrackView,
    PublicShowcaseProjectDetailView,
    PublicShowcaseProjectListView,
    PublicSiteSettingsView,
    QuoteSettingsView,
    QuoteViewSet,
    ShowcaseProjectViewSet,
    SiteSettingsView,
    SocialMediaCredentialsView,
    SocialPostViewSet,
    SpecificationViewSet,
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
router.register('specifications', SpecificationViewSet, basename='specification')

urlpatterns = [
    path('dashboard/', marketing_dashboard, name='marketing-dashboard'),
    path('cms/upload-image/', ImageUploadView.as_view(), name='upload-image'),
    path('cms/upload-video/', VideoUploadView.as_view(), name='upload-video'),
    path('cms/site-settings/', SiteSettingsView.as_view(), name='site-settings'),
    path('quote-settings/', QuoteSettingsView.as_view(), name='quote-settings'),
    path('social-media-credentials/', SocialMediaCredentialsView.as_view(), name='social-media-credentials'),
] + router.urls

public_urlpatterns = [
    path('leads/', PublicLeadCreateView.as_view(), name='public-lead-create'),
    path('cms/blog/', PublicBlogListView.as_view(), name='public-blog-list'),
    path('cms/blog/<slug:slug>/', PublicBlogDetailView.as_view(), name='public-blog-detail'),
    path('cms/page-sections/', PublicPageSectionListView.as_view(), name='public-page-sections'),
    path('showcase-projects/', PublicShowcaseProjectListView.as_view(), name='public-showcase-project-list'),
    path('showcase-projects/<slug:slug>/', PublicShowcaseProjectDetailView.as_view(), name='public-showcase-project-detail'),
    path('quotes/track/<uuid:tracking_token>/', PublicQuoteTrackView.as_view(), name='public-quote-track'),
    path('quotes/track/<uuid:tracking_token>/accept/', PublicQuoteAcceptView.as_view(), name='public-quote-accept'),
    path('site-settings/', PublicSiteSettingsView.as_view(), name='public-site-settings'),
]
