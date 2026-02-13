"""Profile serializers for user profiles, vehicles, locations, and prompts."""

from urllib.parse import urljoin

from django.conf import settings
from rest_framework import serializers
from django.db import models
from django.utils import timezone

from core.models import (
    UserAccount, Profile, Vehicle, VehiclePhoto, HobbyTag, Country,
    InTownWindow, City, Prompt, ProfilePrompt, ProfilePhoto
)
from core.services.swipe_limit import SwipeLimitService


def normalize_media_url(value, request=None):
    """Normalize relative media paths to absolute URLs for API consumers."""
    if not value:
        return value

    trimmed = str(value).strip()
    if not trimmed:
        return ''

    if trimmed.startswith((
        'http://',
        'https://',
        'file://',
        'content://',
        'ph://',
        'asset://',
        'data:',
    )):
        return trimmed

    path = trimmed if trimmed.startswith('/') else f'/{trimmed}'

    if request is not None:
        return request.build_absolute_uri(path)

    media_url = getattr(settings, 'MEDIA_URL', '') or ''
    if media_url.startswith(('http://', 'https://')):
        return urljoin(media_url.rstrip('/') + '/', trimmed.lstrip('/'))

    return path


class ProfileCardDataSerializer(serializers.ModelSerializer):
    """Compact profile serializer for profile card display."""
    avatar_url = serializers.SerializerMethodField()
    vehicle = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url', 'has_van', 'vehicle', 'travel_status']
        read_only_fields = ['id', 'display_name', 'avatar_url', 'has_van', 'vehicle', 'travel_status']
    
    def get_vehicle(self, obj):
        """Return vehicle type info if user has a van"""
        if not obj.has_van:
            return None
        try:
            vehicle = obj.vehicle
            return {
                'vehicle_type': vehicle.vehicle_type
            }
        except Vehicle.DoesNotExist:
            return None

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        return normalize_media_url(obj.avatar_url, request=request)


class CountrySerializer(serializers.ModelSerializer):
    """Serializer for Country model"""
    
    class Meta:
        model = Country
        fields = ['id', 'name', 'code']
        read_only_fields = ['id']


class HobbyTagSerializer(serializers.ModelSerializer):
    """Serializer for HobbyTag model"""
    
    class Meta:
        model = HobbyTag
        fields = ['id', 'name', 'slug']
        read_only_fields = ['id']


class VehiclePhotoSerializer(serializers.ModelSerializer):
    """Serializer for VehiclePhoto model"""
    url = serializers.URLField(source='image_url', read_only=True)
    order = serializers.IntegerField(source='display_order', read_only=True)
    
    class Meta:
        model = VehiclePhoto
        fields = ['id', 'url', 'order']
        read_only_fields = ['id']


class VehicleSerializer(serializers.ModelSerializer):
    """Serializer for Vehicle model with nested photos"""
    photos = VehiclePhotoSerializer(many=True, read_only=True)
    type = serializers.CharField(source='vehicle_type', read_only=True)
    
    class Meta:
        model = Vehicle
        fields = ['id', 'type', 'make', 'model', 'year', 'build_status', 'nickname', 'photos']
        read_only_fields = ['id']


class ProfileSerializer(serializers.ModelSerializer):
    """Full profile serializer with nested data and derived location fields."""
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    
    # Nested serializers
    vehicle = serializers.SerializerMethodField()
    hobbies = HobbyTagSerializer(many=True, read_only=True)
    
    # Nested in_town_windows and prompts
    in_town_windows = serializers.SerializerMethodField()
    prompts = serializers.SerializerMethodField()
    
    # Derived location fields from InTownWindow
    now_in_city = serializers.SerializerMethodField()
    next_week_in_city = serializers.SerializerMethodField()
    next_month_in_city = serializers.SerializerMethodField()
    
    # Date fields for location timing
    now_in_start_date = serializers.SerializerMethodField()
    now_in_end_date = serializers.SerializerMethodField()
    next_week_in_start_date = serializers.SerializerMethodField()
    next_week_in_end_date = serializers.SerializerMethodField()
    next_month_in_start_date = serializers.SerializerMethodField()
    next_month_in_end_date = serializers.SerializerMethodField()
    
    # Discovery scoring (set dynamically on profile instances during dating discovery)
    relevance_score = serializers.SerializerMethodField()
    overlap_windows = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = [
            'id',
            'user_id',
            'username',
            'display_name',
            'bio',
            'has_completed_onboarding',
            'gender',
            'avatar_url',
            'cover_url',
            'current_location',
            'home_base',
            'has_van',
            'interested_in_men',
            'interested_in_women',
            'interested_in_nonbinary',
            'travel_status',
            'travel_companions',
            'work_status',
            'camping_preferences',
            'travel_pace',
            # Nomad-logistics fields
            'profile_type',
            'group_description',
            'looking_for_dating',
            'looking_for_friends',
            'meetup_interest',
            'rig_status',
            'social_vibe',
            'has_pets',
            'pet_type',
            'pet_friendly_only',
            'lifestyle_schedule',
            'lifestyle_social',
            'lifestyle_environment',
            # Friend-intent-filtering fields
            'relationship_status',
            'looking_for_friend_type',
            # Location fields (derived from InTownWindow)
            'in_town_windows',
            'prompts',
            'now_in_city',
            'next_week_in_city',
            'next_month_in_city',
            'now_in_start_date',
            'now_in_end_date',
            'next_week_in_start_date',
            'next_week_in_end_date',
            'next_month_in_start_date',
            'next_month_in_end_date',
            'hobbies',
            'vehicle',
            'relevance_score',
            'overlap_windows',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    
    def get_vehicle(self, obj):
        """Return vehicle data if has_van is true."""
        if not obj.has_van:
            return None
        
        try:
            vehicle = obj.vehicle
            return VehicleSerializer(vehicle).data
        except Vehicle.DoesNotExist:
            return None

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        return normalize_media_url(obj.avatar_url, request=request)

    def get_cover_url(self, obj):
        request = self.context.get('request')
        return normalize_media_url(obj.cover_url, request=request)

    def get_relevance_score(self, obj):
        """Return relevance_score if set during discovery ranking, else None."""
        return getattr(obj, 'relevance_score', None)

    def get_overlap_windows(self, obj):
        """Return overlap_windows if set during discovery ranking, else empty list."""
        return getattr(obj, 'overlap_windows', [])
    
    def get_in_town_windows(self, obj):
        """Return active (non-expired) in-town windows ordered by start_date."""
        from django.utils import timezone
        today = timezone.now().date()
        
        # Get active windows (end_date >= today), ordered by start_date
        windows = obj.in_town_windows.filter(end_date__gte=today).order_by('start_date')
        
        # Use a simplified serializer to avoid circular import issues
        return [
            {
                'id': str(window.id),
                'city_area': window.city_area,
                'start_date': window.start_date.isoformat(),
                'end_date': window.end_date.isoformat(),
                'created_at': window.created_at.isoformat() if window.created_at else None,
            }
            for window in windows
        ]
    
    def get_prompts(self, obj):
        """Return profile prompts ordered by display_order."""
        prompts = obj.prompts.all().order_by('display_order')
        
        # Use a simplified serializer to avoid circular import issues
        return [
            {
                'id': str(prompt.id),
                'prompt_name': prompt.prompt.prompt_name,
                'prompt_question': prompt.prompt.prompt_question,
                'prompt_answer': prompt.prompt_answer,
                'display_order': prompt.display_order,
            }
            for prompt in prompts
        ]

    
    def get_now_in_city(self, obj):
        """Return city_area of a window containing today."""
        from django.utils import timezone
        today = timezone.now().date()
        
        window = obj.in_town_windows.filter(
            start_date__lte=today,
            end_date__gte=today
        ).first()
        
        return window.city_area if window else None
    
    def get_next_week_in_city(self, obj):
        """Return city_area of a window starting next week."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        
        # Calculate next week boundaries (Monday to Sunday)
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        
        window = obj.in_town_windows.filter(
            start_date__gte=next_monday,
            start_date__lte=next_sunday
        ).first()
        
        return window.city_area if window else None
    
    def get_next_month_in_city(self, obj):
        """Return city_area of a window starting the Monday after next week."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        
        # Calculate month period boundaries
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        month_start_monday = next_sunday + timedelta(days=1)
        month_end_sunday = month_start_monday + timedelta(weeks=4) - timedelta(days=1)
        
        window = obj.in_town_windows.filter(
            start_date__gte=month_start_monday,
            start_date__lte=month_end_sunday
        ).first()
        
        return window.city_area if window else None
    
    def get_now_in_start_date(self, obj):
        """Return start_date for the current location window."""
        from django.utils import timezone
        today = timezone.now().date()
        
        window = obj.in_town_windows.filter(
            start_date__lte=today,
            end_date__gte=today
        ).first()
        
        return window.start_date.isoformat() if window else None
    
    def get_now_in_end_date(self, obj):
        """Return end_date for the current location window."""
        from django.utils import timezone
        today = timezone.now().date()
        
        window = obj.in_town_windows.filter(
            start_date__lte=today,
            end_date__gte=today
        ).first()
        
        return window.end_date.isoformat() if window else None
    
    def get_next_week_in_start_date(self, obj):
        """Return start_date for the next week location window."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        
        window = obj.in_town_windows.filter(
            start_date__gte=next_monday,
            start_date__lte=next_sunday
        ).first()
        
        return window.start_date.isoformat() if window else None
    
    def get_next_week_in_end_date(self, obj):
        """Return end_date for the next week location window."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        
        window = obj.in_town_windows.filter(
            start_date__gte=next_monday,
            start_date__lte=next_sunday
        ).first()
        
        return window.end_date.isoformat() if window else None
    
    def get_next_month_in_start_date(self, obj):
        """Return start_date for the next month location window."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        month_start_monday = next_sunday + timedelta(days=1)
        month_end_sunday = month_start_monday + timedelta(weeks=4) - timedelta(days=1)
        
        window = obj.in_town_windows.filter(
            start_date__gte=month_start_monday,
            start_date__lte=month_end_sunday
        ).first()
        
        return window.start_date.isoformat() if window else None
    
    def get_next_month_in_end_date(self, obj):
        """Return end_date for the next month location window."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        month_start_monday = next_sunday + timedelta(days=1)
        month_end_sunday = month_start_monday + timedelta(weeks=4) - timedelta(days=1)
        
        window = obj.in_town_windows.filter(
            start_date__gte=month_start_monday,
            start_date__lte=month_end_sunday
        ).first()
        
        return window.end_date.isoformat() if window else None
    
class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Profile update serializer with validation and InTownWindow management."""
    
    # City name fields - these create/update InTownWindow records
    now_in_city = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    next_week_in_city = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    next_month_in_city = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    
    # Date fields for precise location timing
    now_in_start_date = serializers.DateField(required=False, allow_null=True)
    now_in_end_date = serializers.DateField(required=False, allow_null=True)
    next_week_in_start_date = serializers.DateField(required=False, allow_null=True)
    next_week_in_end_date = serializers.DateField(required=False, allow_null=True)
    next_month_in_start_date = serializers.DateField(required=False, allow_null=True)
    next_month_in_end_date = serializers.DateField(required=False, allow_null=True)
    
    # Hobby IDs for updating hobbies
    hobby_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True
    )
    
    # Valid camping preference values
    VALID_CAMPING_PREFERENCES = [
        'boondocking',
        'campgrounds', 
        'stealth_camping',
        'rv_parks',
        'friends_driveways'
    ]
    
    class Meta:
        model = Profile
        fields = [
            'display_name',
            'bio',
            'has_completed_onboarding',
            'gender',
            'current_location',
            'home_base',
            'has_van',
            'interested_in_men',
            'interested_in_women',
            'interested_in_nonbinary',
            'travel_status',
            'travel_companions',
            'work_status',
            'camping_preferences',
            'travel_pace',
            # Nomad-logistics fields
            'profile_type',
            'group_description',
            'looking_for_dating',
            'looking_for_friends',
            'meetup_interest',
            'rig_status',
            'social_vibe',
            'has_pets',
            'pet_type',
            'pet_friendly_only',
            'lifestyle_schedule',
            'lifestyle_social',
            'lifestyle_environment',
            # Friend-intent-filtering fields
            'relationship_status',
            'looking_for_friend_type',
            # Location fields (converted to InTownWindow)
            'now_in_city',
            'next_week_in_city',
            'next_month_in_city',
            # Date fields for precise location timing
            'now_in_start_date',
            'now_in_end_date',
            'next_week_in_start_date',
            'next_week_in_end_date',
            'next_month_in_start_date',
            'next_month_in_end_date',
            'hobby_ids',
        ]

    
    def validate_display_name(self, value):
        """Validate display_name character limit (≤ 50 characters)"""
        if value and len(value) > 50:
            raise serializers.ValidationError(
                "Display name must be 50 characters or fewer."
            )
        return value
    
    def validate_bio(self, value):
        """Validate bio character limit (≤ 500 characters)"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Bio must be 500 characters or fewer."
            )
        return value
    
    def validate_current_location(self, value):
        """Validate current_location character limit (≤ 100 characters)"""
        if value and len(value) > 100:
            raise serializers.ValidationError(
                "Current location must be 100 characters or fewer."
            )
        return value
    
    def validate_home_base(self, value):
        """Validate home_base character limit (≤ 100 characters)"""
        if value and len(value) > 100:
            raise serializers.ValidationError(
                "Home base must be 100 characters or fewer."
            )
        return value
    
    def validate_travel_status(self, value):
        """Validate travel_status is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.TRAVEL_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid travel status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_travel_companions(self, value):
        """Validate travel_companions is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.TRAVEL_COMPANIONS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid travel companions. Must be one of: {', '.join(valid_choices)}"
            )
        return value


    def validate_now_in_city(self, value):
        if value is None or value == '':
            return value
        if not City.objects.filter(display_name__iexact=value).exists():
            raise serializers.ValidationError("Select a city from the list.")
        return value

    def validate_next_week_in_city(self, value):
        if value is None or value == '':
            return value
        if not City.objects.filter(display_name__iexact=value).exists():
            raise serializers.ValidationError("Select a city from the list.")
        return value

    def validate_next_month_in_city(self, value):
        if value is None or value == '':
            return value
        if not City.objects.filter(display_name__iexact=value).exists():
            raise serializers.ValidationError("Select a city from the list.")
        return value
    
    def validate_work_status(self, value):
        """Validate work_status is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.WORK_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid work status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_travel_pace(self, value):
        """Validate travel_pace is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.TRAVEL_PACE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid travel pace. Must be one of: {', '.join(valid_choices)}"
            )
        return value

    
    # =========================================================================
    # Nomad-logistics enum field validation
    # =========================================================================
    
    def validate_profile_type(self, value):
        """Validate profile_type is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.PROFILE_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid profile type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_group_description(self, value):
        """Validate group_description character limit (≤ 200 characters)"""
        if value and len(value) > 200:
            raise serializers.ValidationError(
                "Group description must be 200 characters or fewer."
            )
        return value
    
    def validate_meetup_interest(self, value):
        """Validate meetup_interest is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.MEETUP_INTEREST_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid meetup interest. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_rig_status(self, value):
        """Validate rig_status is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.RIG_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid rig status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_social_vibe(self, value):
        """Validate social_vibe is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.SOCIAL_VIBE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid social vibe. Must be one of: {', '.join(valid_choices)}"
            )
        return value

    
    def validate_pet_type(self, value):
        """Validate pet_type is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.PET_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid pet type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_lifestyle_schedule(self, value):
        """Validate lifestyle_schedule is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LIFESTYLE_SCHEDULE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid lifestyle schedule. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_lifestyle_social(self, value):
        """Validate lifestyle_social is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LIFESTYLE_SOCIAL_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid lifestyle social. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_lifestyle_environment(self, value):
        """Validate lifestyle_environment is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LIFESTYLE_ENVIRONMENT_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid lifestyle environment. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_relationship_status(self, value):
        """Validate relationship_status is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.RELATIONSHIP_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid relationship_status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_looking_for_friend_type(self, value):
        """Validate looking_for_friend_type is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LOOKING_FOR_FRIEND_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid looking_for_friend_type. Must be one of: {', '.join(valid_choices)}"
            )
        return value

    
    def validate_camping_preferences(self, value):
        """Validate camping_preferences contains only valid values"""
        if value is None:
            return []
        
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Camping preferences must be a list."
            )
        
        invalid_prefs = [pref for pref in value if pref not in self.VALID_CAMPING_PREFERENCES]
        if invalid_prefs:
            raise serializers.ValidationError(
                f"Invalid camping preferences: {', '.join(invalid_prefs)}. "
                f"Valid options are: {', '.join(self.VALID_CAMPING_PREFERENCES)}"
            )
        
        return value
    
    def validate_hobby_ids(self, value):
        """Validate all hobby_ids exist in the database"""
        if value is None:
            return []
        
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Hobby IDs must be a list."
            )
        
        # Check all hobby IDs exist
        existing_ids = set(
            HobbyTag.objects.filter(id__in=value).values_list('id', flat=True)
        )
        provided_ids = set(value)
        missing_ids = provided_ids - existing_ids
        
        if missing_ids:
            raise serializers.ValidationError(
                f"Invalid hobby IDs: {', '.join(str(id) for id in missing_ids)}. "
                "Please provide valid hobby tag IDs."
            )
        
        return value
    
    def validate(self, attrs):
        """Cross-field validation for intents, pet_type, and group_description."""
        # =========================================================================
        # Validate looking_for_dating / looking_for_friends
        # At least one intent must be selected
        # =========================================================================
        looking_for_dating = attrs.get('looking_for_dating')
        looking_for_friends = attrs.get('looking_for_friends')
        
        # Only validate if at least one field is being updated
        if looking_for_dating is not None or looking_for_friends is not None:
            # Get current instance values for fields not being updated
            if self.instance:
                if looking_for_dating is None:
                    looking_for_dating = self.instance.looking_for_dating
                if looking_for_friends is None:
                    looking_for_friends = self.instance.looking_for_friends
            else:
                # For new profiles (shouldn't happen with update serializer, but be safe)
                if looking_for_dating is None:
                    looking_for_dating = False
                if looking_for_friends is None:
                    looking_for_friends = True
            
            # Validate at least one is true
            if not looking_for_dating and not looking_for_friends:
                raise serializers.ValidationError({
                    'looking_for': "At least one of 'looking_for_dating' or 'looking_for_friends' must be true."
                })

        
        # =========================================================================
        # Validate conditional pet_type
        # pet_type should only be accepted when has_pets is true
        # =========================================================================
        has_pets = attrs.get('has_pets')
        pet_type = attrs.get('pet_type')
        
        # Determine the effective has_pets value
        if has_pets is None and self.instance:
            has_pets = self.instance.has_pets
        elif has_pets is None:
            has_pets = False
        
        # If has_pets is False, clear pet_type
        if not has_pets:
            if pet_type is not None:
                # Clear pet_type when has_pets is False
                attrs['pet_type'] = None
            elif self.instance and self.instance.pet_type:
                # Also clear if has_pets is being set to False and instance has pet_type
                attrs['pet_type'] = None
        
        # =========================================================================
        # Validate conditional group_description
        # group_description should only be accepted when profile_type is 'couple' or 'group'
        # =========================================================================
        profile_type = attrs.get('profile_type')
        group_description = attrs.get('group_description')
        
        # Determine the effective profile_type value
        if profile_type is None and self.instance:
            profile_type = self.instance.profile_type
        elif profile_type is None:
            profile_type = 'solo'
        
        # If profile_type is 'solo', clear group_description
        if profile_type == 'solo':
            if group_description is not None:
                # Clear group_description when profile_type is 'solo'
                attrs['group_description'] = ''
            elif self.instance and self.instance.group_description:
                # Also clear if profile_type is being set to 'solo' and instance has group_description
                attrs['group_description'] = ''

        # Premium gating: future location matching is a premium feature.
        # Free users may still set "now_in_city".
        if self.instance and not SwipeLimitService.is_premium(self.instance):
            next_week = attrs.get('next_week_in_city')
            next_month = attrs.get('next_month_in_city')
            has_next_week = bool(next_week and str(next_week).strip())
            has_next_month = bool(next_month and str(next_month).strip())
            if has_next_week or has_next_month:
                raise serializers.ValidationError({
                    'next_week_in_city': 'Premium required for future location matching.',
                    'next_month_in_city': 'Premium required for future location matching.',
                })
        
        return attrs

    
    def update(self, instance, validated_data):
        """Update profile, handling city→InTownWindow conversion and hobby updates."""
        from datetime import timedelta
        
        hobby_ids = validated_data.pop('hobby_ids', None)
        
        # Handle city fields by creating/updating InTownWindow records
        now_in_city = validated_data.pop('now_in_city', None)
        next_week_in_city = validated_data.pop('next_week_in_city', None)
        next_month_in_city = validated_data.pop('next_month_in_city', None)
        
        # Handle date fields
        now_in_start_date = validated_data.pop('now_in_start_date', None)
        now_in_end_date = validated_data.pop('now_in_end_date', None)
        next_week_in_start_date = validated_data.pop('next_week_in_start_date', None)
        next_week_in_end_date = validated_data.pop('next_week_in_end_date', None)
        next_month_in_start_date = validated_data.pop('next_month_in_start_date', None)
        next_month_in_end_date = validated_data.pop('next_month_in_end_date', None)
        
        today = timezone.now().date()
        
        # Calculate week-aligned dates (used as defaults when dates not provided)
        # weekday(): Monday=0, Sunday=6
        days_until_sunday = 6 - today.weekday()
        this_sunday = today + timedelta(days=days_until_sunday)
        next_monday = this_sunday + timedelta(days=1)
        next_sunday = next_monday + timedelta(days=6)
        month_start_monday = next_sunday + timedelta(days=1)
        month_end_sunday = month_start_monday + timedelta(weeks=4) - timedelta(days=1)
        
        # Helper function to update or create a window for a time period
        def update_location_window(city_value, start_date, end_date, field_name):
            """Update or create an InTownWindow for the given time period."""
            # Find existing window in this time range
            existing_window = instance.in_town_windows.filter(
                start_date__lte=end_date,
                end_date__gte=start_date
            ).first()
            
            if city_value:
                if existing_window:
                    # Update existing window
                    existing_window.city_area = city_value
                    existing_window.start_date = start_date
                    existing_window.end_date = end_date
                    existing_window.save()
                else:
                    # Create new window
                    InTownWindow.objects.create(
                        profile=instance,
                        city_area=city_value,
                        start_date=start_date,
                        end_date=end_date
                    )
            elif existing_window and field_name in self.initial_data:
                # City was explicitly cleared - delete the window
                existing_window.delete()
        
        # Update now_in_city (use provided dates or default to today → this Sunday)
        if 'now_in_city' in self.initial_data:
            start = now_in_start_date if now_in_start_date else today
            end = now_in_end_date if now_in_end_date else this_sunday
            update_location_window(now_in_city, start, end, 'now_in_city')
        
        # Update next_week_in_city (use provided dates or default to next Monday → next Sunday)
        if 'next_week_in_city' in self.initial_data:
            start = next_week_in_start_date if next_week_in_start_date else next_monday
            end = next_week_in_end_date if next_week_in_end_date else next_sunday
            update_location_window(next_week_in_city, start, end, 'next_week_in_city')
        
        # Update next_month_in_city (use provided dates or default to Monday after next week → 4 weeks later)
        if 'next_month_in_city' in self.initial_data:
            start = next_month_in_start_date if next_month_in_start_date else month_start_monday
            end = next_month_in_end_date if next_month_in_end_date else month_end_sunday
            update_location_window(next_month_in_city, start, end, 'next_month_in_city')
        
        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        # Handle hobby updates (many-to-many relationship)
        if hobby_ids is not None:
            # Clear existing hobbies and set new ones
            instance.hobbies.clear()
            hobbies = HobbyTag.objects.filter(id__in=hobby_ids)
            instance.hobbies.set(hobbies)
        
        return instance



class VehicleUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating vehicles."""
    
    class Meta:
        model = Vehicle
        fields = ['vehicle_type', 'make', 'model', 'year', 'build_status', 'nickname']
    
    def validate_vehicle_type(self, value):
        """Validate vehicle_type is a valid choice"""
        valid_choices = [choice[0] for choice in Vehicle.VEHICLE_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid vehicle type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_make(self, value):
        """Validate make character limit (≤ 50 characters)"""
        if value and len(value) > 50:
            raise serializers.ValidationError(
                "Make must be 50 characters or fewer."
            )
        return value
    
    def validate_model(self, value):
        """Validate model character limit (≤ 50 characters)"""
        if value and len(value) > 50:
            raise serializers.ValidationError(
                "Model must be 50 characters or fewer."
            )
        return value
    
    def validate_year(self, value):
        """Validate vehicle year range (1900 to current year + 1)."""
        if value is None:
            return value
        
        from datetime import datetime
        current_year = datetime.now().year
        min_year = 1900
        max_year = current_year + 1
        
        if value < min_year or value > max_year:
            raise serializers.ValidationError(
                f"Year must be between {min_year} and {max_year}."
            )
        return value
    
    def validate_build_status(self, value):
        """Validate build_status is a valid choice"""
        if value is None or value == '':
            return value
        valid_choices = [choice[0] for choice in Vehicle.BUILD_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid build status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_nickname(self, value):
        """Validate nickname character limit (≤ 30 characters)"""
        if value and len(value) > 30:
            raise serializers.ValidationError(
                "Nickname must be 30 characters or fewer."
            )
        return value



class VehiclePhotoCreateSerializer(serializers.ModelSerializer):
    """Serializer for uploading vehicle photos (max 10 per vehicle)."""
    
    MAX_PHOTOS_PER_VEHICLE = 10
    
    class Meta:
        model = VehiclePhoto
        fields = ['image_url', 'display_order']
    
    def validate_image_url(self, value):
        """Validate image_url is a valid URL"""
        if not value:
            raise serializers.ValidationError(
                "Image URL is required."
            )
        return value
    
    def validate_display_order(self, value):
        """Validate display_order is a positive integer"""
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "Display order must be a positive integer."
            )
        return value
    
    def validate(self, attrs):
        """Validate max 10 photos per vehicle."""
        # Get the vehicle from context (should be set by the view)
        vehicle = self.context.get('vehicle')
        
        if vehicle:
            current_photo_count = vehicle.photos.count()
            if current_photo_count >= self.MAX_PHOTOS_PER_VEHICLE:
                raise serializers.ValidationError({
                    'image_url': f"Maximum of {self.MAX_PHOTOS_PER_VEHICLE} photos per vehicle allowed. "
                                 f"Please delete an existing photo before adding a new one."
                })
        
        return attrs
    
    def create(self, validated_data):
        """Create a new vehicle photo"""
        vehicle = self.context.get('vehicle')
        if not vehicle:
            raise serializers.ValidationError(
                "Vehicle context is required to create a photo."
            )
        
        # If display_order is not provided, set it to the next available order
        if validated_data.get('display_order') is None:
            max_order = vehicle.photos.aggregate(
                max_order=models.Max('display_order')
            )['max_order']
            validated_data['display_order'] = (max_order or 0) + 1
        
        return VehiclePhoto.objects.create(vehicle=vehicle, **validated_data)



class FeedCardSerializer(serializers.ModelSerializer):
    """Profile card for the nearby feed."""
    avatar_url = serializers.SerializerMethodField()
    timing_label = serializers.CharField(read_only=True)
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url', 'timing_label']
        read_only_fields = ['id', 'display_name', 'avatar_url', 'timing_label']

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        return normalize_media_url(obj.avatar_url, request=request)


class ProfileSummarySerializer(serializers.ModelSerializer):
    """Compact profile summary for lists."""
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url']
        read_only_fields = ['id', 'display_name', 'avatar_url']

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        return normalize_media_url(obj.avatar_url, request=request)


# ============================================================================
# InTownWindow Serializers (Nomad Logistics Feature)
# ============================================================================

class InTownWindowSerializer(serializers.ModelSerializer):
    """Serializer for InTownWindow with date range and limit validation."""
    
    MAX_WINDOWS_PER_PROFILE = 3
    
    class Meta:
        model = InTownWindow
        fields = ['id', 'profile', 'city_area', 'start_date', 'end_date', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'profile': {'required': False}  # Will be set from context in create
        }
    
    def validate_city_area(self, value):
        """Validate city_area character limit (≤ 100 characters)."""
        if value and len(value) > 100:
            raise serializers.ValidationError(
                "City/area name must be 100 characters or fewer."
            )
        return value

    
    def validate(self, attrs):
        """Validate date range and max windows per profile."""
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        
        # For updates, get existing values if not provided
        if self.instance:
            if start_date is None:
                start_date = self.instance.start_date
            if end_date is None:
                end_date = self.instance.end_date
        
        # Validate date range: start_date must be <= end_date
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                'start_date': "Start date must be before or equal to end date."
            })
        
        # Validate max 3 windows per profile (only for creation)
        if not self.instance:
            profile = attrs.get('profile') or self.context.get('profile')
            if profile:
                current_window_count = InTownWindow.objects.filter(profile=profile).count()
                if current_window_count >= self.MAX_WINDOWS_PER_PROFILE:
                    raise serializers.ValidationError({
                        'profile': f"Maximum of {self.MAX_WINDOWS_PER_PROFILE} in-town windows per profile allowed. "
                                   "Please delete an existing window before adding a new one."
                    })
        
        return attrs
    
    def create(self, validated_data):
        """Create a new in-town window, setting profile from context if not provided."""
        if 'profile' not in validated_data or validated_data['profile'] is None:
            profile = self.context.get('profile')
            if not profile:
                raise serializers.ValidationError(
                    "Profile context is required to create an in-town window."
                )
            validated_data['profile'] = profile
        
        return InTownWindow.objects.create(**validated_data)


class CitySerializer(serializers.ModelSerializer):
    """Serializer for city autocomplete."""
    class Meta:
        model = City
        fields = ['id', 'name', 'state_code', 'display_name']


class PromptListSerializer(serializers.ModelSerializer):
    """Serializer for prompt choices."""
    class Meta:
        model = Prompt
        fields = ['prompt_name', 'prompt_question', 'prompt_placeholder', 'prompt_type']



# ============================================================================
# ProfilePrompt Serializers (Nomad Logistics Feature)
# ============================================================================

class AvailablePromptSerializer(serializers.ModelSerializer):
    """Serializer for listing available prompt questions."""
    class Meta:
        model = Prompt
        fields = ['prompt_name', 'prompt_question', 'prompt_placeholder', 'prompt_type']


class ProfilePromptSerializer(serializers.ModelSerializer):
    """Serializer for ProfilePrompt with answer validation and prompt limits."""
    
    MAX_PROMPTS_PER_PROFILE = 3
    MAX_ANSWER_LENGTH = 200
    
    prompt_question = serializers.SerializerMethodField()
    prompt_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = ProfilePrompt
        fields = ['id', 'profile', 'prompt_name', 'prompt_question', 'prompt_answer', 'display_order']
        read_only_fields = ['id', 'prompt_question']
        extra_kwargs = {
            'profile': {'required': False}  # Will be set from context in create
        }
    
    def get_validators(self):
        """Override to remove automatic UniqueTogetherValidator (handled manually)."""
        validators = super().get_validators()
        # Filter out UniqueTogetherValidator - we handle it manually
        return [v for v in validators if not isinstance(v, serializers.UniqueTogetherValidator)]
    
    def get_prompt_question(self, obj):
        """Return the human-readable prompt question text."""
        return obj.prompt.prompt_question

    
    def validate_prompt_answer(self, value):
        """Validate prompt_answer length (≤ 200 characters) and non-empty."""
        if value and len(value) > self.MAX_ANSWER_LENGTH:
            raise serializers.ValidationError(
                f"Prompt answer must be {self.MAX_ANSWER_LENGTH} characters or fewer."
            )
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Prompt answer is required and cannot be empty."
            )
        return value
    
    def validate(self, attrs):
        """Validate max prompts per profile and unique prompt per profile."""
        prompt_name = attrs.pop('prompt_name', None)
        profile = attrs.get('profile') or self.context.get('profile')

        if prompt_name:
            try:
                attrs['prompt'] = Prompt.objects.get(prompt_name=prompt_name)
            except Prompt.DoesNotExist:
                raise serializers.ValidationError({
                    'prompt_name': 'Invalid prompt name. Please choose a valid prompt.'
                })
        
        prompt = attrs.get('prompt')
        if not prompt and not self.instance:
            raise serializers.ValidationError({
                'prompt_name': 'Prompt name is required.'
            })
        
        # For updates, use instance's profile if not provided
        if self.instance and not profile:
            profile = self.instance.profile
        
        if profile:
            # Check for duplicate prompt (only for creation or if changing prompt)
            if not self.instance or (self.instance and prompt != self.instance.prompt):
                existing_prompt = ProfilePrompt.objects.filter(
                    profile=profile,
                    prompt=prompt
                )
                if self.instance:
                    existing_prompt = existing_prompt.exclude(id=self.instance.id)
                
                if existing_prompt.exists():
                    raise serializers.ValidationError({
                        'prompt_name': "You have already answered this prompt. "
                                      "Please choose a different prompt or update the existing one."
                    })
            
            # Validate max 3 prompts per profile (only for creation)
            if not self.instance:
                current_prompt_count = ProfilePrompt.objects.filter(profile=profile).count()
                if current_prompt_count >= self.MAX_PROMPTS_PER_PROFILE:
                    raise serializers.ValidationError({
                        'profile': f"Maximum of {self.MAX_PROMPTS_PER_PROFILE} prompts per profile allowed. "
                                   "Please delete an existing prompt before adding a new one."
                    })
        
        return attrs

    
    def create(self, validated_data):
        """Create a new profile prompt, setting profile from context if not provided."""
        if 'profile' not in validated_data or validated_data['profile'] is None:
            profile = self.context.get('profile')
            if not profile:
                raise serializers.ValidationError(
                    "Profile context is required to create a prompt."
                )
            validated_data['profile'] = profile

        if 'prompt' not in validated_data or validated_data['prompt'] is None:
            raise serializers.ValidationError({
                'prompt_name': 'Prompt name is required.'
            })
        
        # If display_order is not provided, set it to the next available order
        if validated_data.get('display_order') is None:
            profile = validated_data['profile']
            from django.db.models import Max
            max_order = ProfilePrompt.objects.filter(profile=profile).aggregate(
                max_order=Max('display_order')
            )['max_order']
            validated_data['display_order'] = (max_order or 0) + 1
        
        return ProfilePrompt.objects.create(**validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['prompt_name'] = instance.prompt.prompt_name
        return data


class ProfilePhotoSerializer(serializers.ModelSerializer):
    """Read serializer for ProfilePhoto responses."""
    
    class Meta:
        model = ProfilePhoto
        fields = ['id', 'photo_type', 'image', 'display_order', 'created_at']
        read_only_fields = ['id', 'photo_type', 'image', 'display_order', 'created_at']


class ProfilePhotoUploadSerializer(serializers.Serializer):
    """Write serializer for photo upload validation."""
    image = serializers.ImageField(required=True)
    photo_type = serializers.ChoiceField(
        choices=ProfilePhoto.PHOTO_TYPE_CHOICES,
        required=True,
    )
