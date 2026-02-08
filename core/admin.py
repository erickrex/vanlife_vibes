from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import UserAccount


@admin.register(UserAccount)
class UserAccountAdmin(BaseUserAdmin):
    """Admin for custom user model"""
    list_display = ['username', 'email', 'is_staff', 'is_active', 'created_at']
    list_filter = ['is_staff', 'is_active', 'created_at']
    search_fields = ['username', 'email']
    ordering = ['-created_at']
