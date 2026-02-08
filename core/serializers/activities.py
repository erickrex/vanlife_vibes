# core/serializers/activities.py
"""
Activity-related serializers for activities, swipes, matches, and messages.

This module contains serializers for:
- ActivityCreatedBySerializer: Minimal profile serializer for activity created_by field
- ActivitySerializer: Activity model with computed spots_remaining field
- ActivityCreateSerializer: Creating activities with validation
- ActivitySwipeSerializer: Recording swipe direction on activities
- ActivityMatchSerializer: Activity match with nested activity and attendees
- ActivityMessageSerializer: Chat messages in matched activity groups

Requirements: 2.2 (Backend File Organization)
"""

from rest_framework import serializers

from core.models import Profile, Activity, ActivitySwipe, ActivityMatch, ActivityMessage


class ActivityCreatedBySerializer(serializers.ModelSerializer):
    """
    Minimal profile serializer for activity created_by field.
    Includes id, display_name, and avatar_url.
    """
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url']
        read_only_fields = ['id', 'display_name', 'avatar_url']


class ActivitySerializer(serializers.ModelSerializer):
    """
    Serializer for Activity model with computed spots_remaining field.
    
    spots_remaining = spots - 1 (creator) - count(likes)
    """
    created_by = ActivityCreatedBySerializer(read_only=True)
    spots_remaining = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = [
            'id',
            'title',
            'activity_type',
            'description',
            'image_url',
            'spots',
            'spots_remaining',
            'activity_date',
            'time_window',
            'location',
            'status',
            'created_by',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'spots_remaining',
            'created_by',
            'created_at',
        ]
    
    def get_spots_remaining(self, obj):
        """
        Calculate remaining spots for the activity.
        
        Formula: spots - 1 (creator) - count(likes)
        
        The creator automatically occupies 1 spot, so we subtract 1 from total spots.
        Each user who swiped right (is_like=True) occupies 1 additional spot.
        
        Returns:
            int: Number of remaining spots available (minimum 0)
        """
        # Count the number of likes (right swipes) on this activity
        likes_count = obj.swipes.filter(is_like=True).count()
        
        # spots_remaining = total_spots - 1 (creator) - likes_count
        # Ensure we don't return negative values
        remaining = obj.spots - 1 - likes_count
        return max(0, remaining)


class ActivityCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating Activity instances with validation.
    
    Validates activity_date (must be today or future) and spots (1-20).
    """
    
    class Meta:
        model = Activity
        fields = [
            'title',
            'activity_type',
            'description',
            'image_url',
            'spots',
            'activity_date',
            'time_window',
            'location',
        ]
    
    def validate_activity_date(self, value):
        """Validate that activity_date is not in the past."""
        from datetime import date
        today = date.today()
        
        if value < today:
            raise serializers.ValidationError(
                "Activity date must be today or in the future."
            )
        
        return value
    
    def validate_spots(self, value):
        """Validate that spots is between 1 and 20."""
        if value < 1:
            raise serializers.ValidationError(
                "Number of spots must be at least 1."
            )
        
        if value > 20:
            raise serializers.ValidationError(
                "Number of spots cannot exceed 20."
            )
        
        return value
    
    def create(self, validated_data):
        """
        Create an Activity with the current user as the creator.
        
        The status is automatically set to 'open' by the model default.
        """
        # Get the user's profile from the request context
        request = self.context.get('request')
        if request and hasattr(request.user, 'profile'):
            validated_data['created_by'] = request.user.profile
        
        return super().create(validated_data)


class ActivitySwipeSerializer(serializers.ModelSerializer):
    """
    Serializer for ActivitySwipe model - recording swipe direction on activities.
    """
    
    class Meta:
        model = ActivitySwipe
        fields = [
            'id',
            'activity',
            'user',
            'is_like',
            'swiped_at',
        ]
        read_only_fields = ['id', 'activity', 'user', 'swiped_at']


class ActivityMatchSerializer(serializers.ModelSerializer):
    """
    Serializer for ActivityMatch model with nested activity and attendees.
    """
    activity = ActivitySerializer(read_only=True)
    attendees = ActivityCreatedBySerializer(many=True, read_only=True)
    
    class Meta:
        model = ActivityMatch
        fields = [
            'id',
            'activity',
            'attendees',
            'matched_at',
        ]
        read_only_fields = ['id', 'activity', 'attendees', 'matched_at']


class ActivityMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for ActivityMessage model - chat messages in matched activity groups.
    """
    sender = ActivityCreatedBySerializer(read_only=True)
    
    class Meta:
        model = ActivityMessage
        fields = [
            'id',
            'sender',
            'content',
            'created_at',
        ]
        read_only_fields = ['id', 'sender', 'created_at']
