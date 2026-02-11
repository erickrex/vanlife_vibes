"""
Custom permission classes for authorization
"""
from rest_framework import permissions
from core.models import GroupMembership, SessionSharedGroup


class IsGroupMember(permissions.BasePermission):
    """Check if user is a confirmed member of a group."""
    
    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Check if user is a confirmed member of the object's group"""
        # Get the group from the object
        group = None
        
        if hasattr(obj, 'group'):
            group = obj.group
        elif hasattr(obj, 'session') and hasattr(obj.session, 'group'):
            group = obj.session.group
        elif hasattr(obj, 'candidate') and hasattr(obj.candidate, 'session'):
            group = obj.candidate.session.group
        
        if not group:
            return False
        
        # Check if user is a confirmed member
        return GroupMembership.objects.filter(
            group=group,
            user=request.user,
            is_confirmed=True
        ).exists()


class IsSessionParticipant(permissions.BasePermission):
    """Check if user can participate in a session (owning or shared group member)."""
    
    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Check if user can access the session"""
        # Get the session from the object
        session = None
        
        if hasattr(obj, 'session'):
            session = obj.session
        elif hasattr(obj, 'candidate') and hasattr(obj.candidate, 'session'):
            session = obj.candidate.session
        elif hasattr(obj, 'id') and obj.__class__.__name__ == 'Session':
            session = obj
        
        if not session:
            return False
        
        # Check if user is a confirmed member of the owning group
        is_owner_member = GroupMembership.objects.filter(
            group=session.group,
            user=request.user,
            is_confirmed=True
        ).exists()
        
        if is_owner_member:
            return True
        
        # Check if user is a confirmed member of any shared group
        shared_group_ids = SessionSharedGroup.objects.filter(
            session=session
        ).values_list('group_id', flat=True)
        
        is_shared_member = GroupMembership.objects.filter(
            group_id__in=shared_group_ids,
            user=request.user,
            is_confirmed=True
        ).exists()
        
        return is_shared_member


class IsGroupAdmin(permissions.BasePermission):
    """Check if user is an admin of a group."""
    
    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Check if user is an admin of the object's group"""
        # Get the group from the object
        group = None
        
        if hasattr(obj, 'group'):
            group = obj.group
        elif hasattr(obj, 'session') and hasattr(obj.session, 'group'):
            group = obj.session.group
        elif hasattr(obj, 'candidate') and hasattr(obj.candidate, 'session'):
            group = obj.candidate.session.group
        
        if not group:
            return False
        
        # Check if user is a confirmed admin
        try:
            membership = GroupMembership.objects.get(
                group=group,
                user=request.user,
                is_confirmed=True
            )
            return membership.role == 'admin'
        except GroupMembership.DoesNotExist:
            return False
