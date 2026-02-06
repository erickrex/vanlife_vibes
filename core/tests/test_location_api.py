"""
Tests for Location API endpoints.

Tests the LocationViewSet which provides:
- GET /locations/countries/ - List all countries
- GET /locations/regions/ - List regions (optionally filtered by country)
"""
import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from core.models import UserAccount, Country, Region


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


class LocationRegionsAPITestCase(TestCase):
    """Test /locations/regions/ endpoint"""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create test countries and regions (use get_or_create since data migration may have seeded them)
        self.usa, _ = Country.objects.get_or_create(code='US', defaults={'name': 'United States'})
        self.canada, _ = Country.objects.get_or_create(code='CA', defaults={'name': 'Canada'})
        
        # US regions
        self.california, _ = Region.objects.get_or_create(country=self.usa, name='California')
        self.oregon, _ = Region.objects.get_or_create(country=self.usa, name='Oregon')
        self.washington, _ = Region.objects.get_or_create(country=self.usa, name='Washington')
        
        # Canadian regions
        self.bc, _ = Region.objects.get_or_create(country=self.canada, name='British Columbia')
        self.alberta, _ = Region.objects.get_or_create(country=self.canada, name='Alberta')

    def test_get_regions_returns_all(self):
        """Test GET /locations/regions/ returns all regions"""
        response = self.client.get('/api/v1/locations/regions/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        # Should return at least the test regions (data migration may have seeded more)
        self.assertGreaterEqual(len(response.data['data']), 5)

    def test_get_regions_filtered_by_country(self):
        """Test GET /locations/regions/?country={id} filters by country"""
        response = self.client.get(f'/api/v1/locations/regions/?country={self.usa.id}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return at least our 3 test US regions (data migration may have seeded more)
        self.assertGreaterEqual(len(response.data['data']), 3)
        
        # All regions should be from USA
        for region in response.data['data']:
            self.assertEqual(region['country']['code'], 'US')

    def test_get_regions_invalid_country_id(self):
        """Test filtering with invalid country ID returns error"""
        response = self.client.get('/api/v1/locations/regions/?country=invalid-uuid')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_regions_requires_authentication(self):
        """Test GET /locations/regions/ requires authentication"""
        self.client.logout()
        response = self.client.get('/api/v1/locations/regions/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

