"""
Tests for Friend message endpoints.

These tests cover the messages action on FriendViewSet which will be
affected by the planned refactoring to extract a reusable MessageableMixin.
"""
import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from core.models import (
    UserAccount, Profile, Friendship, FriendMessage
)


@pytest.mark.django_db
class FriendMessageAPITestCase(TestCase):
    """Test cases for Friend message endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create user1
        self.user1 = UserAccount.objects.create_user(
            username='frienduser1',
            email='frienduser1@example.com',
            password='testpass123'
        )
        self.profile1 = Profile.objects.get(user=self.user1)
        self.profile1.display_name = 'Friend User 1'
        self.profile1.looking_for_friends = True
        self.profile1.save()
        self.token1 = Token.objects.create(user=self.user1)
        
        # Create user2
        self.user2 = UserAccount.objects.create_user(
            username='frienduser2',
            email='frienduser2@example.com',
            password='testpass123'
        )
        self.profile2 = Profile.objects.get(user=self.user2)
        self.profile2.display_name = 'Friend User 2'
        self.profile2.looking_for_friends = True
        self.profile2.save()
        self.token2 = Token.objects.create(user=self.user2)
        
        # Create outsider (not a friend)
        self.outsider_user = UserAccount.objects.create_user(
            username='outsider',
            email='outsider@example.com',
            password='testpass123'
        )
        self.outsider_profile = Profile.objects.get(user=self.outsider_user)
        self.outsider_token = Token.objects.create(user=self.outsider_user)
        
        # Create a friendship between user1 and user2
        # Friendship model enforces user1.id < user2.id ordering
        if self.profile1.id < self.profile2.id:
            self.friendship = Friendship.objects.create(
                user1=self.profile1,
                user2=self.profile2
            )
        else:
            self.friendship = Friendship.objects.create(
                user1=self.profile2,
                user2=self.profile1
            )

    # ========================================================================
    # GET /friends/{id}/messages/ Tests
    # ========================================================================

    def test_list_messages_empty(self):
        """Test GET /friends/{id}/messages/ returns empty list when no messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get(f'/api/v1/friends/{self.friendship.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data'], [])

    def test_list_messages_with_data(self):
        """Test GET /friends/{id}/messages/ returns messages."""
        # Create some messages
        FriendMessage.objects.create(
            friendship=self.friendship,
            sender=self.profile1,
            content='Hello friend!'
        )
        FriendMessage.objects.create(
            friendship=self.friendship,
            sender=self.profile2,
            content='Hi there!'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get(f'/api/v1/friends/{self.friendship.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 2)

    def test_list_messages_ordered_by_created_at(self):
        """Test messages are returned in chronological order."""
        msg1 = FriendMessage.objects.create(
            friendship=self.friendship,
            sender=self.profile1,
            content='First message'
        )
        msg2 = FriendMessage.objects.create(
            friendship=self.friendship,
            sender=self.profile2,
            content='Second message'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get(f'/api/v1/friends/{self.friendship.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data'][0]['content'], 'First message')
        self.assertEqual(response.data['data'][1]['content'], 'Second message')

    def test_list_messages_requires_authentication(self):
        """Test GET /friends/{id}/messages/ requires authentication."""
        response = self.client.get(f'/api/v1/friends/{self.friendship.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_messages_non_friend_forbidden(self):
        """Test non-friends cannot view messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.outsider_token.key}')
        response = self.client.get(f'/api/v1/friends/{self.friendship.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_messages_friendship_not_found(self):
        """Test 404 for non-existent friendship."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/friends/00000000-0000-0000-0000-000000000000/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_messages_as_user2(self):
        """Test user2 can also view messages."""
        FriendMessage.objects.create(
            friendship=self.friendship,
            sender=self.profile1,
            content='Hello!'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token2.key}')
        response = self.client.get(f'/api/v1/friends/{self.friendship.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)

    # ========================================================================
    # POST /friends/{id}/messages/ Tests
    # ========================================================================

    def test_send_message_success(self):
        """Test POST /friends/{id}/messages/ creates a message."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': 'Hey, want to meet up?'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['content'], 'Hey, want to meet up?')
        self.assertEqual(FriendMessage.objects.count(), 1)

    def test_send_message_as_user2(self):
        """Test user2 can send messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token2.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': 'Sure, sounds great!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_send_message_empty_content_rejected(self):
        """Test empty message content is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': ''},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message_missing_content_rejected(self):
        """Test missing content field is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message_non_friend_forbidden(self):
        """Test non-friends cannot send messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.outsider_token.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': 'Can I join?'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_send_message_requires_authentication(self):
        """Test POST /friends/{id}/messages/ requires authentication."""
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_send_message_friendship_not_found(self):
        """Test 404 for non-existent friendship."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            '/api/v1/friends/00000000-0000-0000-0000-000000000000/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_send_message_max_length(self):
        """Test message content respects max length."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        # FriendMessage has max_length=1000
        long_content = 'A' * 1000
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': long_content},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_send_message_over_max_length_rejected(self):
        """Test message content over max length is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        long_content = 'A' * 1001
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': long_content},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ========================================================================
    # Message Response Format Tests
    # ========================================================================

    def test_message_response_includes_sender_info(self):
        """Test message response includes sender profile info."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': 'Test message'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('sender', response.data['data'])
        self.assertEqual(response.data['data']['sender']['id'], str(self.profile1.id))

    def test_message_response_includes_timestamp(self):
        """Test message response includes created_at timestamp."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': 'Test message'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('created_at', response.data['data'])

    def test_message_response_includes_is_read(self):
        """Test message response includes is_read field."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/friends/{self.friendship.id}/messages/',
            {'content': 'Test message'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('is_read', response.data['data'])
        self.assertFalse(response.data['data']['is_read'])
