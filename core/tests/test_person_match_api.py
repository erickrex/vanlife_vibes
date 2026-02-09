"""
Tests for PersonMatchViewSet API endpoints.

Tests the following endpoints:
- GET /matches/ - list user's matches
- GET /matches/{id}/ - get match details
- DELETE /matches/{id}/ - unmatch
- GET /matches/{id}/messages/ - list messages
- POST /matches/{id}/messages/ - send message
- POST /matches/{id}/messages/mini-card/ - share mini-card
- POST /matches/{id}/messages/icebreaker/ - send icebreaker
"""
import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from core.models import UserAccount, Profile, PersonMatch, DirectMessage


@pytest.mark.django_db
class TestPersonMatchViewSet(TestCase):
    """Test cases for PersonMatchViewSet endpoints."""
    
    def setUp(self):
        """Set up test data."""
        # Create test users
        self.user1 = UserAccount.objects.create_user(
            username='testuser1',
            email='test1@test.com',
            password='testpass123'
        )
        self.user2 = UserAccount.objects.create_user(
            username='testuser2',
            email='test2@test.com',
            password='testpass123'
        )
        self.user3 = UserAccount.objects.create_user(
            username='testuser3',
            email='test3@test.com',
            password='testpass123'
        )
        
        # Get profiles (auto-created by signal)
        self.profile1 = self.user1.profile
        self.profile2 = self.user2.profile
        self.profile3 = self.user3.profile
        
        # Create a match between user1 and user2
        self.match = PersonMatch.objects.create(
            user1=self.profile1,
            user2=self.profile2,
            mode='dating'
        )
        
        # Create another match between user1 and user3
        self.match2 = PersonMatch.objects.create(
            user1=self.profile1,
            user2=self.profile3,
            mode='friends'
        )
        
        # Get token for user1
        self.token, _ = Token.objects.get_or_create(user=self.user1)
        
        # Set up API client
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)
    
    def test_list_matches(self):
        """Test GET /matches/ returns user's matches."""
        response = self.client.get('/api/v1/matches/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(len(response.json()['data']), 2)
    
    def test_list_matches_unauthenticated(self):
        """Test GET /matches/ requires authentication."""
        client = APIClient()
        response = client.get('/api/v1/matches/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_retrieve_match(self):
        """Test GET /matches/{id}/ returns match details."""
        response = self.client.get(f'/api/v1/matches/{self.match.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(response.json()['data']['id'], str(self.match.id))
        self.assertEqual(response.json()['data']['mode'], 'dating')
    
    def test_retrieve_match_not_found(self):
        """Test GET /matches/{id}/ returns 404 for non-existent match."""
        import uuid
        response = self.client.get(f'/api/v1/matches/{uuid.uuid4()}/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_retrieve_match_access_denied(self):
        """Test GET /matches/{id}/ returns 404 for match user is not part of."""
        # Create a match between user2 and user3 (user1 is not part of it)
        other_match = PersonMatch.objects.create(
            user1=self.profile2,
            user2=self.profile3,
            mode='dating'
        )
        
        response = self.client.get(f'/api/v1/matches/{other_match.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_unmatch(self):
        """Test DELETE /matches/{id}/ deactivates the match."""
        response = self.client.delete(f'/api/v1/matches/{self.match.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'success')
        
        # Verify match is inactive
        self.match.refresh_from_db()
        self.assertFalse(self.match.is_active)
    
    def test_unmatch_already_inactive(self):
        """Test DELETE /matches/{id}/ returns error for already inactive match."""
        # First unmatch
        self.match.is_active = False
        self.match.save()
        
        response = self.client.delete(f'/api/v1/matches/{self.match.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_send_message(self):
        """Test POST /matches/{id}/messages/ sends a message."""
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(response.json()['data']['content'], 'Hello!')
        self.assertEqual(response.json()['data']['message_type'], 'text')
        
        # Verify message was created
        self.assertEqual(DirectMessage.objects.filter(match=self.match).count(), 1)
    
    def test_send_message_empty_content(self):
        """Test POST /matches/{id}/messages/ rejects empty content."""
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/',
            {'content': ''},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_send_message_to_inactive_match(self):
        """Test POST /matches/{id}/messages/ rejects messages to inactive match."""
        self.match.is_active = False
        self.match.save()
        
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/',
            {'content': 'Should fail'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_list_messages(self):
        """Test GET /matches/{id}/messages/ returns messages."""
        # Create some messages
        DirectMessage.objects.create(
            match=self.match,
            sender=self.profile1,
            content='Hello!'
        )
        DirectMessage.objects.create(
            match=self.match,
            sender=self.profile2,
            content='Hi there!'
        )
        
        response = self.client.get(f'/api/v1/matches/{self.match.id}/messages/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(len(response.json()['data']), 2)
    
    def test_send_mini_card(self):
        """Test POST /matches/{id}/messages/mini-card/ sends a mini-card."""
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/mini-card/',
            {
                'current_location': 'Austin, TX',
                'in_town_until': '2024-12-31',
                'meet_preference': 'Coffee or hike'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(response.json()['data']['message_type'], 'mini_card')
        self.assertIsNotNone(response.json()['data']['mini_card_data'])
        self.assertEqual(
            response.json()['data']['mini_card_data']['current_location'],
            'Austin, TX'
        )
    
    def test_send_mini_card_partial(self):
        """Test POST /matches/{id}/messages/mini-card/ works with partial data."""
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/mini-card/',
            {'current_location': 'Denver, CO'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')
    
    def test_send_mini_card_empty(self):
        """Test POST /matches/{id}/messages/mini-card/ rejects empty data."""
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/mini-card/',
            {},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_send_mini_card_invalid_date(self):
        """Test POST /matches/{id}/messages/mini-card/ rejects invalid date."""
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/mini-card/',
            {'in_town_until': 'not-a-date'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_send_mini_card_to_inactive_match(self):
        """Test POST /matches/{id}/messages/mini-card/ rejects inactive match."""
        self.match.is_active = False
        self.match.save()
        
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/mini-card/',
            {'current_location': 'Austin, TX'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_icebreaker(self):
        """Test POST /matches/{id}/messages/icebreaker/ sends an icebreaker message."""
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/messages/icebreaker/',
            {'content': 'Want to explore downtown later this afternoon?'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(response.json()['data']['message_type'], 'icebreaker')
        self.assertEqual(
            response.json()['data']['content'],
            'Want to explore downtown later this afternoon?'
        )
    
    def test_inactive_matches_not_listed(self):
        """Test GET /matches/ excludes inactive matches."""
        # Deactivate one match
        self.match.is_active = False
        self.match.save()
        
        response = self.client.get('/api/v1/matches/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()['data']), 1)
        self.assertEqual(response.json()['data'][0]['id'], str(self.match2.id))



class TestReportFunctionality(TestCase):
    """Tests for report functionality."""
    
    def setUp(self):
        """Set up test data"""
        # Create users (profiles are auto-created by signal)
        self.user1 = UserAccount.objects.create_user(
            username='blocker',
            email='blocker@test.com',
            password='testpass123'
        )
        self.user2 = UserAccount.objects.create_user(
            username='blocked',
            email='blocked@test.com',
            password='testpass123'
        )
        self.user3 = UserAccount.objects.create_user(
            username='other',
            email='other@test.com',
            password='testpass123'
        )
        
        # Get auto-created profiles and update them
        self.profile1 = self.user1.profile
        self.profile1.display_name = 'Blocker'
        self.profile1.looking_for_dating = True
        self.profile1.looking_for_friends = True
        self.profile1.save()
        
        self.profile2 = self.user2.profile
        self.profile2.display_name = 'Blocked'
        self.profile2.looking_for_dating = True
        self.profile2.looking_for_friends = True
        self.profile2.save()
        
        self.profile3 = self.user3.profile
        self.profile3.display_name = 'Other'
        self.profile3.looking_for_dating = True
        self.profile3.looking_for_friends = True
        self.profile3.save()
        
        # Create a match between user1 and user2
        self.match = PersonMatch.objects.create(
            user1=self.profile1,
            user2=self.profile2,
            mode='dating',
            is_active=True
        )
        
        # Create auth tokens
        self.token1 = Token.objects.create(user=self.user1)
        self.token2 = Token.objects.create(user=self.user2)
        self.token3 = Token.objects.create(user=self.user3)
        
        self.client = APIClient()
    
    def test_report_user_success(self):
        """Test reporting a user from a match"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/report/',
            {
                'reason': 'harassment',
                'description': 'This user sent inappropriate messages.'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['message'], 'Report submitted successfully')
        
        # Verify report was created
        from core.models import UserReport
        report = UserReport.objects.filter(
            reporter=self.profile1,
            reported=self.profile2
        ).first()
        self.assertIsNotNone(report)
        self.assertEqual(report.reason, 'harassment')
        self.assertEqual(report.description, 'This user sent inappropriate messages.')
    
    def test_report_user_without_description(self):
        """Test reporting a user without a description"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/report/',
            {'reason': 'spam'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify report was created
        from core.models import UserReport
        report = UserReport.objects.filter(
            reporter=self.profile1,
            reported=self.profile2
        ).first()
        self.assertIsNotNone(report)
        self.assertEqual(report.reason, 'spam')
        self.assertEqual(report.description, '')
    
    def test_report_user_invalid_reason(self):
        """Test reporting a user with an invalid reason"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/report/',
            {'reason': 'invalid_reason'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
    
    def test_report_user_missing_reason(self):
        """Test reporting a user without a reason"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        
        response = self.client.post(
            f'/api/v1/matches/{self.match.id}/report/',
            {'description': 'Some description'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
