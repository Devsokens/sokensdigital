from django.contrib import admin

from marketing.models import BlogPost, Lead, PageSection, Quote, QuoteLine, SocialPost


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


@admin.register(PageSection)
class PageSectionAdmin(admin.ModelAdmin):
    list_display = ('page', 'section_key', 'order', 'is_active', 'title')
    list_filter = ('page', 'is_active')
    ordering = ('page', 'order')


class QuoteLineInline(admin.TabularInline):
    model = QuoteLine
    extra = 0


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ('quote_number', 'status', 'created_by', 'total_ttc', 'created_at')
    list_filter = ('status',)
    search_fields = ('quote_number',)
    inlines = [QuoteLineInline]
