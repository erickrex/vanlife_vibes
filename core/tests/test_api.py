"""
Tests for API endpoints
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from core.models import UserAccount


class AuthAPITestCase(TestCase):
    """Test authentication endpoints"""

    def setUp(self):
        self.client = APIClient()

    def test_signup(self):
        """Test user registration"""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123',
            'password_confirm': 'testpass123'
        }
        response = self.client.post('/api/v1/auth/signup/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data['data'])
        self.assertIn('user', response.data['data'])

    def test_login(self):
        """Test user login"""
        # Create user
        user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # Login
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post('/api/v1/auth/login/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data['data'])

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        data = {
            'username': 'nonexistent',
            'password': 'wrongpass'
        }
        response = self.client.post('/api/v1/auth/login/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)



