# core/serializers/plans.py
"""
Plan-related serializers for plans, attendees, and plan messages.

This module contains serializers for:
- PlanAttendeeSerializer: Plan attendee with profile information
- PlanMessageSerializer: Plan chat messages with sender profile
- PlanSerializer: Plan model with nested attendees
- PlanCreateSerializer: Creating plans with validation
- PlanUpdateSerializer: Updating plans
- PlanMessageCreateSerializer: Simplified serializer for creating plan messages

Requirements: 2.2 (Backend File Organization)
"""

from rest_framework import serializers

from core.models import Plan, PlanAttendee, PlanMessage


class PlanAttendeeSerializer(serializers.ModelSerializer):
    """
    Serializer for PlanAttendee model with profile information.
    """
    user_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = PlanAttendee
        fields = ['id', 'plan', 'user', 'user_profile', 'status', 'joined_at', 'confirmed_at']
        read_only_fields = ['id', 'joined_at', 'confirmed_at']
    
    def get_user_profile(self, obj):
        """Return basic profile info for the attendee"""
        return {
            'id': str(obj.user.id),
            'display_name': obj.user.display_name,
            'avatar_url': obj.user.avatar_url,
        }


class PlanMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for PlanMessage model with sender profile data.
    """
    sender_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = PlanMessage
        fields = ['id', 'plan', 'sender', 'sender_profile', 'content', 'created_at']
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


class PlanSerializer(serializers.ModelSerializer):
    """
    Serializer for Plan model with nested attendees.
    """
    created_by_profile = serializers.SerializerMethodField()
    attendees = PlanAttendeeSerializer(many=True, read_only=True)
    attendee_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Plan
        fields = [
            'id', 'created_by', 'created_by_profile', 'title', 'plan_type',
            'plan_date', 'time_window', 'meetup_area', 'description',
            'max_attendees', 'status', 'created_at', 'attendees', 'attendee_count'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'status']
    
    def get_created_by_profile(self, obj):
        """Return basic profile info for the plan creator"""
        return {
            'id': str(obj.created_by.id),
            'display_name': obj.created_by.display_name,
            'avatar_url': obj.created_by.avatar_url,
        }
    
    def get_attendee_count(self, obj):
        """Return count of attendees (joined or confirmed)"""
        return obj.attendees.exclude(status='declined').count()


class PlanCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating plans with validation.
    
    Validates max_attendees (1-10), plan_date (not in past), and title length.
    """
    
    class Meta:
        model = Plan
        fields = [
            'title', 'plan_type', 'plan_date', 'time_window',
            'meetup_area', 'description', 'max_attendees'
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
    
    def validate_plan_type(self, value):
        """Validate plan_type is a valid choice"""
        valid_choices = [choice[0] for choice in Plan.PLAN_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid plan type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_time_window(self, value):
        """Validate time_window is a valid choice"""
        valid_choices = [choice[0] for choice in Plan.TIME_WINDOW_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid time window. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_plan_date(self, value):
        """Validate plan_date is not in the past"""
        from datetime import date
        today = date.today()
        if value < today:
            raise serializers.ValidationError(
                "Plan date cannot be in the past."
            )
        return value
    
    def validate_meetup_area(self, value):
        """Validate meetup_area is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Meetup area cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Meetup area must be 100 characters or less."
            )
        return value
    
    def validate_max_attendees(self, value):
        """Validate max_attendees is between 1 and 10"""
        if value < 1:
            raise serializers.ValidationError(
                "Max attendees must be at least 1."
            )
        if value > 10:
            raise serializers.ValidationError(
                "Max attendees cannot exceed 10."
            )
        return value
    
    def validate_description(self, value):
        """Validate description length if provided"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value


class PlanUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating plans.
    
    Allows updating title, description, time_window, meetup_area, and max_attendees.
    Validates max_attendees cannot be reduced below current attendee count.
    """
    
    class Meta:
        model = Plan
        fields = ['title', 'time_window', 'meetup_area', 'description', 'max_attendees']
    
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
        valid_choices = [choice[0] for choice in Plan.TIME_WINDOW_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid time window. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_meetup_area(self, value):
        """Validate meetup_area is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Meetup area cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Meetup area must be 100 characters or less."
            )
        return value
    
    def validate_max_attendees(self, value):
        """
        Validate max_attendees is between 1 and 10.
        Also ensure it's not less than current attendee count.
        """
        if value < 1:
            raise serializers.ValidationError(
                "Max attendees must be at least 1."
            )
        if value > 10:
            raise serializers.ValidationError(
                "Max attendees cannot exceed 10."
            )
        
        # Check if reducing below current attendee count
        if self.instance:
            current_count = self.instance.attendees.exclude(status='declined').count()
            if value < current_count:
                raise serializers.ValidationError(
                    f"Cannot reduce max attendees below current attendee count ({current_count})."
                )
        
        return value
    
    def validate_description(self, value):
        """Validate description length if provided"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value


class PlanMessageCreateSerializer(serializers.Serializer):
    """
    Simplified serializer for creating PlanMessages via API.
    Only requires content field, plan and sender are set by the view.
    """
    content = serializers.CharField(max_length=500)
    
    def validate_content(self, value):
        """Validate message content is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value
