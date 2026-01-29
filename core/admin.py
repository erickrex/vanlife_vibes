from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    UserAccount, Group, GroupMembership, Session, SessionSharedGroup,
    Candidate, Swipe, Match,
    Taxonomy, Term, CandidateTerm,
    Question, AnswerOption, UserAnswer
)


@admin.register(UserAccount)
class UserAccountAdmin(BaseUserAdmin):
    """Admin for custom user model"""
    list_display = ['username', 'email', 'is_staff', 'is_active', 'created_at']
    list_filter = ['is_staff', 'is_active', 'created_at']
    search_fields = ['username', 'email']
    ordering = ['-created_at']


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description']
    raw_id_fields = ['created_by']


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'group', 'role', 'is_confirmed', 'invited_at']
    list_filter = ['role', 'is_confirmed', 'invited_at']
    search_fields = ['user__username', 'group__name']
    raw_id_fields = ['user', 'group']


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'group', 'status', 'candidate_type', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['title', 'description']
    raw_id_fields = ['group']


@admin.register(SessionSharedGroup)
class SessionSharedGroupAdmin(admin.ModelAdmin):
    list_display = ['session', 'group', 'shared_at']
    list_filter = ['shared_at']
    raw_id_fields = ['session', 'group']


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ['label', 'session', 'created_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['label', 'external_ref']
    raw_id_fields = ['session', 'created_by']


@admin.register(Swipe)
class SwipeAdmin(admin.ModelAdmin):
    list_display = ['user', 'candidate', 'is_like', 'swiped_at']
    list_filter = ['is_like', 'swiped_at']
    raw_id_fields = ['user', 'candidate']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['session', 'candidate', 'matched_at']
    list_filter = ['matched_at']
    raw_id_fields = ['session', 'candidate']


@admin.register(Taxonomy)
class TaxonomyAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name', 'description']


@admin.register(Term)
class TermAdmin(admin.ModelAdmin):
    list_display = ['value', 'taxonomy']
    list_filter = ['taxonomy']
    search_fields = ['value']
    raw_id_fields = ['taxonomy']


@admin.register(CandidateTerm)
class CandidateTermAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'term']
    raw_id_fields = ['candidate', 'term']


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['text', 'scope', 'candidate_type', 'created_at']
    list_filter = ['scope', 'created_at']
    search_fields = ['text']


@admin.register(AnswerOption)
class AnswerOptionAdmin(admin.ModelAdmin):
    list_display = ['text', 'question', 'order_num']
    list_filter = ['question']
    raw_id_fields = ['question']


@admin.register(UserAnswer)
class UserAnswerAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'session', 'answered_at']
    list_filter = ['answered_at']
    raw_id_fields = ['user', 'question', 'session', 'answer_option']
