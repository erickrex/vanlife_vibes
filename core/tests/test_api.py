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


class FriendAPITestCase(TestCase):
    """Test friend request and friendship endpoints"""

    def setUp(self):
        self.client = APIClient()
        # Create users with profiles
        self.user1 = UserAccount.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = UserAccount.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
        self.user3 = UserAccount.objects.create_user(
            username='user3',
            email='user3@example.com',
            password='testpass123'
        )
        # Profiles are auto-created via signal
        self.profile1 = self.user1.profile
        self.profile2 = self.user2.profile
        self.profile3 = self.user3.profile
        
        self.client.force_authenticate(user=self.user1)

    def test_send_friend_request(self):
        """Test sending a friend request"""
        data = {'to_user_id': str(self.profile2.id)}
        response = self.client.post('/api/v1/friends/request/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['status'], 'pending')
        self.assertEqual(response.data['data']['from_user']['id'], str(self.profile1.id))
        self.assertEqual(response.data['data']['to_user']['id'], str(self.profile2.id))

    def test_send_friend_request_sender_intent_disabled(self):
        """
        Test that sending a friend request fails when sender has looking_for_friends=False.
        """
        # Disable friend intent for sender
        self.profile1.looking_for_friends = False
        self.profile1.looking_for_dating = True  # Keep at least one intent enabled
        self.profile1.save()
        
        data = {'to_user_id': str(self.profile2.id)}
        response = self.client.post('/api/v1/friends/request/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(
            response.data['message'],
            'You must enable friend discovery to send friend requests'
        )

    def test_send_friend_request_target_intent_disabled(self):
        """
        Test that sending a friend request fails when target has looking_for_friends=False.
        """
        # Disable friend intent for target
        self.profile2.looking_for_friends = False
        self.profile2.looking_for_dating = True  # Keep at least one intent enabled
        self.profile2.save()
        
        data = {'to_user_id': str(self.profile2.id)}
        response = self.client.post('/api/v1/friends/request/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(
            response.data['message'],
            'This user is not accepting friend requests'
        )

    def test_send_friend_request_after_decline_reuses_request(self):
        """Test re-sending a friend request after decline reuses the record"""
        from core.models import FriendRequest
        from django.utils import timezone

        declined = FriendRequest.objects.create(
            from_user=self.profile1,
            to_user=self.profile2,
            status='declined',
            responded_at=timezone.now()
        )

        data = {'to_user_id': str(self.profile2.id)}
        response = self.client.post('/api/v1/friends/request/', data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['id'], str(declined.id))
        self.assertEqual(response.data['data']['status'], 'pending')
        self.assertIsNone(response.data['data']['responded_at'])
        self.assertEqual(FriendRequest.objects.filter(
            from_user=self.profile1,
            to_user=self.profile2
        ).count(), 1)

    def test_list_friend_requests_empty(self):
        """Test listing friend requests when none exist"""
        response = self.client.get('/api/v1/friends/requests/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['sent'], [])
        self.assertEqual(response.data['data']['received'], [])

    def test_list_friend_requests_sent(self):
        """Test listing sent friend requests"""
        # Send a friend request
        from core.models import FriendRequest
        FriendRequest.objects.create(
            from_user=self.profile1,
            to_user=self.profile2,
            status='pending'
        )
        
        response = self.client.get('/api/v1/friends/requests/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']['sent']), 1)
        self.assertEqual(len(response.data['data']['received']), 0)
        self.assertEqual(response.data['data']['sent'][0]['to_user']['id'], str(self.profile2.id))

    def test_list_friend_requests_received(self):
        """Test listing received friend requests"""
        # Create a friend request from user2 to user1
        from core.models import FriendRequest
        FriendRequest.objects.create(
            from_user=self.profile2,
            to_user=self.profile1,
            status='pending'
        )
        
        response = self.client.get('/api/v1/friends/requests/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']['sent']), 0)
        self.assertEqual(len(response.data['data']['received']), 1)
        self.assertEqual(response.data['data']['received'][0]['from_user']['id'], str(self.profile2.id))

    def test_accept_friend_request_success(self):
        """Test accepting a friend request successfully"""
        from core.models import FriendRequest, Friendship
        
        # Create a friend request from user2 to user1
        friend_request = FriendRequest.objects.create(
            from_user=self.profile2,
            to_user=self.profile1,
            status='pending'
        )
        
        # User1 accepts the request
        response = self.client.post(f'/api/v1/friends/requests/{friend_request.id}/accept/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['status'], 'accepted')
        self.assertIsNotNone(response.data['data']['responded_at'])
        
        # Verify Friendship was created
        self.assertTrue(Friendship.objects.filter(
            user1=self.profile1,
            user2=self.profile2
        ).exists() or Friendship.objects.filter(
            user1=self.profile2,
            user2=self.profile1
        ).exists())

    def test_accept_friend_request_not_found(self):
        """Test accepting a non-existent friend request returns 404"""
        import uuid
        fake_id = uuid.uuid4()
        
        response = self.client.post(f'/api/v1/friends/requests/{fake_id}/accept/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'Friend request not found')

    def test_accept_friend_request_not_recipient(self):
        """Test that only the recipient can accept a friend request"""
        from core.models import FriendRequest
        
        # Create a friend request from user1 to user2
        friend_request = FriendRequest.objects.create(
            from_user=self.profile1,
            to_user=self.profile2,
            status='pending'
        )
        
        # User1 (the sender) tries to accept - should fail
        response = self.client.post(f'/api/v1/friends/requests/{friend_request.id}/accept/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'You can only accept requests sent to you')

    def test_accept_friend_request_creates_friendship_with_correct_ordering(self):
        """Test that accepting a request creates a Friendship with user1 < user2"""
        from core.models import FriendRequest, Friendship
        
        # Create a friend request from user2 to user1
        friend_request = FriendRequest.objects.create(
            from_user=self.profile2,
            to_user=self.profile1,
            status='pending'
        )
        
        # User1 accepts the request
        response = self.client.post(f'/api/v1/friends/requests/{friend_request.id}/accept/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify Friendship was created with correct ordering (user1.id < user2.id)
        friendship = Friendship.objects.first()
        self.assertIsNotNone(friendship)
        self.assertLess(str(friendship.user1.id), str(friendship.user2.id))

    def test_decline_friend_request_success(self):
        """Test declining a friend request successfully"""
        from core.models import FriendRequest, Friendship
        
        # Create a friend request from user2 to user1
        friend_request = FriendRequest.objects.create(
            from_user=self.profile2,
            to_user=self.profile1,
            status='pending'
        )
        
        # User1 declines the request
        response = self.client.post(f'/api/v1/friends/requests/{friend_request.id}/decline/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['status'], 'declined')
        self.assertIsNotNone(response.data['data']['responded_at'])
        
        # Verify NO Friendship was created
        self.assertFalse(Friendship.objects.exists())

    def test_decline_friend_request_not_found(self):
        """Test declining a non-existent friend request returns 404"""
        import uuid
        fake_id = uuid.uuid4()
        
        response = self.client.post(f'/api/v1/friends/requests/{fake_id}/decline/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'Friend request not found')

    def test_decline_friend_request_not_recipient(self):
        """Test that only the recipient can decline a friend request"""
        from core.models import FriendRequest
        
        # Create a friend request from user1 to user2
        friend_request = FriendRequest.objects.create(
            from_user=self.profile1,
            to_user=self.profile2,
            status='pending'
        )
        
        # User1 (the sender) tries to decline - should fail
        response = self.client.post(f'/api/v1/friends/requests/{friend_request.id}/decline/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'You can only decline requests sent to you')

    def test_list_friends_empty(self):
        """Test listing friends when none exist"""
        response = self.client.get('/api/v1/friends/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data'], [])

    def test_list_friends_with_friendships(self):
        """Test listing friends returns all friendships"""
        from core.models import Friendship
        
        # Create friendships
        Friendship.objects.create(user1=self.profile1, user2=self.profile2)
        Friendship.objects.create(user1=self.profile1, user2=self.profile3)
        
        response = self.client.get('/api/v1/friends/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 2)
        
        # Verify friend field contains the other user's data
        friend_ids = [f['friend']['id'] for f in response.data['data']]
        self.assertIn(str(self.profile2.id), friend_ids)
        self.assertIn(str(self.profile3.id), friend_ids)

    def test_delete_friendship_success(self):
        """Test deleting a friendship successfully"""
        from core.models import Friendship
        
        # Create a friendship
        friendship = Friendship.objects.create(user1=self.profile1, user2=self.profile2)
        
        # User1 deletes the friendship
        response = self.client.delete(f'/api/v1/friends/{friendship.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['message'], 'Friendship removed successfully')
        
        # Verify friendship was deleted
        self.assertFalse(Friendship.objects.filter(id=friendship.id).exists())

    def test_delete_friendship_not_part_of(self):
        """Test that users not part of the friendship cannot delete it"""
        from core.models import Friendship
        
        # Create a friendship between user2 and user3
        friendship = Friendship.objects.create(user1=self.profile2, user2=self.profile3)
        
        # User1 (not part of the friendship) tries to delete it
        response = self.client.delete(f'/api/v1/friends/{friendship.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'You are not part of this friendship')
        
        # Verify friendship was NOT deleted
        self.assertTrue(Friendship.objects.filter(id=friendship.id).exists())

    def test_profile_friend_status_none_when_no_relationship(self):
        """Test that friend_status is 'none' when no relationship exists"""
        # User1 views user2's profile - no relationship exists
        response = self.client.get(f'/api/v1/profiles/{self.profile2.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['friend_status'], 'none')

    def test_profile_friend_status_friends(self):
        """Test that friend_status is 'friends' when users are friends"""
        from core.models import Friendship
        
        # Create a friendship between user1 and user2
        Friendship.objects.create(user1=self.profile1, user2=self.profile2)
        
        # User1 views user2's profile
        response = self.client.get(f'/api/v1/profiles/{self.profile2.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['friend_status'], 'friends')

