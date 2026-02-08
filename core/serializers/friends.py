# core/serializers/friends.py
"""
Friend-related serializers for friend requests, friendships, and friend messages.

This module contains serializers for:
- FriendRequestSerializer: Friend request with nested profile data
- FriendshipSerializer: Friendship with nested friend profile data
- FriendMessageSerializer: Chat messages between friends

Requirements: 2.2 (Backend File Organization)
"""

from rest_framework import serializers

from core.models import Profile, FriendRequest, Friendship, FriendMessage


class FriendProfileSerializer(serializers.ModelSerializer):
    """
    Minimal profile serializer for friend-related serializers.
    Includes id, display_name, and avatar_url.
    """
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url']
        read_only_fields = ['id', 'display_name', 'avatar_url']


class FriendRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for FriendRequest model with nested profile data.
    """
    from_user = FriendProfileSerializer(read_only=True)
    to_user = FriendProfileSerializer(read_only=True)
    
    class Meta:
        model = FriendRequest
        fields = [
            'id',
            'from_user',
            'to_user',
            'status',
            'created_at',
            'responded_at',
        ]
        read_only_fields = ['id', 'from_user', 'to_user', 'status', 'created_at', 'responded_at']


class FriendshipSerializer(serializers.ModelSerializer):
    """
    Serializer for Friendship model with nested friend profile data.
    
    The 'friend' field returns the other user in the friendship (not the current user).
    """
    friend = serializers.SerializerMethodField()
    
    class Meta:
        model = Friendship
        fields = [
            'id',
            'friend',
            'created_at',
        ]
        read_only_fields = ['id', 'friend', 'created_at']
    
    def get_friend(self, obj):
        """
        Return the other user's profile data based on the request context.
        
        The Friendship model has user1 and user2 fields. This method determines
        which user is the "friend" (the other user, not the current user) and
        returns their profile data using FriendProfileSerializer.
        """
        request = self.context.get('request')
        if not request or not request.user:
            return None
        
        try:
            current_profile = request.user.profile
        except Profile.DoesNotExist:
            return None
        
        # Determine which user is the friend (the other user)
        friend_profile = obj.get_friend(current_profile)
        
        return FriendProfileSerializer(friend_profile).data


class FriendMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for FriendMessage model - chat messages between friends.
    """
    sender = FriendProfileSerializer(read_only=True)
    
    class Meta:
        model = FriendMessage
        fields = [
            'id',
            'sender',
            'content',
            'created_at',
            'is_read',
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'is_read']
