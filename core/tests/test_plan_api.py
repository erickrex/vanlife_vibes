"""
Tests for Plan API endpoints including group chat.
"""
import pytest
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from datetime import date, timedelta

from core.models import (
    UserAccount, Plan, PlanAttendee, PlanMessage
)


class PlanMessagesAPITestCase(TestCase):
    """
    Test cases for plan group chat endpoints.
    
    GET /plans/{id}/messages/ - get plan chat
    POST /plans/{id}/messages/ - send message to plan chat
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users (profiles are auto-created via signal)
        self.user1 = UserAccount.objects.create_user(
            username='planuser1',
            email='planuser1@test.com',
            password='testpass123'
        )
        self.profile1 = self.user1.profile
        self.profile1.display_name = 'Plan User 1'
        self.profile1.save()
        self.token1 = Token.objects.create(user=self.user1)
        
        self.user2 = UserAccount.objects.create_user(
            username='planuser2',
            email='planuser2@test.com',
            password='testpass123'
        )
        self.profile2 = self.user2.profile
        self.profile2.display_name = 'Plan User 2'
        self.profile2.save()
        self.token2 = Token.objects.create(user=self.user2)
        
        self.user3 = UserAccount.objects.create_user(
            username='planuser3',
            email='planuser3@test.com',
            password='testpass123'
        )
        self.profile3 = self.user3.profile
        self.profile3.display_name = 'Plan User 3'
        self.profile3.save()
        self.token3 = Token.objects.create(user=self.user3)
        
        # Create a plan
        self.plan = Plan.objects.create(
            created_by=self.profile1,
            title='Test Coffee Meetup',
            plan_type='coffee',
            plan_date=date.today() + timedelta(days=7),
            time_window='morning',
            meetup_area='Austin, TX',
            max_attendees=6,
            status='open'
        )
        
        # Add creator as confirmed attendee
        PlanAttendee.objects.create(
            plan=self.plan,
            user=self.profile1,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        # Add user2 as joined attendee
        PlanAttendee.objects.create(
            plan=self.plan,
            user=self.profile2,
            status='joined'
        )
        
        # user3 is NOT an attendee
        
        self.client = APIClient()
    
    def test_get_messages_as_attendee(self):
        """Attendees can view plan messages"""
        # Create some messages
        PlanMessage.objects.create(
            plan=self.plan,
            sender=self.profile1,
            content='Hello everyone!'
        )
        PlanMessage.objects.create(
            plan=self.plan,
            sender=self.profile2,
            content='Hi there!'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get(f'/api/v1/plans/{self.plan.id}/messages/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 2)
    
    def test_get_messages_as_non_attendee_forbidden(self):
        """Non-attendees cannot view plan messages"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token3.key}')
        response = self.client.get(f'/api/v1/plans/{self.plan.id}/messages/')
        
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('attendees', response.data['message'].lower())
    
    def test_send_message_as_attendee(self):
        """Attendees can send messages to plan chat"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/plans/{self.plan.id}/messages/',
            {'content': 'Looking forward to meeting everyone!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['content'], 'Looking forward to meeting everyone!')
        
        # Verify message was created
        self.assertEqual(PlanMessage.objects.filter(plan=self.plan).count(), 1)
    
    def test_send_message_as_non_attendee_forbidden(self):
        """Non-attendees cannot send messages to plan chat"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token3.key}')
        response = self.client.post(
            f'/api/v1/plans/{self.plan.id}/messages/',
            {'content': 'Can I join?'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['status'], 'error')
    
    def test_send_message_empty_content_rejected(self):
        """Empty message content is rejected"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/plans/{self.plan.id}/messages/',
            {'content': ''},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
    
    def test_send_message_to_cancelled_plan_rejected(self):
        """Cannot send messages to cancelled plan"""
        self.plan.status = 'cancelled'
        self.plan.save()
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(
            f'/api/v1/plans/{self.plan.id}/messages/',
            {'content': 'Hello!'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('cancelled', response.data['message'].lower())
    
    def test_declined_attendee_cannot_access_messages(self):
        """Declined attendees cannot access plan messages"""
        # Create a declined attendee
        PlanAttendee.objects.create(
            plan=self.plan,
            user=self.profile3,
            status='declined'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token3.key}')
        response = self.client.get(f'/api/v1/plans/{self.plan.id}/messages/')
        
        self.assertEqual(response.status_code, 403)
    
    def test_get_messages_plan_not_found(self):
        """Returns 404 for non-existent plan"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get('/api/v1/plans/00000000-0000-0000-0000-000000000000/messages/')
        
        self.assertEqual(response.status_code, 404)
    
    def test_messages_ordered_by_creation_time(self):
        """Messages are returned in chronological order"""
        msg1 = PlanMessage.objects.create(
            plan=self.plan,
            sender=self.profile1,
            content='First message'
        )
        msg2 = PlanMessage.objects.create(
            plan=self.plan,
            sender=self.profile2,
            content='Second message'
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get(f'/api/v1/plans/{self.plan.id}/messages/')
        
        self.assertEqual(response.status_code, 200)
        messages = response.data['data']
        self.assertEqual(messages[0]['content'], 'First message')
        self.assertEqual(messages[1]['content'], 'Second message')


class PlanCapacityEnforcementTestCase(TestCase):
    """
    Test cases for plan capacity enforcement.
    
    When the number of attendees reaches max_attendees, the plan status
    changes to 'full' and additional join requests are rejected.
    """
    
    def setUp(self):
        """Set up test data"""
        # Create users (profiles are auto-created via signal)
        self.creator = UserAccount.objects.create_user(
            username='plancreator',
            email='plancreator@test.com',
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
        
        # Create a plan with max_attendees=3 (creator + 2 others)
        self.plan = Plan.objects.create(
            created_by=self.creator_profile,
            title='Small Meetup',
            plan_type='coffee',
            plan_date=date.today() + timedelta(days=7),
            time_window='morning',
            meetup_area='Austin, TX',
            max_attendees=3,
            status='open'
        )
        
        # Add creator as confirmed attendee (count = 1)
        PlanAttendee.objects.create(
            plan=self.plan,
            user=self.creator_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        self.client = APIClient()
    
    def test_join_updates_status_to_full_when_capacity_reached(self):
        """When a user joins and count reaches max_attendees, plan status changes to 'full'."""
        # User 0 joins (count = 2)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/join/')
        self.assertEqual(response.status_code, 201)
        
        # Plan should still be open
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, 'open')
        
        # User 1 joins (count = 3 = max_attendees)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[1].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/join/')
        self.assertEqual(response.status_code, 201)
        
        # Plan should now be full
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, 'full')
    
    def test_join_rejected_when_plan_is_full(self):
        """When plan status is 'full', additional join requests are rejected."""
        # Fill the plan
        for i in range(2):  # Add 2 more users to reach max_attendees=3
            PlanAttendee.objects.create(
                plan=self.plan,
                user=self.users[i].profile,
                status='joined'
            )
        
        # Set plan to full
        self.plan.status = 'full'
        self.plan.save()
        
        # User 2 tries to join
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[2].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/join/')
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('full', response.data['message'].lower())
    
    def test_leave_reopens_full_plan(self):
        """When a user leaves a full plan, status changes back to 'open' if below capacity."""
        # Fill the plan
        for i in range(2):  # Add 2 more users to reach max_attendees=3
            PlanAttendee.objects.create(
                plan=self.plan,
                user=self.users[i].profile,
                status='joined'
            )
        
        # Set plan to full
        self.plan.status = 'full'
        self.plan.save()
        
        # User 0 leaves
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/leave/')
        
        self.assertEqual(response.status_code, 200)
        
        # Plan should now be open again
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, 'open')
    
    def test_capacity_check_excludes_declined_attendees(self):
        """Capacity count excludes declined attendees."""
        # Add a declined attendee (should not count toward capacity)
        PlanAttendee.objects.create(
            plan=self.plan,
            user=self.users[0].profile,
            status='declined'
        )
        
        # Add one more joined attendee (count = 2: creator + user1)
        PlanAttendee.objects.create(
            plan=self.plan,
            user=self.users[1].profile,
            status='joined'
        )
        
        # User 2 should be able to join (count would be 3 = max)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[2].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/join/')
        
        self.assertEqual(response.status_code, 201)
        
        # Plan should now be full
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, 'full')
    
    def test_rejoin_after_decline_respects_capacity(self):
        """When a user who previously declined tries to rejoin, capacity is checked."""
        # Fill the plan with 2 more users
        for i in range(2):
            PlanAttendee.objects.create(
                plan=self.plan,
                user=self.users[i].profile,
                status='joined'
            )
        
        # Set plan to full
        self.plan.status = 'full'
        self.plan.save()
        
        # User 0 leaves (declines)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/leave/')
        self.assertEqual(response.status_code, 200)
        
        # Plan should be open now
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, 'open')
        
        # User 2 joins (fills the spot)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[2].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/join/')
        self.assertEqual(response.status_code, 201)
        
        # Plan should be full again
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, 'full')
        
        # User 0 tries to rejoin - should be rejected because plan is full
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.tokens[0].key}')
        response = self.client.post(f'/api/v1/plans/{self.plan.id}/join/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('full', response.data['message'].lower())
