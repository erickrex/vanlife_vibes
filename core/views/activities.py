# core/views/activities.py
"""
ViewSets for activity management, swiping, and messaging.

This module contains the ActivityViewSet which handles:
- Creating, listing, and retrieving activities
- Swiping on activities (like/pass)
- Activity matching when spots are filled
- Activity messaging via MessageMixin

Requirements: 2.1 (Backend File Organization)
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from core.models import (
    Profile,
    Activity,
    ActivitySwipe,
    ActivityMatch,
    ActivityMessage,
)
from core.serializers import (
    ActivitySerializer,
    ActivityCreateSerializer,
    ActivitySwipeSerializer,
    ActivityMatchSerializer,
    ActivityMessageSerializer,
)
from .mixins import MessageMixin


class ActivityViewSet(MessageMixin, viewsets.ModelViewSet):
    """
    ViewSet for Activity CRUD operations and discovery.
    
    Provides endpoints for:
    - GET /api/v1/activities/ - List nearby open activities for swiping
    - POST /api/v1/activities/ - Create a new activity
    - GET /api/v1/activities/{id}/ - Get activity details
    - GET/POST /api/v1/activities/{id}/messages/ - List/send messages (via MessageMixin)
    
    The list action filters activities to show only:
    - status='open' (not matched or cancelled)
    - activity_date >= today (future activities only)
    - Not already swiped by the current user
    
    Results are ordered by activity_date, time_window.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ActivitySerializer
    
    # MessageMixin configuration
    message_model = ActivityMessage
    message_serializer_class = ActivityMessageSerializer
    message_create_serializer_class = ActivityMessageSerializer  # Same serializer for create
    
    def get_queryset(self):
        """
        Return activities filtered for the current user.
        
        For list action:
        - Only open activities (status='open')
        - Only future activities (activity_date >= today)
        - Exclude activities the user has already swiped on
        - Exclude activities created by the current user (can't swipe on own activity)
        
        For retrieve action:
        - Return all activities (no filtering)
        """
        from datetime import date
        
        # Get the current user's profile
        try:
            user_profile = self.request.user.profile
        except Profile.DoesNotExist:
            return Activity.objects.none()
        
        # For retrieve action, return all activities
        if self.action == 'retrieve':
            return Activity.objects.all()
        
        # For list action, apply filters
        today = date.today()
        
        # Get IDs of activities the user has already swiped on
        swiped_activity_ids = ActivitySwipe.objects.filter(
            user=user_profile
        ).values_list('activity_id', flat=True)
        
        # Filter activities:
        # - status='open'
        # - activity_date >= today
        # - Not already swiped by user
        # - Not created by the current user (can't swipe on own activity)
        queryset = Activity.objects.filter(
            status='open',
            activity_date__gte=today
        ).exclude(
            id__in=swiped_activity_ids
        ).exclude(
            created_by=user_profile
        ).order_by('activity_date', 'time_window')
        
        return queryset
    
    def get_serializer_class(self):
        """
        Return appropriate serializer class based on action.
        
        - create: ActivityCreateSerializer (with validation)
        - list/retrieve: ActivitySerializer (with computed fields)
        """
        if self.action == 'create':
            return ActivityCreateSerializer
        return ActivitySerializer
    
    def list(self, request):
        """
        List nearby open activities for swiping.
        
        GET /api/v1/activities/
        
        Returns activities filtered by:
        - status='open' (not matched or cancelled)
        - activity_date >= today (future activities only)
        - Not already swiped by the current user
        - Not created by the current user
        
        Ordered by activity_date, time_window.
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "title": "string",
                    "activity_type": "string",
                    "description": "string",
                    "image_url": "string|null",
                    "spots": int,
                    "spots_remaining": int,
                    "activity_date": "YYYY-MM-DD",
                    "time_window": "string",
                    "location": "string",
                    "status": "open",
                    "created_by": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "created_at": "ISO datetime"
                }
            ]
        }
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def create(self, request):
        """
        Create a new activity.
        
        POST /api/v1/activities/
        
        Request body:
        {
            "title": "string (required, max 100 chars)",
            "activity_type": "string (required, valid choice)",
            "description": "string (optional, max 500 chars)",
            "image_url": "string (optional, valid URL)",
            "spots": int (required, 1-20),
            "activity_date": "YYYY-MM-DD (required, today or future)",
            "time_window": "string (required, valid choice)",
            "location": "string (required, max 100 chars)"
        }
        
        The created_by field is automatically set to the current user's profile.
        The status field is automatically set to 'open'.
        
        Response format:
        {
            "status": "success",
            "data": { ... activity object ... }
        }
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate and create the activity
        serializer = ActivityCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            # The serializer's create method sets created_by from request context
            activity = serializer.save()
            
            # Return the created activity using the full serializer
            response_serializer = ActivitySerializer(activity)
            
            return Response({
                'status': 'success',
                'data': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'status': 'error',
            'message': 'Activity creation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def retrieve(self, request, pk=None):
        """
        Get activity details.
        
        GET /api/v1/activities/{id}/
        
        Returns the full activity object including:
        - All activity fields
        - Computed spots_remaining
        - Nested created_by profile data
        
        Response format:
        {
            "status": "success",
            "data": { ... activity object ... }
        }
        """
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Activity not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ActivitySerializer(activity)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='swipe')
    def swipe(self, request, pk=None):
        """
        Swipe on an activity (like or pass).
        
        POST /api/v1/activities/{id}/swipe/
        
        Request body:
        {
            "is_like": boolean (true = like/right swipe, false = pass/left swipe)
        }
        
        Matching Logic:
        - When the number of users who swiped right (liked) equals (spots - 1),
          an ActivityMatch is created
        - The creator automatically occupies 1 spot, so we need (spots - 1) likes
        - When match is created:
          - Activity status changes from 'open' to 'matched'
          - ActivityMatch is created with all attendees (creator + all likers)
          - Additional swipes are prevented
        
        Response format (no match):
        {
            "status": "success",
            "data": {
                "swipe": { ... swipe object ... },
                "match": null
            }
        }
        
        Response format (match created):
        {
            "status": "success",
            "data": {
                "swipe": { ... swipe object ... },
                "match": { ... match object with attendees ... }
            }
        }
        
        Error responses:
        - 404: Activity not found
        - 400: Activity is no longer accepting swipes (already matched)
        - 400: You have already swiped on this activity
        - 400: You cannot swipe on your own activity
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the activity
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Activity not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if activity is still open
        if activity.status != 'open':
            return Response({
                'status': 'error',
                'message': 'Activity is no longer accepting swipes'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is trying to swipe on their own activity
        if activity.created_by == user_profile:
            return Response({
                'status': 'error',
                'message': 'You cannot swipe on your own activity'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user has already swiped on this activity
        if ActivitySwipe.objects.filter(activity=activity, user=user_profile).exists():
            return Response({
                'status': 'error',
                'message': 'You have already swiped on this activity'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate the request data
        serializer = ActivitySwipeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid swipe data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        is_like = serializer.validated_data['is_like']
        
        # Use transaction to ensure atomicity of swipe + potential match creation
        with transaction.atomic():
            # Create the ActivitySwipe record
            swipe_record = ActivitySwipe.objects.create(
                activity=activity,
                user=user_profile,
                is_like=is_like
            )
            
            match_data = None
            
            # Check if match threshold is reached (only for likes)
            # Creator is auto-attendee, so we need (spots - 1) additional likes
            if is_like:
                likes_count = ActivitySwipe.objects.filter(
                    activity=activity,
                    is_like=True
                ).count()
                
                # spots - 1 because creator occupies one spot
                required_likes = activity.spots - 1
                
                if likes_count >= required_likes:
                    # Create ActivityMatch
                    activity_match = ActivityMatch.objects.create(
                        activity=activity
                    )
                    
                    # Add attendees: creator + all likers (Requirements 7.3, 7.6)
                    # First add the creator
                    activity_match.attendees.add(activity.created_by)
                    
                    # Then add all users who liked the activity
                    likers = ActivitySwipe.objects.filter(
                        activity=activity,
                        is_like=True
                    ).values_list('user', flat=True)
                    
                    for liker_id in likers:
                        activity_match.attendees.add(liker_id)
                    
                    # Update activity status to 'matched'
                    activity.status = 'matched'
                    activity.save()
                    
                    # Serialize the match for response
                    match_data = ActivityMatchSerializer(activity_match).data
        
        # Serialize the swipe for response
        swipe_data = ActivitySwipeSerializer(swipe_record).data
        
        return Response({
            'status': 'success',
            'data': {
                'swipe': swipe_data,
                'match': match_data
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-activities')
    def my_activities(self, request):
        """
        List activities created by the current user.
        
        GET /api/v1/activities/my-activities/
        
        Returns all activities where created_by is the current user's profile,
        ordered by created_at descending (newest first).
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "title": "string",
                    "activity_type": "string",
                    "description": "string",
                    "image_url": "string|null",
                    "spots": int,
                    "spots_remaining": int,
                    "activity_date": "YYYY-MM-DD",
                    "time_window": "string",
                    "location": "string",
                    "status": "string",
                    "created_by": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "created_at": "ISO datetime"
                }
            ]
        }
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all activities created by the current user, ordered by created_at descending
        activities = Activity.objects.filter(
            created_by=user_profile
        ).order_by('-created_at')
        
        serializer = ActivitySerializer(activities, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='my-matches')
    def my_matches(self, request):
        """
        List activities the current user has matched on.
        
        GET /api/v1/activities/my-matches/
        
        Returns all ActivityMatch records where the current user is an attendee,
        ordered by matched_at descending (newest first).
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "activity": {
                        "id": "uuid",
                        "title": "string",
                        "activity_type": "string",
                        "description": "string",
                        "image_url": "string|null",
                        "spots": int,
                        "spots_remaining": int,
                        "activity_date": "YYYY-MM-DD",
                        "time_window": "string",
                        "location": "string",
                        "status": "matched",
                        "created_by": { ... },
                        "created_at": "ISO datetime"
                    },
                    "attendees": [
                        {
                            "id": "uuid",
                            "display_name": "string",
                            "avatar_url": "string|null"
                        }
                    ],
                    "matched_at": "ISO datetime"
                }
            ]
        }
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all ActivityMatch records where the current user is an attendee
        # ordered by matched_at descending (newest first)
        matches = ActivityMatch.objects.filter(
            attendees=user_profile
        ).order_by('-matched_at')
        
        serializer = ActivityMatchSerializer(matches, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # MessageMixin hook implementations
    # -------------------------------------------------------------------------
    
    def get_message_parent(self, pk):
        """
        Look up Activity by pk, then find the ActivityMatch.
        
        Returns (activity_match, None) on success or (None, error_response) on failure.
        
        Note: For activities, the "parent" for messages is the ActivityMatch,
        but we look it up via the Activity pk from the URL.
        """
        # Get the activity
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Activity not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if activity has a match
        try:
            activity_match = ActivityMatch.objects.get(activity=activity)
        except ActivityMatch.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Activity has not been matched yet'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return activity_match, None
    
    def get_message_queryset(self, parent):
        """
        Return messages for the ActivityMatch ordered by created_at ascending.
        
        Args:
            parent: The ActivityMatch instance
        """
        return ActivityMessage.objects.filter(
            activity_match=parent
        ).order_by('created_at')
    
    def check_message_access(self, parent, profile):
        """
        Verify user is an attendee of the ActivityMatch.
        
        Args:
            parent: The ActivityMatch instance
            profile: The current user's profile
        
        Returns:
            (True, None) if user is an attendee
            (False, error_response) if user is not an attendee
        """
        if not parent.attendees.filter(id=profile.id).exists():
            return False, Response({
                'status': 'error',
                'message': 'You are not an attendee of this activity'
            }, status=status.HTTP_403_FORBIDDEN)
        
        return True, None
    
    def create_message(self, parent, profile, validated_data):
        """
        Create an ActivityMessage for the match.
        
        Args:
            parent: The ActivityMatch instance
            profile: The sender's profile
            validated_data: Validated data containing 'content'
        
        Returns:
            The created ActivityMessage instance
        """
        return ActivityMessage.objects.create(
            activity_match=parent,
            sender=profile,
            content=validated_data['content']
        )
