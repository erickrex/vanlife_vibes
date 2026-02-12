"""Serializers for the Builder marketplace."""

from rest_framework import serializers
from core.models import BuilderListing, BuilderMessage, Profile


class BuilderListingSerializer(serializers.ModelSerializer):
    """Read serializer for builder listings."""
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.CharField(source='user.profile.display_name', read_only=True)
    avatar_url = serializers.URLField(source='user.profile.avatar_url', read_only=True)
    city_name = serializers.CharField(source='city.display_name', read_only=True, default=None)
    user_id = serializers.UUIDField(source='user.id', read_only=True)

    class Meta:
        model = BuilderListing
        fields = [
            'id', 'user_id', 'title', 'description', 'category', 'listing_type',
            'price', 'city_name', 'photo_url', 'is_active',
            'username', 'display_name', 'avatar_url',
            'created_at', 'updated_at',
        ]


class BuilderListingCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating builder listings."""

    class Meta:
        model = BuilderListing
        fields = [
            'title', 'description', 'category', 'listing_type',
            'price', 'city', 'photo_url',
        ]


class BuilderMessageSerializer(serializers.ModelSerializer):
    """Read serializer for builder chat messages."""
    sender_profile = serializers.SerializerMethodField()

    class Meta:
        model = BuilderMessage
        fields = [
            'id', 'listing', 'sender', 'recipient', 'sender_profile',
            'content', 'is_read', 'created_at',
        ]

    def get_sender_profile(self, obj):
        return {
            'id': str(obj.sender.id),
            'display_name': obj.sender.display_name,
            'avatar_url': obj.sender.avatar_url,
        }


class BuilderMessageCreateSerializer(serializers.Serializer):
    """Write serializer for sending a builder message."""
    content = serializers.CharField(max_length=1000)
    recipient_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value.strip()

    def validate(self, attrs):
        sender_profile = self.context.get('sender_profile')
        owner_profile = self.context.get('owner_profile')
        recipient_id = attrs.get('recipient_id')

        if sender_profile is not None and owner_profile is not None and sender_profile == owner_profile:
            if not recipient_id:
                raise serializers.ValidationError(
                    {'recipient_id': ['recipient_id is required when replying as owner.']}
                )

            try:
                recipient_profile = Profile.objects.get(id=recipient_id)
            except Profile.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {'recipient_id': ['Recipient not found.']}
                ) from exc

            attrs['recipient_profile'] = recipient_profile

        return attrs
