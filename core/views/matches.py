# core/views/matches.py
"""
ViewSets for person matches and direct messaging.

This module contains the PersonMatchViewSet which handles:
- Listing and retrieving matches
- Unmatching (deactivating matches)
- Sending messages and mini-cards
- Reporting users

Requirements: 2.1 (Backend File Organization)
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from core.models import (
    Profile,
    PersonMatch,
    DirectMessage,
    UserReport,
)
from core.serializers import (
    PersonMatchSerializer,
    DirectMessageSerializer,
    DirectMessageCreateSerializer,
    UserReportSerializer,
    UserReportCreateSerializer,
)
from .mixins import MessageMixin


class PersonMatchViewSet(MessageMixin, viewsets.GenericViewSet):
    """
    ViewSet for managing matches and chat between matched users.
    
    Provides endpoints for:
    - GET /matches/ - List user's matches
    - GET /matches/{id}/ - Get match details
    - DELETE /matches/{id}/ - Unmatch (set is_active=False)
    - GET /matches/{id}/messages/ - List messages in match
    - POST /matches/{id}/messages/ - Send a text message
    - POST /matches/{id}/messages/mini-card/ - Share a mini-card
    - POST /matches/{id}/messages/icebreaker/ - Send an icebreaker prompt
    
    Uses MessageMixin for the messages endpoint.
    """
    permission_classes = [IsAuthenticated]
    
    # MessageMixin configuration
    message_model = DirectMessage
    message_serializer_class = DirectMessageSerializer
    message_create_serializer_class = DirectMessageCreateSerializer
    
    def get_queryset(self):
        """
        Return matches where the current user is either user1 or user2.
        Only returns active matches by default.
        """
        try:
            user_profile = self.request.user.profile
        except Profile.DoesNotExist:
            return PersonMatch.objects.none()
        
        return PersonMatch.objects.filter(
            Q(user1=user_profile) | Q(user2=user_profile),
            is_active=True
        ).prefetch_related(
            'messages',
            'messages__sender',
        ).order_by('-matched_at')
    
    def _get_user_profile(self, request):
        """Get the current user's profile"""
        try:
            return request.user.profile
        except Profile.DoesNotExist:
            return None
    
    def _get_match_or_404(self, pk, user_profile):
        """
        Get a match by ID, ensuring the user is part of the match.
        Returns (match, None) on success or (None, error_response) on failure.
        """
        try:
            match = PersonMatch.objects.get(
                Q(user1=user_profile) | Q(user2=user_profile),
                pk=pk
            )
            return match, None
        except PersonMatch.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Match not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    # -------------------------------------------------------------------------
    # MessageMixin hook implementations
    # -------------------------------------------------------------------------
    
    def get_message_parent(self, pk):
        """
        Look up the PersonMatch by ID.
        
        Returns (match, None) on success or (None, error_response) on failure.
        """
        try:
            match = PersonMatch.objects.get(pk=pk)
            return match, None
        except PersonMatch.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Match not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def get_message_queryset(self, parent):
        """
        Return messages for this match, ordered by created_at ascending.
        """
        return DirectMessage.objects.filter(match=parent).order_by('created_at')

    def _list_messages(self, parent):
        """
        List messages and mark incoming unread messages as read for the
        current user so unread counters stay accurate.
        """
        try:
            profile = self.request.user.profile
        except Exception:
            profile = None

        if profile:
            DirectMessage.objects.filter(
                match=parent,
                is_read=False,
            ).exclude(
                sender=profile
            ).update(is_read=True)

        messages = self.get_message_queryset(parent)
        serializer = self.message_serializer_class(messages, many=True)

        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def check_message_access(self, parent, profile):
        """
        Verify the user is one of the two users in the match.
        
        Returns (True, None) if allowed, (False, error_response) if not.
        """
        if parent.user1 != profile and parent.user2 != profile:
            return False, Response({
                'status': 'error',
                'message': 'You are not part of this match'
            }, status=status.HTTP_403_FORBIDDEN)
        return True, None
    
    def check_can_send_message(self, parent):
        """
        Verify the match is active before allowing message sending.
        
        Returns (True, None) if allowed, (False, error_response) if not.
        """
        if not parent.is_active:
            return False, Response({
                'status': 'error',
                'message': 'Cannot send messages to an inactive match'
            }, status=status.HTTP_400_BAD_REQUEST)
        return True, None
    
    def create_message(self, parent, profile, validated_data):
        """
        Create a DirectMessage for this match.
        
        Args:
            parent: The PersonMatch instance
            profile: The sender's profile
            validated_data: Validated data from the serializer
        
        Returns:
            The created DirectMessage instance
        """
        message = DirectMessage.objects.create(
            match=parent,
            sender=profile,
            content=validated_data['content'],
            message_type=validated_data.get('message_type', 'text'),
            mini_card_data=validated_data.get('mini_card_data')
        )
        self._broadcast_message_created(message)
        return message

    def _broadcast_match_list_update(self, match):
        """Notify both users to refresh match list metadata."""
        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        for profile_id in (match.user1_id, match.user2_id):
            async_to_sync(channel_layer.group_send)(
                f"user_{profile_id}",
                {'type': 'match.list.update'}
            )

    def _broadcast_message_created(self, message):
        """
        Push a newly created message to the chat room and notify match lists.
        """
        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        message_payload = DirectMessageSerializer(message).data
        match = message.match
        match_id = str(match.id)

        async_to_sync(channel_layer.group_send)(
            f"match_{match_id}",
            {
                'type': 'chat.message',
                'match_id': match_id,
                'message': message_payload,
            }
        )

        self._broadcast_match_list_update(match)

        recipient_id = str(match.user2_id if message.sender_id == match.user1_id else match.user1_id)
        async_to_sync(channel_layer.group_send)(
            f"user_{recipient_id}",
            {
                'type': 'notification.new.message',
                'match_id': match_id,
                'message_id': str(message.id),
            }
        )
    
    # -------------------------------------------------------------------------
    # ViewSet actions
    # -------------------------------------------------------------------------
    
    def list(self, request):
        """
        List all matches for the authenticated user.
        
        GET /matches/
        
        Returns active matches where the user is either user1 or user2,
        ordered by most recent match first.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        queryset = self.get_queryset()
        
        serializer = PersonMatchSerializer(
            queryset, 
            many=True, 
            context={'request': request}
        )
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def retrieve(self, request, pk=None):
        """
        Get details of a specific match.
        
        GET /matches/{id}/
        
        Returns match details including both user profiles.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        serializer = PersonMatchSerializer(match, context={'request': request})
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, pk=None):
        """
        Unmatch - deactivate a match.
        
        DELETE /matches/{id}/
        
        Sets is_active=False on the match, preventing further messages.
        Does not delete the match record.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        # Check if already inactive
        if not match.is_active:
            return Response({
                'status': 'error',
                'message': 'Match is already inactive'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Deactivate the match
        match.is_active = False
        match.save()
        self._broadcast_match_list_update(match)
        
        return Response({
            'status': 'success',
            'message': 'Successfully unmatched'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='messages/mini-card')
    def send_mini_card(self, request, pk=None):
        """
        Share a mini-card in a match.
        
        POST /matches/{id}/messages/mini-card/
        
        Request body:
        {
            "current_location": "Austin, TX",  // optional
            "in_town_until": "2024-02-15",     // optional, YYYY-MM-DD format
            "meet_preference": "Coffee or hike"  // optional
        }
        
        At least one of the fields must be provided.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        # Check if match is active
        if not match.is_active:
            return Response({
                'status': 'error',
                'message': 'Cannot send messages to an inactive match'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate mini_card_data
        mini_card_data = request.data
        
        if not mini_card_data:
            return Response({
                'status': 'error',
                'message': 'Mini-card data is required',
                'errors': {
                    'mini_card_data': ['At least one of current_location, in_town_until, or meet_preference is required.']
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate using DirectMessageSerializer's validation
        temp_serializer = DirectMessageSerializer()
        try:
            validated_mini_card = temp_serializer.validate_mini_card_data(mini_card_data)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': 'Invalid mini-card data',
                'errors': {'mini_card_data': [str(e)]}
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Ensure at least one field is provided
        if not any(validated_mini_card.get(field) for field in ['current_location', 'in_town_until', 'meet_preference']):
            return Response({
                'status': 'error',
                'message': 'Invalid mini-card data',
                'errors': {
                    'mini_card_data': ['At least one of current_location, in_town_until, or meet_preference is required.']
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Build content summary for the mini-card message
        content_parts = []
        if validated_mini_card.get('current_location'):
            content_parts.append(f"📍 {validated_mini_card['current_location']}")
        if validated_mini_card.get('in_town_until'):
            content_parts.append(f"📅 Until {validated_mini_card['in_town_until']}")
        if validated_mini_card.get('meet_preference'):
            content_parts.append(f"☕ {validated_mini_card['meet_preference']}")
        
        content = " | ".join(content_parts) if content_parts else "Mini-card shared"
        
        # Create the mini-card message
        message = DirectMessage.objects.create(
            match=match,
            sender=user_profile,
            content=content,
            message_type='mini_card',
            mini_card_data=validated_mini_card
        )
        self._broadcast_message_created(message)
        
        # Return the created message
        response_serializer = DirectMessageSerializer(message)
        
        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='messages/icebreaker')
    def send_icebreaker(self, request, pk=None):
        """
        Send an icebreaker prompt in a match.

        POST /matches/{id}/messages/icebreaker/

        Request body:
        {
            "content": "Want to grab coffee while we're both in Austin?"
        }
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)

        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response

        if not match.is_active:
            return Response({
                'status': 'error',
                'message': 'Cannot send messages to an inactive match'
            }, status=status.HTTP_400_BAD_REQUEST)

        content = request.data.get('content')
        payload = {
            'content': content,
            'message_type': 'icebreaker',
        }
        serializer = DirectMessageCreateSerializer(data=payload)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid icebreaker message',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        message = self.create_message(match, user_profile, serializer.validated_data)
        response_serializer = DirectMessageSerializer(message)

        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='report')
    def report(self, request, pk=None):
        """
        Report the other user in a match for policy violations.
        
        POST /matches/{id}/report/
        
        Request body:
        {
            "reason": "harassment|spam|inappropriate_content|fake_profile|scam|other",
            "description": "Optional description of the issue (max 500 chars)"
        }
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        # Get the other user in the match
        other_user = match.get_other_user(user_profile)
        
        # Validate input
        serializer = UserReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid report data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the report
        report = UserReport.objects.create(
            reporter=user_profile,
            reported=other_user,
            reason=serializer.validated_data['reason'],
            description=serializer.validated_data.get('description', '')
        )
        
        response_serializer = UserReportSerializer(report)
        
        return Response({
            'status': 'success',
            'message': 'Report submitted successfully',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
