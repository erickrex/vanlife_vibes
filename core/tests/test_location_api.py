"""
Tests for Location API endpoints.

Tests the LocationViewSet which provides:
- GET /locations/countries/ - List all countries
- GET /locations/cities/ - List cities for autocomplete
"""
import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from core.models import UserAccount, Country


class LocationCountriesAPITestCase(TestCase):
    """Test /locations/countries/ endpoint"""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create test countries (use get_or_create since data migration may have seeded them)
        self.usa, _ = Country.objects.get_or_create(code='US', defaults={'name': 'United States'})
        self.canada, _ = Country.objects.get_or_create(code='CA', defaults={'name': 'Canada'})
        self.mexico, _ = Country.objects.get_or_create(code='MX', defaults={'name': 'Mexico'})

    def test_get_countries_returns_all(self):
        """Test GET /locations/countries/ returns all countries"""
        response = self.client.get('/api/v1/locations/countries/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        # Should return at least the test countries (data migration may have seeded more)
        self.assertGreaterEqual(len(response.data['data']), 3)
        # Verify our test countries are in the response
        country_codes = [c['code'] for c in response.data['data']]
        self.assertIn('US', country_codes)

    def test_get_countries_requires_authentication(self):
        """Test GET /locations/countries/ requires authentication"""
        self.client.logout()
        response = self.client.get('/api/v1/locations/countries/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

