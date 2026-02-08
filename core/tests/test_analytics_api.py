"""
Tests for analytics event ingestion API.
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import AnalyticsEvent, UserAccount


class AnalyticsEventAPITestCase(TestCase):
    """Test lightweight analytics event tracking endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='analytics_user',
            email='analytics@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_track_event_success(self):
        """Authenticated users can track analytics events."""
        payload = {
            'event_name': 'welcome_viewed',
            'metadata': {
                'source': 'welcome',
                'variant': 'v1',
            },
        }
        response = self.client.post('/api/v1/analytics/events/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['event_name'], 'welcome_viewed')
        self.assertEqual(response.data['data']['metadata']['source'], 'welcome')

        event = AnalyticsEvent.objects.get(id=response.data['data']['id'])
        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.profile_id, self.user.profile.id)
        self.assertEqual(event.metadata['variant'], 'v1')

    def test_track_event_requires_authentication(self):
        """Unauthenticated requests are rejected."""
        self.client.force_authenticate(user=None)
        response = self.client.post(
            '/api/v1/analytics/events/',
            {'event_name': 'welcome_viewed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_track_event_metadata_must_be_object(self):
        """Reject non-object metadata payloads."""
        response = self.client.post(
            '/api/v1/analytics/events/',
            {
                'event_name': 'welcome_profile_click',
                'metadata': ['not', 'an', 'object'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('metadata', response.data['errors'])

