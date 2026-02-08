"""
Mixins for ViewSets providing reusable functionality.

This module contains mixins that can be used by multiple ViewSets to share
common functionality like message handling.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response


class MessageMixin:
    """
    Mixin providing common message endpoint functionality.
    
    ViewSets using this mixin must define:
    - message_model: The Django model class for messages
    - message_serializer_class: Serializer for message responses
    - message_create_serializer_class: Serializer for message creation (optional)
    - get_message_parent(pk): Method returning (parent_object, error_response)
    - get_message_queryset(parent): Method returning message queryset
    - check_message_access(parent, profile): Method returning (allowed, error_response)
    - check_can_send_message(parent): Method returning (allowed, error_response)
    - create_message(parent, profile, validated_data): Method creating and returning message
    
    Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9
    """
    
    # Class attributes to be overridden by subclasses
    message_model = None
    message_serializer_class = None
    message_create_serializer_class = None
    
    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        """
        List messages (GET) or send a message (POST).
        
        This action delegates to configurable hooks for:
        - Parent object lookup (get_message_parent)
        - Access control (check_message_access)
        - Message queryset (get_message_queryset)
        - Send permission (check_can_send_message)
        - Message creation (create_message)
        
        GET: Returns messages ordered by created_at ascending
        POST: Validates content, creates message, returns serialized response
        
        Error responses:
        - 404: Parent object not found
        - 403: User not authorized to access messages
        - 400: Invalid message data or cannot send
        """
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
        """
        List all messages for the parent object.
        
        Returns messages ordered by created_at ascending (oldest first).
        Requirement 1.5: Messages ordered by created_at ascending
        """
        # Get the message queryset from the hook
        messages = self.get_message_queryset(parent)
        
        # Serialize and return
        serializer = self.message_serializer_class(messages, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def _send_message(self, request, parent, profile):
        """
        Send a message to the parent object.
        
        Validates content, creates message, returns serialized response.
        Requirement 1.6: Validate content, create message, return serialized response
        """
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
        """
        Return (parent_object, error_response).
        
        Override in subclass to look up the parent object (match, plan, activity, friendship).
        Should return (parent, None) on success or (None, Response) on failure.
        
        Requirement 1.2: Customizable parent object lookup
        """
        raise NotImplementedError(
            "Subclasses must implement get_message_parent(pk) to look up the parent object"
        )
    
    def get_message_queryset(self, parent):
        """
        Return queryset of messages for parent.
        
        Override in subclass to return the appropriate queryset.
        Should return messages ordered by created_at ascending.
        
        Requirement 1.5: Messages ordered by created_at ascending
        """
        raise NotImplementedError(
            "Subclasses must implement get_message_queryset(parent) to return message queryset"
        )
    
    def check_message_access(self, parent, profile):
        """
        Return (allowed: bool, error_response).
        
        Override in subclass to check if the user has access to messages.
        Should return (True, None) if allowed or (False, Response) if not.
        
        Requirement 1.3: Customizable authorization check
        """
        raise NotImplementedError(
            "Subclasses must implement check_message_access(parent, profile) for authorization"
        )
    
    def check_can_send_message(self, parent):
        """
        Return (allowed: bool, error_response).
        
        Override in subclass to check if sending messages is allowed.
        Default implementation allows sending (returns True, None).
        
        Examples of when to disallow:
        - Match is inactive
        - Plan is cancelled or completed
        """
        return True, None
    
    def create_message(self, parent, profile, validated_data):
        """
        Create and return a message.
        
        Override in subclass to create the appropriate message type.
        
        Args:
            parent: The parent object (match, plan, activity, friendship)
            profile: The sender's profile
            validated_data: Validated data from the serializer
        
        Returns:
            The created message instance
        """
        raise NotImplementedError(
            "Subclasses must implement create_message(parent, profile, validated_data)"
        )
