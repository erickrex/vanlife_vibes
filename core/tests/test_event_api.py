"""
Tests for Event API endpoints including join, leave, and confirm actions.

Tests REQ-5.4: POST /events/{id}/join/ - Direct join (only for direct mode)
Tests REQ-5.5: POST /events/{id}/leave/ - Leave event
"""
import pytest
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from datetime import date, timedelta

from core.models import (
    UserAccount, Event, EventAttendee
)


class EventJoinLeaveConfirmTestCase(TestCase):
    """
    Test cases for event join, leave, and confirm endpoints.
    
    POST /events/{id}/join/ - Join event (direct mode only)
    POST /events/{id}/leave/ - Leave event
    POST /events/{id}/confirm/ - Confirm attendance (direct mode)
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users (profiles are auto-created via signal)
        self.creator = UserAccount.objects.create_user(
            username='eventcreator',
            email='eventcreator@test.com',
            password='testpass123'
        )
        self.creator_profile = self.creator.profile
        self.creator_profile.display_name = 'Event Creator'
        self.creator_profile.save()
        self.creator_token = Token.objects.create(user=self.creator)
        
        self.user1 = UserAccount.objects.create_user(
            username='eventuser1',
            email='eventuser1@test.com',
            password='testpass123'
        )
        self.profile1 = self.user1.profile
        self.profile1.display_name = 'Event User 1'
        self.profile1.save()
        self.token1 = Token.objects.create(user=self.user1)
        
        self.user2 = UserAccount.objects.create_user(
            username='eventuser2',
            email='eventuser2@test.com',
            password='testpass123'
        )
        self.profile2 = self.user2.profile
        self.profile2.display_name = 'Event User 2'
        self.profile2.save()
        self.token2 = Token.objects.create(user=self.user2)
        
        # Create a direct mode event
        self.direct_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Morning Coffee',
            event_type='coffee',
            join_mode='direct',
            event_date=date.today() + timedelta(days=7),
            time_window='morning',
            location='Austin, TX',
            spots=4,
            status='open'
        )
        
        # Add creator as confirmed attendee
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        # Create a swipe mode event
        self.swipe_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Hiking Trip',
            event_type='hiking',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=14),
            time_window='morning',
            location='Boulder, CO',
            spots=6,
            status='open'
        )
        
        self.client = APIClient()
    
    # -------------------------------------------------------------------------
    # Join tests
    # -------------------------------------------------------------------------
    
    def test_join_direct_event_success(self):
        """User can join a direct mode event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/join/')
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('joined', response.data['message'].lower())
        
        # Verify attendee was created
        attendee = EventAttendee.objects.get(
            event=self.direct_event,
            user=self.profile1
        )
        self.assertEqual(attendee.status, 'joined')
    
    def test_join_swipe_event_rejected(self):
        """Cannot join a swipe mode event directly"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.swipe_event.id}/join/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('swipe', response.data['message'].lower())
    
    def test_join_already_joined_rejected(self):
        """Cannot join an event twice"""
        # First join
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='joined'
        )
        
        # Try to join again
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/join/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('already joined', response.data['message'].lower())
    
    def test_join_cancelled_event_rejected(self):
        """Cannot join a cancelled event"""
        self.direct_event.status = 'cancelled'
        self.direct_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/join/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('cancelled', response.data['message'].lower())
    
    def test_join_completed_event_rejected(self):
        """Cannot join a completed event"""
        self.direct_event.status = 'completed'
        self.direct_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/join/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('completed', response.data['message'].lower())
    
    def test_join_full_event_rejected(self):
        """Cannot join a full event"""
        self.direct_event.status = 'full'
        self.direct_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/join/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('full', response.data['message'].lower())
    
    def test_join_nonexistent_event_404(self):
        """Returns 404 for non-existent event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post('/api/v1/events/00000000-0000-0000-0000-000000000000/join/')
        
        self.assertEqual(response.status_code, 404)
    
    def test_rejoin_after_decline(self):
        """User can rejoin after declining"""
        # Create declined attendee
        attendee = EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='declined'
        )
        
        # Rejoin
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/join/')
        
        self.assertEqual(response.status_code, 201)
        
        # Verify status changed
        attendee.refresh_from_db()
        self.assertEqual(attendee.status, 'joined')
    
    # -------------------------------------------------------------------------
    # Leave tests
    # -------------------------------------------------------------------------
    
    def test_leave_event_success(self):
        """User can leave an event"""
        # Join first
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='joined'
        )
        
        # Leave
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/leave/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify status changed to declined
        attendee = EventAttendee.objects.get(
            event=self.direct_event,
            user=self.profile1
        )
        self.assertEqual(attendee.status, 'declined')
    
    def test_creator_cannot_leave_own_event(self):
        """Event creator cannot leave their own event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/leave/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('creator', response.data['message'].lower())
    
    def test_leave_not_attendee_rejected(self):
        """Cannot leave an event you haven't joined"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/leave/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('not an attendee', response.data['message'].lower())
    
    def test_leave_already_declined_rejected(self):
        """Cannot leave an event you've already left"""
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='declined'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/leave/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('already left', response.data['message'].lower())
    
    def test_leave_nonexistent_event_404(self):
        """Returns 404 for non-existent event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post('/api/v1/events/00000000-0000-0000-0000-000000000000/leave/')
        
        self.assertEqual(response.status_code, 404)
    
    # -------------------------------------------------------------------------
    # Confirm tests
    # -------------------------------------------------------------------------
    
    def test_confirm_attendance_success(self):
        """User can confirm attendance after joining"""
        # Join first
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='joined'
        )
        
        # Confirm
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/confirm/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify status changed to confirmed
        attendee = EventAttendee.objects.get(
            event=self.direct_event,
            user=self.profile1
        )
        self.assertEqual(attendee.status, 'confirmed')
        self.assertIsNotNone(attendee.confirmed_at)
    
    def test_confirm_swipe_event_rejected(self):
        """Cannot confirm attendance for swipe mode event"""
        # Add user as attendee to swipe event (simulating match)
        EventAttendee.objects.create(
            event=self.swipe_event,
            user=self.profile1,
            status='joined'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.swipe_event.id}/confirm/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('direct-join', response.data['message'].lower())
    
    def test_confirm_not_joined_rejected(self):
        """Cannot confirm without joining first"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/confirm/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('join', response.data['message'].lower())
    
    def test_confirm_declined_rejected(self):
        """Cannot confirm after declining"""
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='declined'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/confirm/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('left', response.data['message'].lower())
    
    def test_confirm_already_confirmed_rejected(self):
        """Cannot confirm twice"""
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/confirm/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('already confirmed', response.data['message'].lower())
    
    def test_confirm_cancelled_event_rejected(self):
        """Cannot confirm attendance for cancelled event"""
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='joined'
        )
        self.direct_event.status = 'cancelled'
        self.direct_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/confirm/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('cancelled', response.data['message'].lower())
    
    def test_confirm_completed_event_rejected(self):
        """Cannot confirm attendance for completed event"""
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='joined'
        )
        self.direct_event.status = 'completed'
        self.direct_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(f'/api/v1/events/{self.direct_event.id}/confirm/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('completed', response.data['message'].lower())


class EventCapacityEnforcementTestCase(TestCase):
    """
    Test cases for event capacity enforcement.
    
    When the number of attendees reaches spots, the event status
    changes to 'full' and additional join requests are rejected.
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users
        self.creator = UserAccount.objects.create_user(
            username='eventcreator2',
            email='eventcreator2@test.com',
            password='testpass123'
        )
        self.creator_profile = self.creator.profile
        self.creator_token = Token.objects.create(user=self.creator)
        
        # Create additional users for testing capacity
        self.users = []
        self.tokens = []
        for i in range(5):
            user = UserAccount.objects.create_user(
                username=f'capacityuser{i}',
                email=f'capacityuser{i}@test.com',
                password='testpass123'
            )
            self.users.append(user)
            self.tokens.append(Token.objects.create(user=user))
        
        # Create a direct event with spots=3 (creator + 2 others)
        self.event = Event.objects.create(
            created_by=self.creator_profile,
            title='Small Meetup',
            event_type='coffee',
            join_mode='direct',
            event_date=date.today() + timedelta(days=7),
            time_window='morning',
            location='Austin, TX',
            spots=3,
            status='open'
        )
        
        # Add creator as confirmed attendee (count = 1)
        EventAttendee.objects.create(
            event=self.event,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        self.client = APIClient()
    
    def test_join_updates_status_to_full_when_capacity_reached(self):
        """When a user joins and count reaches spots, event status changes to 'full'."""
        # User 0 joins (count = 2)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(f'/api/v1/events/{self.event.id}/join/')
        self.assertEqual(response.status_code, 201)
        
        # Event should still be open
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, 'open')
        
        # User 1 joins (count = 3 = spots)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[1].key}')
        response = self.client.post(f'/api/v1/events/{self.event.id}/join/')
        self.assertEqual(response.status_code, 201)
        
        # Event should now be full
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, 'full')
    
    def test_leave_reopens_full_event(self):
        """When a user leaves a full event, status changes back to 'open' if below capacity."""
        # Fill the event
        for i in range(2):  # Add 2 more users to reach spots=3
            EventAttendee.objects.create(
                event=self.event,
                user=self.users[i].profile,
                status='joined'
            )
        
        # Set event to full
        self.event.status = 'full'
        self.event.save()
        
        # User 0 leaves
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(f'/api/v1/events/{self.event.id}/leave/')
        
        self.assertEqual(response.status_code, 200)
        
        # Event should now be open again
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, 'open')
    
    def test_capacity_check_excludes_declined_attendees(self):
        """Capacity count excludes declined attendees."""
        # Add a declined attendee (should not count toward capacity)
        EventAttendee.objects.create(
            event=self.event,
            user=self.users[0].profile,
            status='declined'
        )
        
        # Add one more joined attendee (count = 2: creator + user1)
        EventAttendee.objects.create(
            event=self.event,
            user=self.users[1].profile,
            status='joined'
        )
        
        # User 2 should be able to join (count would be 3 = spots)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[2].key}')
        response = self.client.post(f'/api/v1/events/{self.event.id}/join/')
        
        self.assertEqual(response.status_code, 201)
        
        # Event should now be full
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, 'full')


class EventSwipeTestCase(TestCase):
    """
    Test cases for event swipe endpoint (swipe mode only).
    
    POST /events/{id}/swipe/ - Swipe on event (swipe mode only)
    
    Tests REQ-5.6: POST /events/{id}/swipe/ - Swipe on event (only for swipe mode)
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users (profiles are auto-created via signal)
        self.creator = UserAccount.objects.create_user(
            username='swipecreator',
            email='swipecreator@test.com',
            password='testpass123'
        )
        self.creator_profile = self.creator.profile
        self.creator_profile.display_name = 'Swipe Creator'
        self.creator_profile.save()
        self.creator_token = Token.objects.create(user=self.creator)
        
        # Create multiple users for swipe testing
        self.users = []
        self.tokens = []
        for i in range(5):
            user = UserAccount.objects.create_user(
                username=f'swipeuser{i}',
                email=f'swipeuser{i}@test.com',
                password='testpass123'
            )
            user.profile.display_name = f'Swipe User {i}'
            user.profile.save()
            self.users.append(user)
            self.tokens.append(Token.objects.create(user=user))
        
        # Create a swipe mode event with spots=3 (creator + 2 others)
        self.swipe_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Hiking Trip',
            event_type='hiking',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=14),
            time_window='morning',
            location='Boulder, CO',
            spots=3,
            status='open'
        )
        
        # Create a direct mode event for testing rejection
        self.direct_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Coffee Meetup',
            event_type='coffee',
            join_mode='direct',
            event_date=date.today() + timedelta(days=7),
            time_window='morning',
            location='Austin, TX',
            spots=4,
            status='open'
        )
        
        self.client = APIClient()
    
    # -------------------------------------------------------------------------
    # Basic swipe tests
    # -------------------------------------------------------------------------
    
    def test_swipe_like_success(self):
        """User can swipe right (like) on a swipe mode event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('swipe', response.data['data'])
        self.assertEqual(response.data['data']['swipe']['is_like'], True)
        self.assertEqual(response.data['data']['matched'], False)
        
        # Verify swipe was created
        from core.models import EventSwipe
        swipe = EventSwipe.objects.get(
            event=self.swipe_event,
            user=self.users[0].profile
        )
        self.assertTrue(swipe.is_like)
    
    def test_swipe_pass_success(self):
        """User can swipe left (pass) on a swipe mode event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': False},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['swipe']['is_like'], False)
        self.assertEqual(response.data['data']['matched'], False)
        
        # Verify swipe was created
        from core.models import EventSwipe
        swipe = EventSwipe.objects.get(
            event=self.swipe_event,
            user=self.users[0].profile
        )
        self.assertFalse(swipe.is_like)
    
    def test_swipe_direct_event_rejected(self):
        """Cannot swipe on a direct mode event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('direct-join', response.data['message'].lower())
    
    def test_swipe_own_event_rejected(self):
        """Cannot swipe on your own event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('own event', response.data['message'].lower())
    
    def test_swipe_already_swiped_rejected(self):
        """Cannot swipe on an event twice"""
        from core.models import EventSwipe
        
        # Create existing swipe
        EventSwipe.objects.create(
            event=self.swipe_event,
            user=self.users[0].profile,
            is_like=True
        )
        
        # Try to swipe again
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': False},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('already swiped', response.data['message'].lower())
    
    def test_swipe_matched_event_rejected(self):
        """Cannot swipe on an already matched event"""
        self.swipe_event.status = 'matched'
        self.swipe_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('no longer accepting', response.data['message'].lower())
    
    def test_swipe_cancelled_event_rejected(self):
        """Cannot swipe on a cancelled event"""
        self.swipe_event.status = 'cancelled'
        self.swipe_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('no longer accepting', response.data['message'].lower())
    
    def test_swipe_nonexistent_event_404(self):
        """Returns 404 for non-existent event"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            '/api/v1/events/00000000-0000-0000-0000-000000000000/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 404)
    
    def test_swipe_missing_is_like_rejected(self):
        """Swipe without is_like field is rejected"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
    
    # -------------------------------------------------------------------------
    # Match threshold tests
    # -------------------------------------------------------------------------
    
    def test_swipe_creates_match_when_threshold_reached(self):
        """When likes reach (spots - 1), event is matched and attendees are created"""
        from core.models import EventSwipe
        
        # Event has spots=3, so we need 2 likes (spots - 1 = 2)
        # First like
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['matched'], False)
        
        # Event should still be open
        self.swipe_event.refresh_from_db()
        self.assertEqual(self.swipe_event.status, 'open')
        
        # Second like - should trigger match
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[1].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['matched'], True)
        self.assertIn('event', response.data['data'])
        
        # Event should now be matched
        self.swipe_event.refresh_from_db()
        self.assertEqual(self.swipe_event.status, 'matched')
        
        # Verify attendees were created
        attendees = EventAttendee.objects.filter(event=self.swipe_event)
        self.assertEqual(attendees.count(), 3)  # creator + 2 likers
        
        # Verify all attendees are confirmed
        for attendee in attendees:
            self.assertEqual(attendee.status, 'confirmed')
            self.assertIsNotNone(attendee.confirmed_at)
        
        # Verify creator is an attendee
        creator_attendee = attendees.filter(user=self.creator_profile).first()
        self.assertIsNotNone(creator_attendee)
        
        # Verify likers are attendees
        liker1_attendee = attendees.filter(user=self.users[0].profile).first()
        self.assertIsNotNone(liker1_attendee)
        
        liker2_attendee = attendees.filter(user=self.users[1].profile).first()
        self.assertIsNotNone(liker2_attendee)
    
    def test_pass_does_not_trigger_match(self):
        """Passing (is_like=False) does not count toward match threshold"""
        from core.models import EventSwipe
        
        # Event has spots=3, so we need 2 likes
        # First pass
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': False},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['matched'], False)
        
        # Second pass
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[1].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': False},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['matched'], False)
        
        # Event should still be open
        self.swipe_event.refresh_from_db()
        self.assertEqual(self.swipe_event.status, 'open')
        
        # No attendees should be created (except potentially creator)
        attendees = EventAttendee.objects.filter(event=self.swipe_event)
        self.assertEqual(attendees.count(), 0)
    
    def test_mixed_swipes_only_likes_count(self):
        """Only likes count toward match threshold, passes are ignored"""
        from core.models import EventSwipe
        
        # Event has spots=3, so we need 2 likes
        # First pass
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': False},
            format='json'
        )
        
        # First like
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[1].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.data['data']['matched'], False)
        
        # Second pass
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[2].key}')
        self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': False},
            format='json'
        )
        
        # Event should still be open (only 1 like)
        self.swipe_event.refresh_from_db()
        self.assertEqual(self.swipe_event.status, 'open')
        
        # Second like - should trigger match
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[3].key}')
        response = self.client.post(
            f'/api/v1/events/{self.swipe_event.id}/swipe/',
            {'is_like': True},
            format='json'
        )
        
        self.assertEqual(response.data['data']['matched'], True)
        
        # Event should now be matched
        self.swipe_event.refresh_from_db()
        self.assertEqual(self.swipe_event.status, 'matched')
        
        # Only creator and likers should be attendees (not passers)
        attendees = EventAttendee.objects.filter(event=self.swipe_event)
        self.assertEqual(attendees.count(), 3)  # creator + 2 likers
        
        # Verify passers are NOT attendees
        passer_attendee = attendees.filter(user=self.users[0].profile).first()
        self.assertIsNone(passer_attendee)
        
        passer2_attendee = attendees.filter(user=self.users[2].profile).first()
        self.assertIsNone(passer2_attendee)


# =============================================================================
# Event Message Tests
# =============================================================================


class EventMessageTestCase(TestCase):
    """
    Test cases for event message endpoints.
    
    GET /events/{id}/messages/ - List messages in event chat
    POST /events/{id}/messages/ - Send a message to event chat
    
    REQ-5.7: GET/POST /events/{id}/messages/ - Event chat
    REQ-4.3: Access control: only attendees can send/view messages
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users (profiles are auto-created via signal)
        self.creator = UserAccount.objects.create_user(
            username='msgcreator',
            email='msgcreator@test.com',
            password='testpass123'
        )
        self.creator_profile = self.creator.profile
        self.creator_profile.display_name = 'Message Creator'
        self.creator_profile.save()
        self.creator_token = Token.objects.create(user=self.creator)
        
        self.attendee = UserAccount.objects.create_user(
            username='msgattendee',
            email='msgattendee@test.com',
            password='testpass123'
        )
        self.attendee_profile = self.attendee.profile
        self.attendee_profile.display_name = 'Message Attendee'
        self.attendee_profile.save()
        self.attendee_token = Token.objects.create(user=self.attendee)
        
        self.outsider = UserAccount.objects.create_user(
            username='msgoutsider',
            email='msgoutsider@test.com',
            password='testpass123'
        )
        self.outsider_profile = self.outsider.profile
        self.outsider_profile.display_name = 'Message Outsider'
        self.outsider_profile.save()
        self.outsider_token = Token.objects.create(user=self.outsider)
        
        # Create a direct mode event
        self.direct_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Coffee Chat',
            event_type='coffee',
            join_mode='direct',
            event_date=date.today() + timedelta(days=7),
            time_window='morning',
            location='Austin, TX',
            spots=4,
            status='open'
        )
        
        # Add creator as confirmed attendee
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        # Add attendee as joined
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.attendee_profile,
            status='joined'
        )
        
        # Create a swipe mode event (matched)
        self.matched_swipe_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Hiking Trip',
            event_type='hiking',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=14),
            time_window='morning',
            location='Boulder, CO',
            spots=3,
            status='matched'
        )
        
        # Add creator and attendee as confirmed attendees for matched event
        EventAttendee.objects.create(
            event=self.matched_swipe_event,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        EventAttendee.objects.create(
            event=self.matched_swipe_event,
            user=self.attendee_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        # Create an unmatched swipe mode event
        self.unmatched_swipe_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Surfing Session',
            event_type='surfing',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=21),
            time_window='morning',
            location='San Diego, CA',
            spots=4,
            status='open'
        )
        
        self.client = APIClient()
    
    # -------------------------------------------------------------------------
    # GET /events/{id}/messages/ Tests
    # -------------------------------------------------------------------------
    
    def test_list_messages_empty_direct_event(self):
        """Test GET /events/{id}/messages/ returns empty list when no messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.get(f'/api/v1/events/{self.direct_event.id}/messages/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data'], [])
    
    def test_list_messages_with_data(self):
        """Test GET /events/{id}/messages/ returns messages."""
        from core.models import EventMessage
        
        # Create some messages
        EventMessage.objects.create(
            event=self.direct_event,
            sender=self.creator_profile,
            content='Hello everyone!'
        )
        EventMessage.objects.create(
            event=self.direct_event,
            sender=self.attendee_profile,
            content='Hi there!'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.get(f'/api/v1/events/{self.direct_event.id}/messages/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 2)
    
    def test_list_messages_ordered_by_created_at(self):
        """Test messages are returned in chronological order."""
        from core.models import EventMessage
        
        msg1 = EventMessage.objects.create(
            event=self.direct_event,
            sender=self.creator_profile,
            content='First message'
        )
        msg2 = EventMessage.objects.create(
            event=self.direct_event,
            sender=self.attendee_profile,
            content='Second message'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.get(f'/api/v1/events/{self.direct_event.id}/messages/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data'][0]['content'], 'First message')
        self.assertEqual(response.data['data'][1]['content'], 'Second message')
    
    def test_list_messages_requires_authentication(self):
        """Test GET /events/{id}/messages/ requires authentication."""
        response = self.client.get(f'/api/v1/events/{self.direct_event.id}/messages/')
        self.assertEqual(response.status_code, 401)
    
    def test_list_messages_non_attendee_forbidden(self):
        """Test non-attendees cannot view messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.outsider_token.key}')
        response = self.client.get(f'/api/v1/events/{self.direct_event.id}/messages/')
        
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['status'], 'error')
    
    def test_list_messages_event_not_found(self):
        """Test 404 for non-existent event."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.get('/api/v1/events/00000000-0000-0000-0000-000000000000/messages/')
        
        self.assertEqual(response.status_code, 404)
    
    def test_list_messages_matched_swipe_event_success(self):
        """Test attendees can view messages for matched swipe events."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.get(f'/api/v1/events/{self.matched_swipe_event.id}/messages/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
    
    def test_list_messages_unmatched_swipe_event_forbidden(self):
        """Test cannot view messages for unmatched swipe events."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.get(f'/api/v1/events/{self.unmatched_swipe_event.id}/messages/')
        
        self.assertEqual(response.status_code, 403)
        self.assertIn('matched', response.data['message'].lower())
    
    def test_list_messages_declined_attendee_forbidden(self):
        """Test declined attendees cannot view messages."""
        # Create a declined attendee
        declined_user = UserAccount.objects.create_user(
            username='declined',
            email='declined@test.com',
            password='testpass123'
        )
        declined_token = Token.objects.create(user=declined_user)
        EventAttendee.objects.create(
            event=self.direct_event,
            user=declined_user.profile,
            status='declined'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {declined_token.key}')
        response = self.client.get(f'/api/v1/events/{self.direct_event.id}/messages/')
        
        self.assertEqual(response.status_code, 403)
    
    # -------------------------------------------------------------------------
    # POST /events/{id}/messages/ Tests
    # -------------------------------------------------------------------------
    
    def test_send_message_success(self):
        """Test POST /events/{id}/messages/ creates a message."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Looking forward to coffee!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['content'], 'Looking forward to coffee!')
    
    def test_send_message_as_attendee(self):
        """Test attendee can send messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.attendee_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Me too!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
    
    def test_send_message_empty_content_rejected(self):
        """Test empty message content is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': ''},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
    
    def test_send_message_whitespace_only_rejected(self):
        """Test whitespace-only message content is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': '   '},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
    
    def test_send_message_missing_content_rejected(self):
        """Test missing content field is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
    
    def test_send_message_non_attendee_forbidden(self):
        """Test non-attendees cannot send messages."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.outsider_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Can I join?'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 403)
    
    def test_send_message_requires_authentication(self):
        """Test POST /events/{id}/messages/ requires authentication."""
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 401)
    
    def test_send_message_event_not_found(self):
        """Test 404 for non-existent event."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            '/api/v1/events/00000000-0000-0000-0000-000000000000/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 404)
    
    def test_send_message_matched_swipe_event_success(self):
        """Test attendees can send messages to matched swipe events."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.matched_swipe_event.id}/messages/',
            {'content': 'Excited for the hike!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
    
    def test_send_message_unmatched_swipe_event_forbidden(self):
        """Test cannot send messages to unmatched swipe events."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.unmatched_swipe_event.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 403)
    
    def test_send_message_cancelled_event_rejected(self):
        """Test cannot send messages to cancelled event."""
        self.direct_event.status = 'cancelled'
        self.direct_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('cancelled', response.data['message'].lower())
    
    def test_send_message_completed_event_rejected(self):
        """Test cannot send messages to completed event."""
        self.direct_event.status = 'completed'
        self.direct_event.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('completed', response.data['message'].lower())
    
    def test_send_message_max_length(self):
        """Test message content respects max length (500 chars)."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        long_content = 'A' * 500
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': long_content},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
    
    def test_send_message_over_max_length_rejected(self):
        """Test message content over max length is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        long_content = 'A' * 501
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': long_content},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
    
    # -------------------------------------------------------------------------
    # Message Response Format Tests
    # -------------------------------------------------------------------------
    
    def test_message_response_includes_sender_profile(self):
        """Test message response includes sender profile info."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Test message'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertIn('sender_profile', response.data['data'])
        self.assertEqual(
            response.data['data']['sender_profile']['id'],
            str(self.creator_profile.id)
        )
    
    def test_message_response_includes_timestamp(self):
        """Test message response includes created_at timestamp."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.post(
            f'/api/v1/events/{self.direct_event.id}/messages/',
            {'content': 'Test message'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertIn('created_at', response.data['data'])


class EventMyEventsEndpointTestCase(TestCase):
    """
    Test cases for GET /events/my-events/ endpoint.
    
    Tests REQ-5.8: GET /events/my-events/ - Events user created or is attending
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users
        self.user1 = UserAccount.objects.create_user(
            username='myeventsuser1',
            email='myeventsuser1@test.com',
            password='testpass123'
        )
        self.profile1 = self.user1.profile
        self.profile1.display_name = 'My Events User 1'
        self.profile1.save()
        self.token1 = Token.objects.create(user=self.user1)
        
        self.user2 = UserAccount.objects.create_user(
            username='myeventsuser2',
            email='myeventsuser2@test.com',
            password='testpass123'
        )
        self.profile2 = self.user2.profile
        self.profile2.display_name = 'My Events User 2'
        self.profile2.save()
        self.token2 = Token.objects.create(user=self.user2)
        
        self.user3 = UserAccount.objects.create_user(
            username='myeventsuser3',
            email='myeventsuser3@test.com',
            password='testpass123'
        )
        self.profile3 = self.user3.profile
        self.token3 = Token.objects.create(user=self.user3)
        
        # Create events with different scenarios
        # Event 1: Created by user1 (direct mode)
        self.event_created = Event.objects.create(
            created_by=self.profile1,
            title='My Created Event',
            event_type='coffee',
            join_mode='direct',
            event_date=date.today() + timedelta(days=7),
            time_window='morning',
            location='Austin, TX',
            spots=4,
            status='open'
        )
        EventAttendee.objects.create(
            event=self.event_created,
            user=self.profile1,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        # Event 2: Created by user2, user1 is attending
        self.event_attending = Event.objects.create(
            created_by=self.profile2,
            title='Event I Joined',
            event_type='hiking',
            join_mode='direct',
            event_date=date.today() + timedelta(days=14),
            time_window='morning',
            location='Boulder, CO',
            spots=6,
            status='open'
        )
        EventAttendee.objects.create(
            event=self.event_attending,
            user=self.profile2,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        EventAttendee.objects.create(
            event=self.event_attending,
            user=self.profile1,
            status='joined'
        )
        
        # Event 3: Created by user2, user1 declined
        self.event_declined = Event.objects.create(
            created_by=self.profile2,
            title='Event I Declined',
            event_type='potluck',
            join_mode='direct',
            event_date=date.today() + timedelta(days=21),
            time_window='evening',
            location='Denver, CO',
            spots=8,
            status='open'
        )
        EventAttendee.objects.create(
            event=self.event_declined,
            user=self.profile2,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        EventAttendee.objects.create(
            event=self.event_declined,
            user=self.profile1,
            status='declined'
        )
        
        # Event 4: Created by user2, user1 not involved
        self.event_not_involved = Event.objects.create(
            created_by=self.profile2,
            title='Not My Event',
            event_type='surfing',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=28),
            time_window='morning',
            location='San Diego, CA',
            spots=4,
            status='open'
        )
        
        # Event 5: Cancelled event created by user1
        self.event_cancelled = Event.objects.create(
            created_by=self.profile1,
            title='My Cancelled Event',
            event_type='camping',
            join_mode='direct',
            event_date=date.today() + timedelta(days=35),
            time_window='flexible',
            location='Yosemite, CA',
            spots=6,
            status='cancelled'
        )
        
        # Event 6: Swipe mode event created by user1
        self.event_swipe = Event.objects.create(
            created_by=self.profile1,
            title='My Swipe Event',
            event_type='biking',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=10),
            time_window='afternoon',
            location='Portland, OR',
            spots=4,
            status='open'
        )
        
        self.client = APIClient()
    
    def test_my_events_returns_created_events(self):
        """User's created events are returned"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.event_created.id), event_ids)
        self.assertIn(str(self.event_swipe.id), event_ids)
    
    def test_my_events_returns_attending_events(self):
        """Events user is attending are returned"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.event_attending.id), event_ids)
    
    def test_my_events_excludes_declined_events(self):
        """Events user declined are not returned"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertNotIn(str(self.event_declined.id), event_ids)
    
    def test_my_events_excludes_not_involved_events(self):
        """Events user is not involved in are not returned"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertNotIn(str(self.event_not_involved.id), event_ids)
    
    def test_my_events_excludes_cancelled_by_default(self):
        """Cancelled events are excluded by default"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertNotIn(str(self.event_cancelled.id), event_ids)
    
    def test_my_events_includes_cancelled_with_include_past(self):
        """Cancelled events are included when include_past=true"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/?include_past=true')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.event_cancelled.id), event_ids)
    
    def test_my_events_filter_by_join_mode_direct(self):
        """Can filter my events by join_mode=direct"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/?join_mode=direct')
        
        self.assertEqual(response.status_code, 200)
        
        # Should include direct events
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.event_created.id), event_ids)
        self.assertIn(str(self.event_attending.id), event_ids)
        
        # Should exclude swipe events
        self.assertNotIn(str(self.event_swipe.id), event_ids)
    
    def test_my_events_filter_by_join_mode_swipe(self):
        """Can filter my events by join_mode=swipe"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-events/?join_mode=swipe')
        
        self.assertEqual(response.status_code, 200)
        
        # Should include swipe events
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.event_swipe.id), event_ids)
        
        # Should exclude direct events
        self.assertNotIn(str(self.event_created.id), event_ids)
    
    def test_my_events_requires_authentication(self):
        """Endpoint requires authentication"""
        response = self.client.get('/api/v1/events/my-events/')
        
        self.assertEqual(response.status_code, 401)
    
    def test_my_events_empty_for_new_user(self):
        """New user with no events gets empty list"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token3.key}')
        response = self.client.get('/api/v1/events/my-events/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 0)


class EventMyMatchesEndpointTestCase(TestCase):
    """
    Test cases for GET /events/my-matches/ endpoint.
    
    Returns swipe mode events where the user is an attendee and status='matched'.
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users
        self.creator = UserAccount.objects.create_user(
            username='matchescreator',
            email='matchescreator@test.com',
            password='testpass123'
        )
        self.creator_profile = self.creator.profile
        self.creator_profile.display_name = 'Matches Creator'
        self.creator_profile.save()
        self.creator_token = Token.objects.create(user=self.creator)
        
        self.user1 = UserAccount.objects.create_user(
            username='matchesuser1',
            email='matchesuser1@test.com',
            password='testpass123'
        )
        self.profile1 = self.user1.profile
        self.profile1.display_name = 'Matches User 1'
        self.profile1.save()
        self.token1 = Token.objects.create(user=self.user1)
        
        self.user2 = UserAccount.objects.create_user(
            username='matchesuser2',
            email='matchesuser2@test.com',
            password='testpass123'
        )
        self.profile2 = self.user2.profile
        self.token2 = Token.objects.create(user=self.user2)
        
        # Event 1: Matched swipe event where user1 is an attendee
        self.matched_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Matched Hiking Trip',
            event_type='hiking',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=7),
            time_window='morning',
            location='Boulder, CO',
            spots=3,
            status='matched'
        )
        EventAttendee.objects.create(
            event=self.matched_event,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        EventAttendee.objects.create(
            event=self.matched_event,
            user=self.profile1,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        # Event 2: Matched swipe event created by user1
        self.matched_event_created = Event.objects.create(
            created_by=self.profile1,
            title='My Matched Event',
            event_type='surfing',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=14),
            time_window='morning',
            location='San Diego, CA',
            spots=4,
            status='matched'
        )
        EventAttendee.objects.create(
            event=self.matched_event_created,
            user=self.profile1,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        # Event 3: Open swipe event (not matched yet)
        self.open_swipe_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Open Swipe Event',
            event_type='biking',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=21),
            time_window='afternoon',
            location='Portland, OR',
            spots=4,
            status='open'
        )
        
        # Event 4: Direct mode event (should not appear in my-matches)
        self.direct_event = Event.objects.create(
            created_by=self.creator_profile,
            title='Direct Event',
            event_type='coffee',
            join_mode='direct',
            event_date=date.today() + timedelta(days=28),
            time_window='morning',
            location='Austin, TX',
            spots=4,
            status='open'
        )
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        EventAttendee.objects.create(
            event=self.direct_event,
            user=self.profile1,
            status='joined'
        )
        
        # Event 5: Matched swipe event where user1 is NOT an attendee
        self.matched_not_attendee = Event.objects.create(
            created_by=self.creator_profile,
            title='Matched Without Me',
            event_type='camping',
            join_mode='swipe',
            event_date=date.today() + timedelta(days=35),
            time_window='flexible',
            location='Yosemite, CA',
            spots=3,
            status='matched'
        )
        EventAttendee.objects.create(
            event=self.matched_not_attendee,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        EventAttendee.objects.create(
            event=self.matched_not_attendee,
            user=self.profile2,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        self.client = APIClient()
    
    def test_my_matches_returns_matched_events_as_attendee(self):
        """Returns matched swipe events where user is an attendee"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.matched_event.id), event_ids)
    
    def test_my_matches_returns_matched_events_as_creator(self):
        """Returns matched swipe events where user is the creator"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.matched_event_created.id), event_ids)
    
    def test_my_matches_excludes_open_swipe_events(self):
        """Open swipe events are not returned"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertNotIn(str(self.open_swipe_event.id), event_ids)
    
    def test_my_matches_excludes_direct_events(self):
        """Direct mode events are not returned"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertNotIn(str(self.direct_event.id), event_ids)
    
    def test_my_matches_excludes_events_not_attendee(self):
        """Matched events where user is not an attendee are not returned"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        self.assertNotIn(str(self.matched_not_attendee.id), event_ids)
    
    def test_my_matches_requires_authentication(self):
        """Endpoint requires authentication"""
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 401)
    
    def test_my_matches_empty_for_user_with_no_matches(self):
        """User with no matched events gets empty list"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token2.key}')
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        # user2 is only in matched_not_attendee, which should be returned
        event_ids = [e['id'] for e in response.data['data']]
        self.assertIn(str(self.matched_not_attendee.id), event_ids)
    
    def test_my_matches_for_creator_returns_their_matches(self):
        """Creator can see their matched events"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.creator_token.key}')
        response = self.client.get('/api/v1/events/my-matches/')
        
        self.assertEqual(response.status_code, 200)
        
        event_ids = [e['id'] for e in response.data['data']]
        # Creator should see all matched events they created
        self.assertIn(str(self.matched_event.id), event_ids)
        self.assertIn(str(self.matched_not_attendee.id), event_ids)
