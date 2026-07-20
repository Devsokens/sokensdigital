from django.contrib import admin

from marketing.models import BlogPost, Lead, SocialPost


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'company_name', 'email', 'status', 'assigned_to', 'created_at')
    list_filter = ('status', 'source')
    search_fields = ('first_name', 'last_name', 'company_name', 'email')


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'author', 'published_at', 'created_at')
    list_filter = ('status',)
    search_fields = ('title', 'slug')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(SocialPost)
class SocialPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'platform', 'status', 'scheduled_at', 'author', 'created_at')
    list_filter = ('status', 'platform')
    search_fields = ('title', 'content')
