# core/serializers/events.py
"""
Event-related serializers for events, attendees, swipes, and messages.

This module contains serializers for:
- EventCreatedBySerializer: Minimal profile serializer for event created_by field
- EventAttendeeSerializer: Event attendee with profile information
- EventMessageSerializer: Event chat messages with sender profile
- EventSerializer: Event model with nested attendees and computed fields
- EventCreateSerializer: Creating events with validation
- EventUpdateSerializer: Updating events
- EventSwipeSerializer: Recording swipe direction on events
- EventMessageCreateSerializer: Simplified serializer for creating event messages

Requirements: REQ-5.1 through REQ-5.8 (API endpoints for events)
"""

from datetime import date

from rest_framework import serializers

from core.models import Event, EventAttendee, EventSwipe, EventMessage, Profile


class EventCreatedBySerializer(serializers.ModelSerializer):
    """
    Minimal profile serializer for event created_by field.
    Includes id, display_name, and avatar_url.
    """
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url']
        read_only_fields = ['id', 'display_name', 'avatar_url']


class EventAttendeeSerializer(serializers.ModelSerializer):
    """
    Serializer for EventAttendee model with profile information.
    """
    user_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = EventAttendee
        fields = ['id', 'event', 'user', 'user_profile', 'status', 'joined_at', 'confirmed_at']
        read_only_fields = ['id', 'joined_at', 'confirmed_at']
    
    def get_user_profile(self, obj):
        """Return basic profile info for the attendee"""
        return {
            'id': str(obj.user.id),
            'display_name': obj.user.display_name,
            'avatar_url': obj.user.avatar_url,
        }


class EventMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for EventMessage model with sender profile data.
    """
    sender_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = EventMessage
        fields = ['id', 'event', 'sender', 'sender_profile', 'content', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']
    
    def get_sender_profile(self, obj):
        """Return basic profile info for the sender"""
        return {
            'id': str(obj.sender.id),
            'display_name': obj.sender.display_name,
            'avatar_url': obj.sender.avatar_url,
        }
    
    def validate_content(self, value):
        """Validate message content length (max 500 chars)"""
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        if len(value) > 500:
            raise serializers.ValidationError(
                "Message content must be 500 characters or less."
            )
        return value


class EventSerializer(serializers.ModelSerializer):
    """
    Serializer for Event model with nested attendees and computed fields.
    
    Includes:
    - created_by as nested profile serializer
    - attendees list with profile information
    - attendee_count (excluding declined)
    - spots_remaining (for swipe mode: spots - 1 - likes_count)
    - user_has_swiped (for swipe mode: whether current user has swiped)
    - user_swipe_direction (for swipe mode: 'like', 'pass', or null)
    - is_attendee (whether current user is an attendee)
    """
    created_by = EventCreatedBySerializer(read_only=True)
    attendees = EventAttendeeSerializer(many=True, read_only=True)
    attendee_count = serializers.SerializerMethodField()
    spots_remaining = serializers.SerializerMethodField()
    user_has_swiped = serializers.SerializerMethodField()
    user_swipe_direction = serializers.SerializerMethodField()
    is_attendee = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = [
            'id',
            'created_by',
            'title',
            'event_type',
            'description',
            'image_url',
            'join_mode',
            'spots',
            'spots_remaining',
            'event_date',
            'time_window',
            'location',
            'status',
            'created_at',
            'attendees',
            'attendee_count',
            'user_has_swiped',
            'user_swipe_direction',
            'is_attendee',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'status']
    
    def get_attendee_count(self, obj):
        """Return count of attendees (joined or confirmed, excluding declined)"""
        return obj.attendees.exclude(status='declined').count()
    
    def get_spots_remaining(self, obj):
        """
        Calculate remaining spots for the event.
        
        For direct mode: spots - 1 (creator) - attendee_count
        For swipe mode: spots - 1 (creator) - likes_count
        
        Returns:
            int: Number of remaining spots available (minimum 0)
        """
        if obj.join_mode == 'swipe':
            # For swipe mode, count likes (right swipes)
            likes_count = obj.swipes.filter(is_like=True).count()
            remaining = obj.spots - 1 - likes_count
        else:
            # For direct mode, count attendees (excluding declined)
            attendee_count = obj.attendees.exclude(status='declined').count()
            remaining = obj.spots - 1 - attendee_count
        
        return max(0, remaining)
    
    def get_user_has_swiped(self, obj):
        """
        Return True if the current user has swiped on this event.
        Only relevant for swipe mode events.
        """
        if obj.join_mode != 'swipe':
            return None
        
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        
        try:
            user_profile = request.user.profile
            return obj.swipes.filter(user=user_profile).exists()
        except Profile.DoesNotExist:
            return False
    
    def get_user_swipe_direction(self, obj):
        """
        Return the current user's swipe direction on this event.
        Returns 'like', 'pass', or None.
        Only relevant for swipe mode events.
        """
        if obj.join_mode != 'swipe':
            return None
        
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        
        try:
            user_profile = request.user.profile
            swipe = obj.swipes.filter(user=user_profile).first()
            if swipe:
                return 'like' if swipe.is_like else 'pass'
            return None
        except Profile.DoesNotExist:
            return None
    
    def get_is_attendee(self, obj):
        """
        Return True if the current user is an attendee of this event.
        """
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        
        try:
            user_profile = request.user.profile
            return obj.attendees.filter(user=user_profile).exclude(status='declined').exists()
        except Profile.DoesNotExist:
            return False


class EventCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating events with validation.
    
    Validates:
    - title: not empty, max 100 chars
    - event_type: valid choice
    - join_mode: valid choice
    - spots: between 2 and 20
    - event_date: not in the past
    - time_window: valid choice
    - location: not empty, max 100 chars
    - description: max 500 chars
    """
    
    class Meta:
        model = Event
        fields = [
            'title',
            'event_type',
            'description',
            'image_url',
            'join_mode',
            'spots',
            'event_date',
            'time_window',
            'location',
        ]
    
    def validate_title(self, value):
        """Validate title is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Title must be 100 characters or less."
            )
        return value
    
    def validate_event_type(self, value):
        """Validate event_type is a valid choice"""
        valid_choices = [choice[0] for choice in Event.EVENT_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid event type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_join_mode(self, value):
        """Validate join_mode is a valid choice"""
        valid_choices = [choice[0] for choice in Event.JOIN_MODE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid join mode. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_spots(self, value):
        """Validate spots is between 2 and 20"""
        if value < 2:
            raise serializers.ValidationError(
                "Number of spots must be at least 2."
            )
        if value > 20:
            raise serializers.ValidationError(
                "Number of spots cannot exceed 20."
            )
        return value
    
    def validate_event_date(self, value):
        """Validate event_date is not in the past"""
        today = date.today()
        if value < today:
            raise serializers.ValidationError(
                "Event date cannot be in the past."
            )
        return value
    
    def validate_time_window(self, value):
        """Validate time_window is a valid choice"""
        valid_choices = [choice[0] for choice in Event.TIME_WINDOW_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid time window. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_location(self, value):
        """Validate location is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Location cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Location must be 100 characters or less."
            )
        return value
    
    def validate_description(self, value):
        """Validate description length if provided"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value
    
    def create(self, validated_data):
        """
        Create an Event with the current user as the creator.
        
        The status is automatically set to 'open' by the model default.
        """
        # Get the user's profile from the request context
        request = self.context.get('request')
        if request and hasattr(request.user, 'profile'):
            validated_data['created_by'] = request.user.profile
        
        return super().create(validated_data)


class EventUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating events.
    
    Allows updating title, description, time_window, location, and spots.
    Validates spots cannot be reduced below current attendee count.
    """
    
    class Meta:
        model = Event
        fields = ['title', 'description', 'time_window', 'location', 'spots', 'image_url']
    
    def validate_title(self, value):
        """Validate title is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Title must be 100 characters or less."
            )
        return value
    
    def validate_time_window(self, value):
        """Validate time_window is a valid choice"""
        valid_choices = [choice[0] for choice in Event.TIME_WINDOW_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid time window. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_location(self, value):
        """Validate location is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Location cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Location must be 100 characters or less."
            )
        return value
    
    def validate_spots(self, value):
        """
        Validate spots is between 2 and 20.
        Also ensure it's not less than current attendee count + 1 (for creator).
        """
        if value < 2:
            raise serializers.ValidationError(
                "Number of spots must be at least 2."
            )
        if value > 20:
            raise serializers.ValidationError(
                "Number of spots cannot exceed 20."
            )
        
        # Check if reducing below current attendee count + 1 (creator)
        if self.instance:
            current_count = self.instance.attendees.exclude(status='declined').count()
            # +1 for the creator who always occupies a spot
            min_spots = current_count + 1
            if value < min_spots:
                raise serializers.ValidationError(
                    f"Cannot reduce spots below {min_spots} (current attendees + creator)."
                )
        
        return value
    
    def validate_description(self, value):
        """Validate description length if provided"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value


class EventSwipeSerializer(serializers.ModelSerializer):
    """
    Serializer for EventSwipe model - recording swipe direction on events.
    
    Used for swipe mode events only.
    """
    
    class Meta:
        model = EventSwipe
        fields = [
            'id',
            'event',
            'user',
            'is_like',
            'swiped_at',
        ]
        read_only_fields = ['id', 'event', 'user', 'swiped_at']


class EventSwipeCreateSerializer(serializers.Serializer):
    """
    Simplified serializer for creating EventSwipes via API.
    Only requires is_like field, event and user are set by the view.
    """
    is_like = serializers.BooleanField()


class EventMessageCreateSerializer(serializers.Serializer):
    """
    Simplified serializer for creating EventMessages via API.
    Only requires content field, event and sender are set by the view.
    """
    content = serializers.CharField(max_length=500)
    
    def validate_content(self, value):
        """Validate message content is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value
