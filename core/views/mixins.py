"""Reusable ViewSet mixins."""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response


class MessageMixin:
    """Mixin providing GET/POST messages endpoint for parent models."""
    
    # Class attributes to be overridden by subclasses
    message_model = None
    message_serializer_class = None
    message_create_serializer_class = None
    
    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        """GET: List messages. POST: Send a message."""
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the parent object (match, plan, activity, friendship)
        parent, error_response = self.get_message_parent(pk)
        if error_response:
            return error_response
        
        # Check if user has access to messages
        allowed, error_response = self.check_message_access(parent, profile)
        if not allowed:
            return error_response
        
        if request.method == 'GET':
            return self._list_messages(parent)
        else:  # POST
            return self._send_message(request, parent, profile)
    
    def _list_messages(self, parent):
        """List all messages for the parent object, oldest first."""
        # Get the message queryset from the hook
        messages = self.get_message_queryset(parent)
        
        # Serialize and return
        serializer = self.message_serializer_class(messages, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def _send_message(self, request, parent, profile):
        """Validate and create a message."""
        # Check if sending is allowed (e.g., match is active, plan not cancelled)
        allowed, error_response = self.check_can_send_message(parent)
        if not allowed:
            return error_response
        
        # Use create serializer if provided, otherwise use the response serializer
        create_serializer_class = (
            self.message_create_serializer_class or self.message_serializer_class
        )
        
        # Validate input
        serializer = create_serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid message data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the message using the hook
        message = self.create_message(parent, profile, serializer.validated_data)
        
        # Return the created message using the response serializer
        response_serializer = self.message_serializer_class(message)
        
        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    def get_message_parent(self, pk):
        """Return (parent_object, error_response). Override in subclass."""
        raise NotImplementedError(
            "Subclasses must implement get_message_parent(pk) to look up the parent object"
        )
    
    def get_message_queryset(self, parent):
        """Return queryset of messages for parent. Override in subclass."""
        raise NotImplementedError(
            "Subclasses must implement get_message_queryset(parent) to return message queryset"
        )
    
    def check_message_access(self, parent, profile):
        """Return (allowed: bool, error_response). Override in subclass."""
        raise NotImplementedError(
            "Subclasses must implement check_message_access(parent, profile) for authorization"
        )
    
    def check_can_send_message(self, parent):
        """Return (allowed: bool, error_response). Default: allow."""
        return True, None
    
    def create_message(self, parent, profile, validated_data):
        """Create and return a message. Override in subclass."""
        raise NotImplementedError(
            "Subclasses must implement create_message(parent, profile, validated_data)"
        )
