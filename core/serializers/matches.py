# core/serializers/matches.py
"""Match serializers for person matches, swipes, direct messages, and reports."""

from rest_framework import serializers
from django.db import models, transaction, IntegrityError

from core.models import (
    Profile, PersonSwipe, PersonMatch, DirectMessage, UserReport
)


class PersonMatchSerializer(serializers.ModelSerializer):
    """Match information including both users and metadata."""
    user1_profile = serializers.SerializerMethodField()
    user2_profile = serializers.SerializerMethodField()
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = PersonMatch
        fields = [
            'id', 'user1', 'user2', 'user1_profile', 'user2_profile',
            'other_user', 'mode', 'matched_at', 'is_active',
            'last_message', 'unread_count'
        ]
        read_only_fields = ['id', 'matched_at']
    
    def get_user1_profile(self, obj):
        """Return basic profile info for user1"""
        return {
            'id': str(obj.user1.id),
            'display_name': obj.user1.display_name,
            'avatar_url': obj.user1.avatar_url,
        }
    
    def get_user2_profile(self, obj):
        """Return basic profile info for user2"""
        return {
            'id': str(obj.user2.id),
            'display_name': obj.user2.display_name,
            'avatar_url': obj.user2.avatar_url,
        }
    
    def get_other_user(self, obj):
        """Return the other user in the match relative to the request user."""
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        
        try:
            request_user_profile = request.user.profile
            other_profile = obj.get_other_user(request_user_profile)
            return {
                'id': str(other_profile.id),
                'display_name': other_profile.display_name,
                'avatar_url': other_profile.avatar_url,
            }
        except Profile.DoesNotExist:
            return None

    def get_last_message(self, obj):
        """Return summary of the most recent direct message for this match."""
        last_message = obj.messages.order_by('-created_at').first()
        if not last_message:
            return None

        return {
            'id': str(last_message.id),
            'content': last_message.content,
            'message_type': last_message.message_type,
            'created_at': last_message.created_at.isoformat() if last_message.created_at else None,
            'is_read': last_message.is_read,
            'sender_id': str(last_message.sender_id),
            'sender_profile': {
                'id': str(last_message.sender.id),
                'display_name': last_message.sender.display_name,
                'avatar_url': last_message.sender.avatar_url,
            }
        }

    def get_unread_count(self, obj):
        """Return unread message count for the request user in this match."""
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return 0

        try:
            request_user_profile = request.user.profile
        except Profile.DoesNotExist:
            return 0

        return obj.messages.filter(
            is_read=False
        ).exclude(
            sender=request_user_profile
        ).count()


class PersonSwipeSerializer(serializers.ModelSerializer):
    """Swipe records with mutual match detection."""
    swiper = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.all(),
        required=False,
        allow_null=True
    )
    swiper_profile = serializers.SerializerMethodField()
    swiped_on_profile = serializers.SerializerMethodField()
    match_created = serializers.SerializerMethodField()
    match = serializers.SerializerMethodField()
    
    class Meta:
        model = PersonSwipe
        fields = [
            'id', 'swiper', 'swiped_on', 'swiper_profile', 'swiped_on_profile',
            'is_like', 'mode', 'swiped_at', 'match_created', 'match'
        ]
        read_only_fields = ['id', 'swiped_at', 'match_created', 'match']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Store match info for response
        self._match_created = False
        self._match = None
    
    def get_swiper_profile(self, obj):
        """Return basic profile info for swiper"""
        return {
            'id': str(obj.swiper.id),
            'display_name': obj.swiper.display_name,
            'avatar_url': obj.swiper.avatar_url,
        }
    
    def get_swiped_on_profile(self, obj):
        """Return basic profile info for swiped_on user"""
        return {
            'id': str(obj.swiped_on.id),
            'display_name': obj.swiped_on.display_name,
            'avatar_url': obj.swiped_on.avatar_url,
        }
    
    def get_match_created(self, obj):
        """Return whether a match was created from this swipe"""
        return getattr(self, '_match_created', False)
    
    def get_match(self, obj):
        """Return the match if one was created"""
        match = getattr(self, '_match', None)
        if match:
            return {
                'id': str(match.id),
                'mode': match.mode,
                'matched_at': match.matched_at.isoformat() if match.matched_at else None,
            }
        return None
    
    def validate_mode(self, value):
        """Validate mode is a valid choice"""
        valid_choices = [choice[0] for choice in PersonSwipe.MODE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid mode. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_swiped_on(self, value):
        """Validate swiped_on is a valid profile"""
        if not value:
            raise serializers.ValidationError("swiped_on is required.")
        return value
    
    def validate(self, attrs):
        """Cross-field validation: no self-swipe, no duplicates, dating opt-in check."""
        swiper = attrs.get('swiper') or self.context.get('swiper')
        swiped_on = attrs.get('swiped_on')
        mode = attrs.get('mode')
        
        # Validate swiper is not swiping on themselves
        if swiper and swiped_on and swiper.id == swiped_on.id:
            raise serializers.ValidationError({
                'swiped_on': "You cannot swipe on yourself."
            })
        
        # Check for duplicate swipe (only for creation)
        if not self.instance and swiper and swiped_on and mode:
            existing_swipe = PersonSwipe.objects.filter(
                swiper=swiper,
                swiped_on=swiped_on,
                mode=mode
            ).exists()
            
            if existing_swipe:
                raise serializers.ValidationError({
                    'swiped_on': f"You have already swiped on this user in {mode} mode."
                })

        if swiped_on and mode == 'dating' and not swiped_on.looking_for_dating:
            raise serializers.ValidationError({
                'swiped_on': "This user is not available for dating."
            })

        # Gender preference validation for dating-mode swipes
        if swiper and swiped_on and mode == 'dating':
            self._check_gender_compatibility(swiper, swiped_on)
        
        return attrs
    
    def _check_gender_compatibility(self, swiper, swiped_on):
        """Reject dating swipes that violate gender preferences."""
        # Forward: target's gender must match swiper's interested_in_* flags
        target_gender = swiped_on.gender
        if target_gender:
            prefs = {
                'man': swiper.interested_in_men,
                'woman': swiper.interested_in_women,
                'non_binary': swiper.interested_in_nonbinary,
            }
            if not prefs.get(target_gender, False):
                raise serializers.ValidationError({
                    'swiped_on': "This profile doesn't match your gender preferences."
                })

        # Reverse: target's interested_in_* flags must include swiper's gender
        swiper_gender = swiper.gender
        if swiper_gender:
            reverse_prefs = {
                'man': swiped_on.interested_in_men,
                'woman': swiped_on.interested_in_women,
                'non_binary': swiped_on.interested_in_nonbinary,
            }
            if not reverse_prefs.get(swiper_gender, False):
                raise serializers.ValidationError({
                    'swiped_on': "You don't match this profile's gender preferences."
                })

    def create(self, validated_data):
        """Create a PersonSwipe and check for mutual match."""
        # Set swiper from context if not provided
        if 'swiper' not in validated_data or validated_data['swiper'] is None:
            swiper = self.context.get('swiper')
            if not swiper:
                raise serializers.ValidationError(
                    "Swiper context is required to create a swipe."
                )
            validated_data['swiper'] = swiper
        
        # Create the swipe
        swipe = PersonSwipe.objects.create(**validated_data)
        
        # Check for mutual match if this is a like
        if swipe.is_like:
            match = self._check_and_create_match(swipe)
            if match:
                self._match_created = True
                self._match = match
        
        return swipe
    
    def _check_and_create_match(self, swipe):
        """Check for a reciprocal like and create a PersonMatch if found."""
        # Look for a reciprocal like from the swiped_on user
        reciprocal_swipe = PersonSwipe.objects.filter(
            swiper=swipe.swiped_on,
            swiped_on=swipe.swiper,
            mode=swipe.mode,
            is_like=True
        ).first()
        
        if not reciprocal_swipe:
            return None
        
        # Check if a match already exists between these users in this mode
        existing_match = PersonMatch.objects.filter(
            mode=swipe.mode
        ).filter(
            models.Q(user1=swipe.swiper, user2=swipe.swiped_on) |
            models.Q(user1=swipe.swiped_on, user2=swipe.swiper)
        ).first()

        if existing_match:
            if not existing_match.is_active:
                existing_match.is_active = True
                existing_match.save(update_fields=['is_active'])
            return existing_match

        # Normalize ordering to prevent duplicate pair rows
        user1 = swipe.swiper
        user2 = swipe.swiped_on
        if str(user1.id) > str(user2.id):
            user1, user2 = user2, user1

        # Create the match (unique by ordered pair + mode), handle race safely
        try:
            with transaction.atomic():
                match, created = PersonMatch.objects.get_or_create(
                    user1=user1,
                    user2=user2,
                    mode=swipe.mode,
                    defaults={'is_active': True}
                )
        except IntegrityError:
            match = PersonMatch.objects.get(
                user1=user1,
                user2=user2,
                mode=swipe.mode
            )
            created = False

        if not match.is_active:
            match.is_active = True
            match.save(update_fields=['is_active'])

        return match


# ============================================================================
# DirectMessage Serializers (Nomad Logistics Feature - Chat System)
# ============================================================================

class DirectMessageSerializer(serializers.ModelSerializer):
    """1:1 chat messages between matched users."""
    
    MAX_CONTENT_LENGTH = 1000
    
    # Include sender profile info for display
    sender_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = DirectMessage
        fields = [
            'id', 'match', 'sender', 'sender_profile', 'content',
            'message_type', 'mini_card_data', 'created_at', 'is_read'
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'sender': {'required': False},  # Will be set from context
            'match': {'required': False},   # Will be set from context
        }
    
    def get_sender_profile(self, obj):
        """Return basic profile info for the sender."""
        return {
            'id': str(obj.sender.id),
            'display_name': obj.sender.display_name,
            'avatar_url': obj.sender.avatar_url,
        }
    
    def validate_content(self, value):
        """Validate content length (≤ 1000 characters)."""
        if value and len(value) > self.MAX_CONTENT_LENGTH:
            raise serializers.ValidationError(
                f"Message content must be {self.MAX_CONTENT_LENGTH} characters or fewer."
            )
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Message content is required and cannot be empty."
            )
        return value
    
    def validate_message_type(self, value):
        """Validate message_type is a valid choice."""
        valid_choices = [choice[0] for choice in DirectMessage.MESSAGE_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid message type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_mini_card_data(self, value):
        """Validate mini_card_data structure (current_location, in_town_until, meet_preference)."""
        if value is None:
            return value
        
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Mini-card data must be a JSON object."
            )
        
        # Validate allowed fields
        allowed_fields = {'current_location', 'in_town_until', 'meet_preference'}
        provided_fields = set(value.keys())
        unknown_fields = provided_fields - allowed_fields
        
        if unknown_fields:
            raise serializers.ValidationError(
                f"Unknown fields in mini-card data: {', '.join(unknown_fields)}. "
                f"Allowed fields are: {', '.join(allowed_fields)}"
            )
        
        # Validate current_location if provided
        if 'current_location' in value and value['current_location'] is not None:
            if not isinstance(value['current_location'], str):
                raise serializers.ValidationError(
                    "current_location must be a string."
                )
            if len(value['current_location']) > 100:
                raise serializers.ValidationError(
                    "current_location must be 100 characters or fewer."
                )
        
        # Validate in_town_until if provided (should be a date string)
        if 'in_town_until' in value and value['in_town_until'] is not None:
            if not isinstance(value['in_town_until'], str):
                raise serializers.ValidationError(
                    "in_town_until must be a date string (YYYY-MM-DD format)."
                )
            # Try to parse the date
            try:
                from datetime import datetime
                datetime.strptime(value['in_town_until'], '%Y-%m-%d')
            except ValueError:
                raise serializers.ValidationError(
                    "in_town_until must be a valid date in YYYY-MM-DD format."
                )
        
        # Validate meet_preference if provided
        if 'meet_preference' in value and value['meet_preference'] is not None:
            if not isinstance(value['meet_preference'], str):
                raise serializers.ValidationError(
                    "meet_preference must be a string."
                )
            if len(value['meet_preference']) > 200:
                raise serializers.ValidationError(
                    "meet_preference must be 200 characters or fewer."
                )
        
        return value
    
    def validate(self, attrs):
        """Cross-field validation: sender must be in match, match must be active, mini_card rules."""
        # Get match and sender from attrs or context
        match = attrs.get('match') or self.context.get('match')
        sender = attrs.get('sender') or self.context.get('sender')
        message_type = attrs.get('message_type', 'text')
        mini_card_data = attrs.get('mini_card_data')
        
        # Validate match is provided
        if not match:
            raise serializers.ValidationError({
                'match': "Match is required."
            })
        
        # Validate sender is provided
        if not sender:
            raise serializers.ValidationError({
                'sender': "Sender is required."
            })
        
        # Property 10: Chat Access Control
        # Validate sender is one of the two users in the match
        if sender.id != match.user1_id and sender.id != match.user2_id:
            raise serializers.ValidationError({
                'sender': "Sender must be one of the two users in the match."
            })
        
        # Validate match is active
        if not match.is_active:
            raise serializers.ValidationError({
                'match': "Cannot send messages to an inactive match."
            })
        
        # Validate mini_card_data is provided when message_type is 'mini_card'
        if message_type == 'mini_card':
            if not mini_card_data:
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data is required when message_type is 'mini_card'."
                })
            # Ensure at least one field is provided in mini_card_data
            if not any(mini_card_data.get(field) for field in ['current_location', 'in_town_until', 'meet_preference']):
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data must contain at least one of: "
                                      "current_location, in_town_until, meet_preference."
                })
        
        return attrs
    
    def create(self, validated_data):
        """Create a DirectMessage, setting match and sender from context if needed."""
        # Set match from context if not provided
        if 'match' not in validated_data or validated_data['match'] is None:
            match = self.context.get('match')
            if not match:
                raise serializers.ValidationError(
                    "Match context is required to create a message."
                )
            validated_data['match'] = match
        
        # Set sender from context if not provided
        if 'sender' not in validated_data or validated_data['sender'] is None:
            sender = self.context.get('sender')
            if not sender:
                raise serializers.ValidationError(
                    "Sender context is required to create a message."
                )
            validated_data['sender'] = sender
        
        return DirectMessage.objects.create(**validated_data)


class DirectMessageCreateSerializer(serializers.Serializer):
    """Simplified serializer for creating DirectMessages via API."""
    content = serializers.CharField(
        max_length=1000,
        required=True,
        help_text="Message content (max 1000 characters)"
    )
    message_type = serializers.ChoiceField(
        choices=DirectMessage.MESSAGE_TYPE_CHOICES,
        default='text',
        required=False,
        help_text="Type of message: text, mini_card, or icebreaker"
    )
    mini_card_data = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="Mini-card data with current_location, in_town_until, meet_preference"
    )
    
    def validate_content(self, value):
        """Validate content is not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Message content is required and cannot be empty."
            )
        return value
    
    def validate_mini_card_data(self, value):
        """Validate mini_card_data via DirectMessageSerializer."""
        if value is None:
            return value
        
        # Use DirectMessageSerializer's validation logic
        temp_serializer = DirectMessageSerializer()
        return temp_serializer.validate_mini_card_data(value)
    
    def validate(self, attrs):
        """Ensure mini_card_data is provided when message_type is 'mini_card'."""
        message_type = attrs.get('message_type', 'text')
        mini_card_data = attrs.get('mini_card_data')
        
        if message_type == 'mini_card':
            if not mini_card_data:
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data is required when message_type is 'mini_card'."
                })
            # Ensure at least one field is provided
            if not any(mini_card_data.get(field) for field in ['current_location', 'in_town_until', 'meet_preference']):
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data must contain at least one of: "
                                      "current_location, in_town_until, meet_preference."
                })
        
        return attrs


# ============================================================================
# User Report Serializers
# ============================================================================

class UserReportSerializer(serializers.ModelSerializer):
    """Serializer for user reports."""
    reporter_profile = serializers.SerializerMethodField()
    reported_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = UserReport
        fields = [
            'id', 'reporter', 'reported', 'reporter_profile', 'reported_profile',
            'reason', 'description', 'created_at'
        ]
        read_only_fields = ['id', 'reporter', 'created_at']
    
    def get_reporter_profile(self, obj):
        """Return basic profile info for reporter"""
        return {
            'id': str(obj.reporter.id),
            'display_name': obj.reporter.display_name,
            'avatar_url': obj.reporter.avatar_url,
        }
    
    def get_reported_profile(self, obj):
        """Return basic profile info for reported user"""
        return {
            'id': str(obj.reported.id),
            'display_name': obj.reported.display_name,
            'avatar_url': obj.reported.avatar_url,
        }
    
    def validate_reason(self, value):
        """Validate reason is a valid choice"""
        valid_choices = [choice[0] for choice in UserReport.REASON_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid reason. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_description(self, value):
        """Validate description length"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value


class UserReportCreateSerializer(serializers.Serializer):
    """Serializer for creating a user report from a match context."""
    reason = serializers.ChoiceField(choices=UserReport.REASON_CHOICES)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    
    def validate_reason(self, value):
        """Validate reason is a valid choice"""
        valid_choices = [choice[0] for choice in UserReport.REASON_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid reason. Must be one of: {', '.join(valid_choices)}"
            )
        return value
