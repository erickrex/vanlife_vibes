from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import UserAccount, AnalyticsEvent


@admin.register(UserAccount)
class UserAccountAdmin(BaseUserAdmin):
    """Admin for custom user model"""
    list_display = ['username', 'email', 'is_staff', 'is_active', 'created_at']
    list_filter = ['is_staff', 'is_active', 'created_at']
    search_fields = ['username', 'email']
    ordering = ['-created_at']


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    """Admin listing for lightweight product analytics events."""
    list_display = ['event_name', 'user', 'profile', 'created_at']
    list_filter = ['event_name', 'created_at']
    search_fields = ['event_name', 'user__username', 'user__email', 'profile__display_name']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
