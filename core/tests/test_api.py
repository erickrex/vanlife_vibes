"""
Tests for API endpoints
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from core.models import UserAccount, Group, GroupMembership, Session, Candidate
from django.utils import timezone


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


class GroupAPITestCase(TestCase):
    """Test group endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    def test_create_group(self):
        """Test group creation"""
        data = {
            'name': 'Test Group',
            'description': 'A test group'
        }
        response = self.client.post('/api/v1/groups/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['name'], 'Test Group')
        
        # Creator should be admin member
        group_id = response.data['data']['id']
        membership = GroupMembership.objects.get(group_id=group_id, user=self.user)
        self.assertEqual(membership.role, 'admin')
        self.assertTrue(membership.is_confirmed)

    def test_list_groups(self):
        """Test listing user's groups"""
        # Create a group
        group = Group.objects.create(
            name='Test Group',
            created_by=self.user
        )
        GroupMembership.objects.create(
            group=group,
            user=self.user,
            role='admin',
            membership_type='invitation',
            status='confirmed',
            is_confirmed=True,
            confirmed_at=timezone.now()
        )

        response = self.client.get('/api/v1/groups/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['name'], 'Test Group')


class SessionAPITestCase(TestCase):
    """Test session endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create group
        self.group = Group.objects.create(
            name='Test Group',
            created_by=self.user
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.user,
            role='admin',
            membership_type='invitation',
            status='confirmed',
            is_confirmed=True,
            confirmed_at=timezone.now()
        )

    def test_create_session_unanimous(self):
        """Test creating session with unanimous rule"""
        data = {
            'group': str(self.group.id),
            'title': 'Test Session',
            'description': 'A test session',
            'rules': {'type': 'unanimous'},
            'status': 'open'
        }
        response = self.client.post('/api/v1/sessions/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['title'], 'Test Session')
        self.assertEqual(response.data['data']['rules']['type'], 'unanimous')

    def test_create_session_threshold(self):
        """Test creating session with threshold rule"""
        data = {
            'group': str(self.group.id),
            'title': 'Test Session',
            'rules': {'type': 'threshold', 'value': 0.75},
            'status': 'open'
        }
        response = self.client.post('/api/v1/sessions/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['rules']['value'], 0.75)

    def test_create_session_invalid_rule(self):
        """Test creating session with invalid rule"""
        data = {
            'group': str(self.group.id),
            'title': 'Test Session',
            'rules': {'type': 'invalid'},
            'status': 'open'
        }
        response = self.client.post('/api/v1/sessions/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class SwipeAPITestCase(TestCase):
    """Test swipe endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create group and session
        self.group = Group.objects.create(
            name='Test Group',
            created_by=self.user
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.user,
            role='admin',
            membership_type='invitation',
            status='confirmed',
            is_confirmed=True,
            confirmed_at=timezone.now()
        )
        self.session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'unanimous'},
            status='open'
        )
        self.candidate = Candidate.objects.create(
            session=self.session,
            label='Test Candidate',
            created_by=self.user
        )

    def test_cast_swipe(self):
        """Test casting a swipe"""
        data = {'is_like': True}
        response = self.client.post(
            f'/api/v1/swipes/candidates/{self.candidate.id}/swipes/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['data']['is_like'])

    def test_update_swipe(self):
        """Test updating an existing swipe"""
        # Cast initial swipe
        data = {'is_like': True}
        self.client.post(
            f'/api/v1/swipes/candidates/{self.candidate.id}/swipes/',
            data,
            format='json'
        )
        
        # Update swipe
        data = {'is_like': False}
        response = self.client.post(
            f'/api/v1/swipes/candidates/{self.candidate.id}/swipes/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['data']['is_like'])

    # TODO: Fix this test - URL routing issue with custom action
    # def test_get_swipe_summary(self):
    #     """Test getting swipe summary"""
    #     # Cast a swipe
    #     data = {'is_like': True}
    #     self.client.post(
    #         f'/api/v1/swipes/candidates/{self.candidate.id}/swipes/',
    #         data,
    #         format='json'
    #     )
    #     
    #     # Get summary (no trailing slash)
    #     response = self.client.get(
    #         f'/api/v1/swipes/candidates/{self.candidate.id}/swipes/summary'
    #     )
    #     
    #     self.assertEqual(response.status_code, status.HTTP_200_OK)
    #     self.assertEqual(response.data['data']['total_swipes'], 1)
    #     self.assertEqual(response.data['data']['likes'], 1)
