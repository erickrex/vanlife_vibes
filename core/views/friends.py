# core/views/friends.py
"""
ViewSets for friend requests and friendships.

This module contains the FriendViewSet which handles:
- Listing friendships
- Sending, accepting, and declining friend requests
- Removing friendships
- Friend messaging via MessageMixin

Requirements: 2.1 (Backend File Organization)
"""

from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q

from core.models import (
    Profile,
    FriendRequest,
    Friendship,
    FriendMessage,
)
from core.serializers import (
    FriendRequestSerializer,
    FriendshipSerializer,
    FriendMessageSerializer,
)
from .mixins import MessageMixin


class FriendViewSet(MessageMixin, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """
    ViewSet for friend requests and friendships.
    
    Provides endpoints for:
    - GET /api/v1/friends/ - List all friendships for the current user
    - POST /api/v1/friends/request/ - Send a friend request
    - GET /api/v1/friends/requests/ - List pending friend requests
    - POST /api/v1/friends/requests/{id}/accept/ - Accept a friend request
    - POST /api/v1/friends/requests/{id}/decline/ - Decline a friend request
    - GET /api/v1/friends/{id}/messages/ - Get messages in a friendship chat (via MessageMixin)
    - POST /api/v1/friends/{id}/messages/ - Send a message to a friend (via MessageMixin)
    - DELETE /api/v1/friends/{id}/ - Remove a friendship
    """
    permission_classes = [IsAuthenticated]
    serializer_class = FriendshipSerializer
    
    # MessageMixin configuration
    message_model = FriendMessage
    message_serializer_class = FriendMessageSerializer
    message_create_serializer_class = FriendMessageSerializer  # Same serializer for create
    
    def get_queryset(self):
        """
        Return friendships where the current user is either user1 or user2.
        Ordered by created_at descending (newest first).
        """
        try:
            profile = self.request.user.profile
        except Profile.DoesNotExist:
            return Friendship.objects.none()
        
        return Friendship.objects.filter(
            Q(user1=profile) | Q(user2=profile)
        ).order_by('-created_at')
    
    def list(self, request):
        """
        List all friendships for the current user.
        
        GET /api/v1/friends/
        
        Returns all Friendship records where the current user is either user1 or user2.
        Uses FriendshipSerializer which includes the computed 'friend' field showing
        the other user's profile data.
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "friend": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "created_at": "ISO datetime"
                },
                ...
            ]
        }
        
        Results are ordered by created_at descending (newest first).
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all friendships where the current user is either user1 or user2
        friendships = self.get_queryset()
        
        # Serialize with request context so FriendshipSerializer can compute the 'friend' field
        serializer = FriendshipSerializer(friendships, many=True, context={'request': request})
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='request')
    def request(self, request):
        """
        Send a friend request to another user.
        
        POST /api/v1/friends/request/
        
        Request body:
        {
            "to_user_id": "uuid (required) - UUID of the user to send request to"
        }
        
        Validations:
        - Cannot send request to yourself
        - No existing pending request between the users
        - Not already friends with the target user
        - Target user must exist
        
        Response format:
        {
            "status": "success",
            "data": {
                "id": "uuid",
                "from_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "to_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "status": "pending",
                "created_at": "ISO datetime",
                "responded_at": null
            }
        }
        
        Error responses:
        - 400: You cannot send a friend request to yourself
        - 400: Friend request already pending
        - 400: You are already friends with this user
        - 404: User not found
        """
        # Get the current user's profile
        try:
            from_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Sender must have looking_for_friends enabled
        if not from_profile.looking_for_friends:
            return Response({
                'status': 'error',
                'message': 'You must enable friend discovery to send friend requests'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate to_user_id is provided
        to_user_id = request.data.get('to_user_id')
        if not to_user_id:
            return Response({
                'status': 'error',
                'message': 'to_user_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the target user's profile
        try:
            to_profile = Profile.objects.get(id=to_user_id)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Target must have looking_for_friends enabled
        if not to_profile.looking_for_friends:
            return Response({
                'status': 'error',
                'message': 'This user is not accepting friend requests'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate: Cannot send request to yourself
        if from_profile.id == to_profile.id:
            return Response({
                'status': 'error',
                'message': 'You cannot send a friend request to yourself'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate: No existing pending request (in either direction)
        existing_pending = FriendRequest.objects.filter(
            Q(from_user=from_profile, to_user=to_profile, status='pending') |
            Q(from_user=to_profile, to_user=from_profile, status='pending')
        ).exists()

        if existing_pending:
            return Response({
                'status': 'error',
                'message': 'Friend request already pending'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate: Not already friends
        # Friendship model enforces user1.id < user2.id, so we need to check both orderings
        # by querying with Q objects
        user1_id, user2_id = sorted([from_profile.id, to_profile.id])
        already_friends = Friendship.objects.filter(
            user1_id=user1_id,
            user2_id=user2_id
        ).exists()
        
        if already_friends:
            return Response({
                'status': 'error',
                'message': 'You are already friends with this user'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # If a prior request from this user exists (declined/accepted), reuse it
        existing_request = FriendRequest.objects.filter(
            from_user=from_profile,
            to_user=to_profile
        ).first()
        if existing_request:
            existing_request.status = 'pending'
            existing_request.responded_at = None
            existing_request.save(update_fields=['status', 'responded_at'])
            friend_request = existing_request
        else:
            # Create the friend request with status='pending'
            friend_request = FriendRequest.objects.create(
                from_user=from_profile,
                to_user=to_profile,
                status='pending'
            )
        
        # Serialize and return the created request
        serializer = FriendRequestSerializer(friend_request)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK if existing_request else status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='requests')
    def requests(self, request):
        """
        List pending friend requests (sent and received).
        
        GET /api/v1/friends/requests/
        
        Returns all pending friend requests where the current user is either
        the sender or recipient, grouped into two lists.
        
        Response format:
        {
            "status": "success",
            "data": {
                "sent": [
                    {
                        "id": "uuid",
                        "from_user": { ... },
                        "to_user": { ... },
                        "status": "pending",
                        "created_at": "ISO datetime",
                        "responded_at": null
                    },
                    ...
                ],
                "received": [
                    {
                        "id": "uuid",
                        "from_user": { ... },
                        "to_user": { ... },
                        "status": "pending",
                        "created_at": "ISO datetime",
                        "responded_at": null
                    },
                    ...
                ]
            }
        }
        
        Both lists are ordered by created_at descending (newest first).
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get sent requests (from_user=current user, status='pending')
        sent_requests = FriendRequest.objects.filter(
            from_user=profile,
            status='pending'
        ).order_by('-created_at')
        
        # Get received requests (to_user=current user, status='pending')
        received_requests = FriendRequest.objects.filter(
            to_user=profile,
            status='pending'
        ).order_by('-created_at')
        
        # Serialize both lists
        sent_serializer = FriendRequestSerializer(sent_requests, many=True)
        received_serializer = FriendRequestSerializer(received_requests, many=True)
        
        return Response({
            'status': 'success',
            'data': {
                'sent': sent_serializer.data,
                'received': received_serializer.data
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='requests/(?P<request_id>[^/.]+)/accept')
    def accept(self, request, request_id=None):
        """
        Accept a friend request.
        
        POST /api/v1/friends/requests/{id}/accept/
        
        Accepts a pending friend request sent to the current user.
        Creates a Friendship record between the two users.
        
        Validations:
        - Request must exist
        - Current user must be the recipient (to_user)
        - Request must be pending (not already responded to)
        
        Response format:
        {
            "status": "success",
            "data": {
                "id": "uuid",
                "from_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "to_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "status": "accepted",
                "created_at": "ISO datetime",
                "responded_at": "ISO datetime"
            }
        }
        
        Error responses:
        - 404: Friend request not found
        - 403: You can only accept requests sent to you
        - 400: This request has already been responded to
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the friend request by ID
        try:
            friend_request = FriendRequest.objects.get(pk=request_id)
        except FriendRequest.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Friend request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Current user must be the recipient (to_user)
        if friend_request.to_user != profile:
            return Response({
                'status': 'error',
                'message': 'You can only accept requests sent to you'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Validate: Request must be pending
        if friend_request.status != 'pending':
            return Response({
                'status': 'error',
                'message': 'This request has already been responded to'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update request status to 'accepted' and set responded_at
        friend_request.status = 'accepted'
        friend_request.responded_at = timezone.now()
        friend_request.save()
        
        # Create Friendship record between the two users
        # The Friendship model's save() method automatically handles user1 < user2 ordering
        Friendship.objects.create(
            user1=friend_request.from_user,
            user2=friend_request.to_user
        )
        
        # Return the updated request
        serializer = FriendRequestSerializer(friend_request)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='requests/(?P<request_id>[^/.]+)/decline')
    def decline(self, request, request_id=None):
        """
        Decline a friend request.
        
        POST /api/v1/friends/requests/{id}/decline/
        
        Declines a pending friend request sent to the current user.
        Does NOT create a Friendship record.
        
        Validations:
        - Request must exist
        - Current user must be the recipient (to_user)
        - Request must be pending (not already responded to)
        
        Response format:
        {
            "status": "success",
            "data": {
                "id": "uuid",
                "from_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "to_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "status": "declined",
                "created_at": "ISO datetime",
                "responded_at": "ISO datetime"
            }
        }
        
        Error responses:
        - 404: Friend request not found
        - 403: You can only decline requests sent to you
        - 400: This request has already been responded to
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the friend request by ID
        try:
            friend_request = FriendRequest.objects.get(pk=request_id)
        except FriendRequest.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Friend request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Current user must be the recipient (to_user)
        if friend_request.to_user != profile:
            return Response({
                'status': 'error',
                'message': 'You can only decline requests sent to you'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Validate: Request must be pending
        if friend_request.status != 'pending':
            return Response({
                'status': 'error',
                'message': 'This request has already been responded to'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update request status to 'declined' and set responded_at
        friend_request.status = 'declined'
        friend_request.responded_at = timezone.now()
        friend_request.save()
        
        # Return the updated request (no Friendship created for decline)
        serializer = FriendRequestSerializer(friend_request)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """
        Remove a friendship.
        
        DELETE /api/v1/friends/{id}/
        
        Deletes a friendship between the current user and another user.
        Only users who are part of the friendship can delete it.
        This also deletes all associated FriendMessage records (via CASCADE).
        
        Validations:
        - Friendship must exist
        - Current user must be either user1 or user2 in the friendship
        
        Response format:
        {
            "status": "success",
            "message": "Friendship removed successfully"
        }
        
        Error responses:
        - 404: Friendship not found
        - 403: You are not part of this friendship
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the friendship by ID
        try:
            friendship = Friendship.objects.get(pk=pk)
        except Friendship.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Friendship not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Current user must be part of the friendship (either user1 or user2)
        if friendship.user1 != profile and friendship.user2 != profile:
            return Response({
                'status': 'error',
                'message': 'You are not part of this friendship'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Delete the friendship (FriendMessages will be deleted via CASCADE)
        friendship.delete()
        
        return Response({
            'status': 'success',
            'message': 'Friendship removed successfully'
        }, status=status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # MessageMixin hook implementations
    # -------------------------------------------------------------------------
    
    def get_message_parent(self, pk):
        """
        Look up Friendship by pk.
        
        Returns (friendship, None) on success or (None, error_response) on failure.
        """
        try:
            friendship = Friendship.objects.get(pk=pk)
            return friendship, None
        except Friendship.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Friendship not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def get_message_queryset(self, parent):
        """
        Return messages for the Friendship ordered by created_at ascending.
        
        Args:
            parent: The Friendship instance
        """
        return FriendMessage.objects.filter(
            friendship=parent
        ).order_by('created_at')
    
    def check_message_access(self, parent, profile):
        """
        Verify user is user1 or user2 in the Friendship.
        
        Args:
            parent: The Friendship instance
            profile: The current user's profile
        
        Returns:
            (True, None) if user is part of the friendship
            (False, error_response) if user is not part of the friendship
        """
        if parent.user1 != profile and parent.user2 != profile:
            return False, Response({
                'status': 'error',
                'message': 'You must be friends to send messages'
            }, status=status.HTTP_403_FORBIDDEN)
        
        return True, None
    
    def create_message(self, parent, profile, validated_data):
        """
        Create a FriendMessage for the friendship.
        
        Args:
            parent: The Friendship instance
            profile: The sender's profile
            validated_data: Validated data containing 'content'
        
        Returns:
            The created FriendMessage instance
        """
        return FriendMessage.objects.create(
            friendship=parent,
            sender=profile,
            content=validated_data['content']
        )
