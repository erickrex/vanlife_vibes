# core/views/events.py
"""
ViewSets for event management.

This module contains the EventViewSet which handles:
- Creating, listing, and retrieving events
- Updating and cancelling events (creator only)
- Join, leave, and confirm actions for direct mode events
- Swipe action for swipe mode events
- Messages endpoint for event group chat
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from django.db import transaction

from core.models import (
    Profile,
    Event,
    EventAttendee,
    EventSwipe,
    EventMessage,
)
from core.serializers.events import (
    EventSerializer,
    EventCreateSerializer,
    EventUpdateSerializer,
    EventAttendeeSerializer,
    EventSwipeSerializer,
    EventSwipeCreateSerializer,
    EventMessageSerializer,
    EventMessageCreateSerializer,
)
from .mixins import MessageMixin


class EventViewSet(MessageMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing unified events (direct-join and swipe-to-join).
    
    Provides endpoints for:
    - GET /events/ - List available events
    - POST /events/ - Create a new event
    - GET /events/{id}/ - Get event details
    - PATCH /events/{id}/ - Update event (creator only)
    - DELETE /events/{id}/ - Cancel event (creator only)
    - POST /events/{id}/join/ - Join event (direct mode only)
    - POST /events/{id}/leave/ - Leave event
    - POST /events/{id}/confirm/ - Confirm attendance (direct mode only)
    - POST /events/{id}/swipe/ - Swipe on event (swipe mode only)
    - GET /events/{id}/messages/ - List messages in event chat
    - POST /events/{id}/messages/ - Send a message to event chat
    
    Uses MessageMixin for the messages endpoint.
    """
    permission_classes = [IsAuthenticated]
    
    # MessageMixin configuration
    message_model = EventMessage
    message_serializer_class = EventMessageSerializer
    message_create_serializer_class = EventMessageCreateSerializer
    
    def get_queryset(self):
        """
        Return events filtered by query parameters.
        
        Query parameters:
        - join_mode: 'direct' or 'swipe'
        - event_type: Filter by event type
        - location: Partial match on location
        - from_date: Events on or after date (YYYY-MM-DD)
        - to_date: Events on or before date (YYYY-MM-DD)
        - status: Filter by status (default: exclude cancelled and completed)
        """
        queryset = Event.objects.all()
        
        # Filter by status (default: show open, full, and matched events)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        else:
            # By default, exclude cancelled and completed events
            queryset = queryset.exclude(status__in=['cancelled', 'completed'])
        
        # Filter by join_mode
        join_mode = self.request.query_params.get('join_mode')
        if join_mode:
            queryset = queryset.filter(join_mode=join_mode)
        
        # Filter by event_type
        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        
        # Filter by location (partial match)
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(location__icontains=location)
        
        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(event_date__gte=from_date)
        
        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(event_date__lte=to_date)
        
        return queryset.order_by('event_date', 'time_window')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return EventCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return EventUpdateSerializer
        return EventSerializer
    
    def get_serializer_context(self):
        """Add request to serializer context for user-specific fields"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def _get_user_profile(self, request):
        """Get the current user's profile"""
        try:
            return request.user.profile
        except Profile.DoesNotExist:
            return None
    
    # -------------------------------------------------------------------------
    # MessageMixin hook implementations
    # -------------------------------------------------------------------------
    
    def get_message_parent(self, pk):
        """
        Look up the Event by ID.
        
        Returns (event, None) on success or (None, error_response) on failure.
        """
        try:
            event = Event.objects.get(pk=pk)
            return event, None
        except Event.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def get_message_queryset(self, parent):
        """
        Return messages for this event, ordered by created_at ascending.
        """
        return EventMessage.objects.filter(event=parent).order_by('created_at')
    
    def check_message_access(self, parent, profile):
        """
        Verify the user is an attendee of the event (not declined).
        
        For swipe mode events, also verify the event is matched.
        
        Returns (True, None) if allowed, (False, error_response) if not.
        """
        # For swipe mode events, only matched events allow messaging
        if parent.join_mode == 'swipe' and parent.status != 'matched':
            return False, Response({
                'status': 'error',
                'message': 'Messages are only available for matched events'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Check if user is an attendee (not declined)
        attendee = EventAttendee.objects.filter(
            event=parent,
            user=profile
        ).exclude(status='declined').first()
        
        if not attendee:
            return False, Response({
                'status': 'error',
                'message': 'Only event attendees can access the group chat'
            }, status=status.HTTP_403_FORBIDDEN)
        return True, None
    
    def check_can_send_message(self, parent):
        """
        Verify the event is not cancelled or completed before allowing message sending.
        
        Returns (True, None) if allowed, (False, error_response) if not.
        """
        if parent.status == 'cancelled':
            return False, Response({
                'status': 'error',
                'message': 'Cannot send messages to a cancelled event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if parent.status == 'completed':
            return False, Response({
                'status': 'error',
                'message': 'Cannot send messages to a completed event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return True, None
    
    def create_message(self, parent, profile, validated_data):
        """
        Create an EventMessage for this event.
        
        Args:
            parent: The Event instance
            profile: The sender's profile
            validated_data: Validated data from the serializer
        
        Returns:
            The created EventMessage instance
        """
        return EventMessage.objects.create(
            event=parent,
            sender=profile,
            content=validated_data['content']
        )
    
    # -------------------------------------------------------------------------
    # ViewSet actions
    # -------------------------------------------------------------------------
    
    def list(self, request):
        """
        List available events.
        
        GET /events/
        
        Query parameters:
        - join_mode: 'direct' or 'swipe'
        - event_type: Filter by event type
        - location: Filter by location (partial match)
        - from_date: Filter events on or after this date (YYYY-MM-DD)
        - to_date: Filter events on or before this date (YYYY-MM-DD)
        - status: Filter by status (open, full, matched, cancelled, completed)
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        queryset = self.get_queryset()
        serializer = EventSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context()
        )
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def retrieve(self, request, pk=None):
        """
        Get event details.
        
        GET /events/{id}/
        
        Returns event details including attendees and computed fields.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = EventSerializer(event, context=self.get_serializer_context())
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def create(self, request):
        """
        Create a new event.
        
        POST /events/
        
        Request body:
        {
            "title": "Morning Coffee",
            "event_type": "coffee",
            "join_mode": "direct",
            "event_date": "2024-02-15",
            "time_window": "morning",
            "location": "Austin, TX",
            "description": "Optional description",
            "spots": 6,
            "image_url": "Optional URL"
        }
        
        The creator is automatically added as an attendee with 'confirmed' status
        for direct mode events.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = EventCreateSerializer(
            data=request.data,
            context=self.get_serializer_context()
        )
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid event data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the event
        event = Event.objects.create(
            created_by=user_profile,
            **serializer.validated_data
        )
        
        # For direct mode events, add creator as confirmed attendee
        if event.join_mode == 'direct':
            EventAttendee.objects.create(
                event=event,
                user=user_profile,
                status='confirmed',
                confirmed_at=timezone.now()
            )
        
        response_serializer = EventSerializer(
            event,
            context=self.get_serializer_context()
        )
        
        return Response({
            'status': 'success',
            'message': 'Event created successfully',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, pk=None):
        """
        Update an event (full update).
        
        PUT /events/{id}/
        
        Only the event creator can update the event.
        """
        return self._update_event(request, pk, partial=False)
    
    def partial_update(self, request, pk=None):
        """
        Partially update an event.
        
        PATCH /events/{id}/
        
        Only the event creator can update the event.
        Updatable fields: title, description, time_window, location, spots, image_url
        """
        return self._update_event(request, pk, partial=True)
    
    def _update_event(self, request, pk, partial=False):
        """Helper method for updating events"""
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Only creator can update
        if event.created_by != user_profile:
            return Response({
                'status': 'error',
                'message': 'Only the event creator can update this event'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Cannot update cancelled or completed events
        if event.status in ['cancelled', 'completed']:
            return Response({
                'status': 'error',
                'message': f'Cannot update a {event.status} event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = EventUpdateSerializer(
            event,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context()
        )
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid event data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        response_serializer = EventSerializer(
            event,
            context=self.get_serializer_context()
        )
        
        return Response({
            'status': 'success',
            'message': 'Event updated successfully',
            'data': response_serializer.data
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, pk=None):
        """
        Cancel an event.
        
        DELETE /events/{id}/
        
        Only the event creator can cancel the event.
        Sets status to 'cancelled' rather than deleting the record.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Only creator can cancel
        if event.created_by != user_profile:
            return Response({
                'status': 'error',
                'message': 'Only the event creator can cancel this event'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Cannot cancel already cancelled or completed events
        if event.status == 'cancelled':
            return Response({
                'status': 'error',
                'message': 'Event is already cancelled'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if event.status == 'completed':
            return Response({
                'status': 'error',
                'message': 'Cannot cancel a completed event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Cancel the event
        event.status = 'cancelled'
        event.save()
        
        return Response({
            'status': 'success',
            'message': 'Event cancelled successfully'
        }, status=status.HTTP_200_OK)
    
    # -------------------------------------------------------------------------
    # Direct mode actions: join, leave, confirm
    # -------------------------------------------------------------------------
    
    @action(detail=True, methods=['post'], url_path='join')
    def join(self, request, pk=None):
        """
        Join an event (direct mode only).
        
        POST /events/{id}/join/
        
        Adds the current user as an attendee with 'joined' status.
        
        Validations:
        - Event must be direct mode (join_mode='direct')
        - Event must be open (not full, cancelled, or completed)
        - User cannot already be an attendee
        - Event cannot be at max capacity
        
        When joining causes the event to reach max capacity, status changes to 'full'.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check join mode - only direct mode events can be joined directly
        if event.join_mode != 'direct':
            return Response({
                'status': 'error',
                'message': 'This event uses swipe-to-join. Use the swipe endpoint instead.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check event status
        if event.status == 'cancelled':
            return Response({
                'status': 'error',
                'message': 'Cannot join a cancelled event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if event.status == 'completed':
            return Response({
                'status': 'error',
                'message': 'Cannot join a completed event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if event.status == 'full':
            return Response({
                'status': 'error',
                'message': 'Event is full'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is already an attendee
        existing_attendee = EventAttendee.objects.filter(
            event=event,
            user=user_profile
        ).first()
        
        if existing_attendee:
            if existing_attendee.status == 'declined':
                # Re-join if previously declined
                existing_attendee.status = 'joined'
                existing_attendee.save()
            else:
                return Response({
                    'status': 'error',
                    'message': 'You have already joined this event'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Check capacity before adding
            current_count = event.attendees.exclude(status='declined').count()
            if current_count >= event.spots:
                # Update event status to full
                event.status = 'full'
                event.save()
                return Response({
                    'status': 'error',
                    'message': 'Event is full'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create new attendee
            existing_attendee = EventAttendee.objects.create(
                event=event,
                user=user_profile,
                status='joined'
            )
        
        # Check if event is now full after joining
        current_count = event.attendees.exclude(status='declined').count()
        if current_count >= event.spots and event.status == 'open':
            event.status = 'full'
            event.save()
        
        serializer = EventAttendeeSerializer(existing_attendee)
        
        return Response({
            'status': 'success',
            'message': 'Successfully joined the event',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='leave')
    def leave(self, request, pk=None):
        """
        Leave an event.
        
        POST /events/{id}/leave/
        
        Sets the attendee status to 'declined'.
        The event creator cannot leave their own event.
        
        If leaving causes the event to go below max capacity, status changes back to 'open'.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Creator cannot leave their own event
        if event.created_by == user_profile:
            return Response({
                'status': 'error',
                'message': 'Event creator cannot leave their own event. Cancel the event instead.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is an attendee
        try:
            attendee = EventAttendee.objects.get(
                event=event,
                user=user_profile
            )
        except EventAttendee.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'You are not an attendee of this event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already declined
        if attendee.status == 'declined':
            return Response({
                'status': 'error',
                'message': 'You have already left this event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set status to declined
        attendee.status = 'declined'
        attendee.save()
        
        # If event was full (direct mode), check if it should be reopened
        if event.status == 'full' and event.join_mode == 'direct':
            current_count = event.attendees.exclude(status='declined').count()
            if current_count < event.spots:
                event.status = 'open'
                event.save()
        
        return Response({
            'status': 'success',
            'message': 'Successfully left the event'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        """
        Confirm attendance for an event (direct mode only).
        
        POST /events/{id}/confirm/
        
        Changes attendee status from 'joined' to 'confirmed'.
        Only attendees who have joined can confirm.
        Sets the confirmed_at timestamp.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check join mode - only direct mode events support confirm
        if event.join_mode != 'direct':
            return Response({
                'status': 'error',
                'message': 'Confirm is only available for direct-join events'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check event status
        if event.status == 'cancelled':
            return Response({
                'status': 'error',
                'message': 'Cannot confirm attendance for a cancelled event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if event.status == 'completed':
            return Response({
                'status': 'error',
                'message': 'Cannot confirm attendance for a completed event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is an attendee
        try:
            attendee = EventAttendee.objects.get(
                event=event,
                user=user_profile
            )
        except EventAttendee.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'You must join the event before confirming attendance'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check current status
        if attendee.status == 'declined':
            return Response({
                'status': 'error',
                'message': 'You have left this event. Join again before confirming.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if attendee.status == 'confirmed':
            return Response({
                'status': 'error',
                'message': 'You have already confirmed attendance'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Confirm attendance
        attendee.status = 'confirmed'
        attendee.confirmed_at = timezone.now()
        attendee.save()
        
        serializer = EventAttendeeSerializer(attendee)
        
        return Response({
            'status': 'success',
            'message': 'Attendance confirmed',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # Swipe mode actions: swipe
    # -------------------------------------------------------------------------
    
    @action(detail=True, methods=['post'], url_path='swipe')
    def swipe(self, request, pk=None):
        """
        Swipe on an event (swipe mode only).
        
        POST /events/{id}/swipe/
        
        Request body:
        {
            "is_like": boolean (true = like/right swipe, false = pass/left swipe)
        }
        
        Matching Logic:
        - When the number of users who swiped right (liked) equals (spots - 1),
          the event is matched
        - The creator automatically occupies 1 spot, so we need (spots - 1) likes
        - When match is created:
          - Event status changes from 'open' to 'matched'
          - All likers are added as EventAttendees with status='confirmed'
          - The creator is also added as an EventAttendee with status='confirmed'
          - Additional swipes are prevented
        
        Response format (no match):
        {
            "status": "success",
            "data": {
                "swipe": { ... swipe object ... },
                "matched": false
            }
        }
        
        Response format (match created):
        {
            "status": "success",
            "data": {
                "swipe": { ... swipe object ... },
                "matched": true,
                "event": { ... event object with attendees ... }
            }
        }
        
        Error responses:
        - 404: Event not found
        - 400: Event is not a swipe mode event
        - 400: Event is no longer accepting swipes (already matched/cancelled/completed)
        - 400: You have already swiped on this event
        - 400: You cannot swipe on your own event
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the event
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Event not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check join mode - only swipe mode events can be swiped on
        if event.join_mode != 'swipe':
            return Response({
                'status': 'error',
                'message': 'This event uses direct-join. Use the join endpoint instead.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if event is still open
        if event.status != 'open':
            return Response({
                'status': 'error',
                'message': 'Event is no longer accepting swipes'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is trying to swipe on their own event
        if event.created_by == user_profile:
            return Response({
                'status': 'error',
                'message': 'You cannot swipe on your own event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user has already swiped on this event
        if EventSwipe.objects.filter(event=event, user=user_profile).exists():
            return Response({
                'status': 'error',
                'message': 'You have already swiped on this event'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate the request data
        serializer = EventSwipeCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid swipe data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        is_like = serializer.validated_data['is_like']
        
        # Use transaction to ensure atomicity of swipe + potential match creation
        with transaction.atomic():
            # Create the EventSwipe record
            swipe_record = EventSwipe.objects.create(
                event=event,
                user=user_profile,
                is_like=is_like
            )
            
            matched = False
            event_data = None
            
            # Check if match threshold is reached (only for likes)
            # Creator is auto-attendee, so we need (spots - 1) additional likes
            if is_like:
                likes_count = EventSwipe.objects.filter(
                    event=event,
                    is_like=True
                ).count()
                
                # spots - 1 because creator occupies one spot
                required_likes = event.spots - 1
                
                if likes_count >= required_likes:
                    matched = True
                    
                    # Add creator as confirmed attendee
                    EventAttendee.objects.get_or_create(
                        event=event,
                        user=event.created_by,
                        defaults={
                            'status': 'confirmed',
                            'confirmed_at': timezone.now()
                        }
                    )
                    
                    # Add all users who liked the event as confirmed attendees
                    likers = EventSwipe.objects.filter(
                        event=event,
                        is_like=True
                    ).select_related('user')
                    
                    for liker_swipe in likers:
                        EventAttendee.objects.get_or_create(
                            event=event,
                            user=liker_swipe.user,
                            defaults={
                                'status': 'confirmed',
                                'confirmed_at': timezone.now()
                            }
                        )
                    
                    # Update event status to 'matched'
                    event.status = 'matched'
                    event.save()
                    
                    # Serialize the event for response
                    event_data = EventSerializer(
                        event,
                        context=self.get_serializer_context()
                    ).data
        
        # Serialize the swipe for response
        swipe_data = EventSwipeSerializer(swipe_record).data
        
        response_data = {
            'swipe': swipe_data,
            'matched': matched
        }
        
        if matched and event_data:
            response_data['event'] = event_data
        
        return Response({
            'status': 'success',
            'data': response_data
        }, status=status.HTTP_201_CREATED)

    # -------------------------------------------------------------------------
    # User-specific list actions: my-events, my-matches
    # -------------------------------------------------------------------------

    @action(detail=False, methods=['get'], url_path='my-events')
    def my_events(self, request):
        """
        Get events the user created or is attending.

        GET /events/my-events/

        Query parameters:
        - join_mode: 'direct' or 'swipe' (optional filter)
        - include_past: 'true' to include cancelled/completed events (default: false)

        Returns events where:
        - User is the creator (created_by), OR
        - User is an attendee with status != 'declined'

        By default, excludes cancelled and completed events.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)

        from django.db.models import Q

        # Get events where user is creator OR is an attendee (not declined)
        queryset = Event.objects.filter(
            Q(created_by=user_profile) |
            Q(attendees__user=user_profile, attendees__status__in=['joined', 'confirmed'])
        ).distinct()

        # Filter by join_mode if specified
        join_mode = request.query_params.get('join_mode')
        if join_mode:
            queryset = queryset.filter(join_mode=join_mode)

        # By default, exclude cancelled and completed events
        include_past = request.query_params.get('include_past', 'false').lower() == 'true'
        if not include_past:
            queryset = queryset.exclude(status__in=['cancelled', 'completed'])

        queryset = queryset.order_by('event_date', 'time_window')

        serializer = EventSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context()
        )

        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='my-matches')
    def my_matches(self, request):
        """
        Get swipe mode events where the user is an attendee and the event is matched.

        GET /events/my-matches/

        Returns swipe mode events where:
        - Event join_mode is 'swipe'
        - Event status is 'matched'
        - User is a confirmed attendee (either as creator or through swiping)

        This endpoint is specifically for swipe-to-join events that have reached
        their match threshold and the user is part of the matched group.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)

        from django.db.models import Q

        # Get matched swipe events where user is a confirmed attendee
        # (either as creator or through swiping)
        queryset = Event.objects.filter(
            join_mode='swipe',
            status='matched'
        ).filter(
            Q(created_by=user_profile) |
            Q(attendees__user=user_profile, attendees__status='confirmed')
        ).distinct().order_by('-created_at')

        serializer = EventSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context()
        )

        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


