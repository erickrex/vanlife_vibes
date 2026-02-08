"""
Tests for Activity message endpoints.

These tests cover the messages action on ActivityViewSet which will be
affected by the planned refactoring to extract a reusable MessageableMixin.
"""
import pytest
from datetime import date, timedelta
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from core.models import (
    UserAccount, Profile, Activity, ActivitySwipe, ActivityMatch, ActivityMessage
)


@pytest.mark.django_db
class ActivityMessageAPITestCase(TestCase):
    """Test cases for Activity message endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create activity creator
        self.creator_user = UserAccount.objects.create_user(
            username='creator',
            email='creator@example.com',
            password='testpass123'
        )
        self.creator_profile = Profile.objects.get(user=self.creator_user)
        
        # Create participant
        self.participant_user = UserAccount.objects.create_user(
            username='participant',
            email='participant@example.com',
            password='testpass123'
        )
        self.participant_profile = Profile.objects.get(user=self.participant_user)
        
        # Create non-participant
        self.outsider_user = UserAccount.objects.create_user(
            username='outsider',
            email='outsider@example.com',
            password='testpass123'
        )
        self.outsider_profile = Profile.objects.get(user=self.outsider_user)
        
        # Create an activity
        self.activity = Activity.objects.create(
            created_by=self.creator_profile,
            title='Morning Hike',
            activity_type='hiking',
            description='A nice morning hike',
            spots=2,
            activity_date=date.today() + timedelta(days=3),
            time_window='morning',
            location='Moab, UT',
            status='matched'
        )
        
        # Create a match with both users as attendees
        self.activity_match = ActivityMatch.objects.create(activity=self.activity)
        self.activity_match.attendees.add(self.creator_profile, self.participant_profile)

    # ========================================================================
    # GET /activities/{id}/messages/ Tests
    # ========================================================================

    def test_list_messages_empty(self):
        """Test GET /activities/{id}/messages/ returns empty list when no messages."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.get(f'/api/v1/activities/{self.activity.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data'], [])

    def test_list_messages_with_data(self):
        """Test GET /activities/{id}/messages/ returns messages."""
        # Create some messages
        msg1 = ActivityMessage.objects.create(
            activity_match=self.activity_match,
            sender=self.creator_profile,
            content='Hello everyone!'
        )
        msg2 = ActivityMessage.objects.create(
            activity_match=self.activity_match,
            sender=self.participant_profile,
            content='Hi there!'
        )
        
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.get(f'/api/v1/activities/{self.activity.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 2)

    def test_list_messages_ordered_by_created_at(self):
        """Test messages are returned in chronological order."""
        msg1 = ActivityMessage.objects.create(
            activity_match=self.activity_match,
            sender=self.creator_profile,
            content='First message'
        )
        msg2 = ActivityMessage.objects.create(
            activity_match=self.activity_match,
            sender=self.participant_profile,
            content='Second message'
        )
        
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.get(f'/api/v1/activities/{self.activity.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data'][0]['content'], 'First message')
        self.assertEqual(response.data['data'][1]['content'], 'Second message')

    def test_list_messages_requires_authentication(self):
        """Test GET /activities/{id}/messages/ requires authentication."""
        response = self.client.get(f'/api/v1/activities/{self.activity.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_messages_non_attendee_forbidden(self):
        """Test non-attendees cannot view messages."""
        self.client.force_authenticate(user=self.outsider_user)
        response = self.client.get(f'/api/v1/activities/{self.activity.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_messages_activity_not_found(self):
        """Test 404 for non-existent activity."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.get('/api/v1/activities/00000000-0000-0000-0000-000000000000/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_messages_unmatched_activity_rejected(self):
        """Test cannot view messages for unmatched activity."""
        # Create an unmatched activity
        unmatched_activity = Activity.objects.create(
            created_by=self.creator_profile,
            title='Unmatched Activity',
            activity_type='coffee',
            spots=2,
            activity_date=date.today() + timedelta(days=5),
            time_window='morning',
            location='Denver, CO',
            status='open'
        )
        
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.get(f'/api/v1/activities/{unmatched_activity.id}/messages/')
        
        # API returns 400 when activity has no match
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ========================================================================
    # POST /activities/{id}/messages/ Tests
    # ========================================================================

    def test_send_message_success(self):
        """Test POST /activities/{id}/messages/ creates a message."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': 'Looking forward to the hike!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['content'], 'Looking forward to the hike!')
        self.assertEqual(ActivityMessage.objects.count(), 1)

    def test_send_message_as_participant(self):
        """Test participant can send messages."""
        self.client.force_authenticate(user=self.participant_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': 'Me too!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_send_message_empty_content_rejected(self):
        """Test empty message content is rejected."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': ''},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message_whitespace_only_rejected(self):
        """Test whitespace-only message content is rejected."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': '   '},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message_missing_content_rejected(self):
        """Test missing content field is rejected."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message_non_attendee_forbidden(self):
        """Test non-attendees cannot send messages."""
        self.client.force_authenticate(user=self.outsider_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': 'Can I join?'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_send_message_requires_authentication(self):
        """Test POST /activities/{id}/messages/ requires authentication."""
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_send_message_activity_not_found(self):
        """Test 404 for non-existent activity."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            '/api/v1/activities/00000000-0000-0000-0000-000000000000/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_send_message_unmatched_activity_rejected(self):
        """Test cannot send messages to unmatched activity."""
        unmatched_activity = Activity.objects.create(
            created_by=self.creator_profile,
            title='Unmatched Activity',
            activity_type='coffee',
            spots=2,
            activity_date=date.today() + timedelta(days=5),
            time_window='morning',
            location='Denver, CO',
            status='open'
        )
        
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            f'/api/v1/activities/{unmatched_activity.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        # API returns 400 when activity has no match
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message_max_length(self):
        """Test message content respects max length."""
        self.client.force_authenticate(user=self.creator_user)
        # ActivityMessage has max_length=500
        long_content = 'A' * 500
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': long_content},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_send_message_over_max_length_rejected(self):
        """Test message content over max length is rejected."""
        self.client.force_authenticate(user=self.creator_user)
        long_content = 'A' * 501
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': long_content},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ========================================================================
    # Message Response Format Tests
    # ========================================================================

    def test_message_response_includes_sender_info(self):
        """Test message response includes sender profile info."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': 'Test message'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('sender', response.data['data'])
        self.assertEqual(response.data['data']['sender']['id'], str(self.creator_profile.id))

    def test_message_response_includes_timestamp(self):
        """Test message response includes created_at timestamp."""
        self.client.force_authenticate(user=self.creator_user)
        response = self.client.post(
            f'/api/v1/activities/{self.activity.id}/messages/',
            {'content': 'Test message'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('created_at', response.data['data'])
