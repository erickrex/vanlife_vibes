from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import UserAccount, UserSubscription
from core.services.subscription import SubscriptionService


class SubscriptionServiceTestCase(TestCase):
    def setUp(self):
        self.user = UserAccount.objects.create_user(
            username='sub_user',
            email='sub_user@example.com',
            password='testpass123',
        )
        self.profile = self.user.profile

    def test_cancellation_keeps_subscription_active_until_expiration(self):
        future = timezone.now() + timedelta(days=7)
        subscription = UserSubscription.objects.create(
            profile=self.profile,
            plan='premium',
            is_active=True,
            current_period_end=future,
        )

        SubscriptionService.update_from_webhook(
            event_type='CANCELLATION',
            app_user_id=str(self.user.id),
            expiration_date=future.isoformat(),
        )

        subscription.refresh_from_db()
        self.assertEqual(subscription.plan, 'premium')
        self.assertTrue(subscription.is_active)

    def test_expiration_deactivates_subscription(self):
        UserSubscription.objects.create(
            profile=self.profile,
            plan='premium',
            is_active=True,
        )

        SubscriptionService.update_from_webhook(
            event_type='EXPIRATION',
            app_user_id=str(self.user.id),
            expiration_date=(timezone.now() - timedelta(days=1)).isoformat(),
        )

        subscription = UserSubscription.objects.get(profile=self.profile)
        self.assertEqual(subscription.plan, 'free')
        self.assertFalse(subscription.is_active)

    def test_sync_from_client_activates_premium(self):
        future = (timezone.now() + timedelta(days=10)).isoformat()
        customer_info = {
            'entitlements': {
                'active': {
                    'premium': {'expiresDate': future}
                }
            }
        }

        data = SubscriptionService.sync_from_client(self.profile, customer_info)

        self.assertEqual(data['plan'], 'premium')
        self.assertTrue(data['is_premium'])
        self.profile.subscription.refresh_from_db()
        self.assertTrue(self.profile.subscription.is_active)

    def test_start_free_trial_activates_premium(self):
        data = SubscriptionService.start_free_trial(self.profile)

        self.assertEqual(data['plan'], 'premium')
        self.assertTrue(data['is_premium'])
        self.assertTrue(data['is_trial_active'])
        self.assertTrue(data['trial_used'])
        self.assertIsNotNone(data['trial_started_at'])
        self.assertIsNotNone(data['trial_ends_at'])

    def test_start_free_trial_is_idempotent_while_active(self):
        first = SubscriptionService.start_free_trial(self.profile)
        second = SubscriptionService.start_free_trial(self.profile)

        self.assertTrue(first['is_trial_active'])
        self.assertTrue(second['is_trial_active'])

    def test_start_free_trial_rejects_restart_after_expiration(self):
        UserSubscription.objects.create(
            profile=self.profile,
            plan='free',
            is_active=False,
            is_trial=False,
            trial_started_at=timezone.now() - timedelta(days=8),
            trial_ends_at=timezone.now() - timedelta(days=1),
            current_period_end=timezone.now() - timedelta(days=1),
        )

        with self.assertRaises(ValueError):
            SubscriptionService.start_free_trial(self.profile)

    def test_start_free_trial_rejects_when_paid_premium_is_active(self):
        UserSubscription.objects.create(
            profile=self.profile,
            plan='premium',
            is_active=True,
            is_trial=False,
            current_period_end=timezone.now() + timedelta(days=30),
        )

        with self.assertRaises(ValueError):
            SubscriptionService.start_free_trial(self.profile)

    def test_trial_expiration_requires_billing_details(self):
        subscription = UserSubscription.objects.create(
            profile=self.profile,
            plan='premium',
            is_active=True,
            is_trial=True,
            trial_started_at=timezone.now() - timedelta(days=8),
            trial_ends_at=timezone.now() - timedelta(days=1),
            current_period_end=timezone.now() - timedelta(days=1),
        )

        data = SubscriptionService.get_subscription_status(self.profile)
        subscription.refresh_from_db()

        self.assertEqual(subscription.plan, 'free')
        self.assertFalse(subscription.is_active)
        self.assertFalse(subscription.is_trial)
        self.assertFalse(data['is_premium'])
        self.assertTrue(data['trial_used'])
        self.assertTrue(data['requires_billing_details'])


class SubscriptionSyncAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='sync_user',
            email='sync_user@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_sync_rejects_invalid_payload(self):
        response = self.client.post(
            '/api/v1/subscription/sync/',
            {'customer_info': 'not-an-object'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_sync_updates_subscription_status(self):
        future = (timezone.now() + timedelta(days=15)).isoformat()
        payload = {
            'customer_info': {
                'entitlements': {
                    'active': {
                        'premium': {'expiresDate': future}
                    }
                }
            }
        }

        response = self.client.post(
            '/api/v1/subscription/sync/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['plan'], 'premium')
        self.assertTrue(response.data['data']['is_premium'])

    def test_start_trial_endpoint_activates_trial(self):
        response = self.client.post('/api/v1/subscription/start-trial/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertTrue(response.data['data']['is_premium'])
        self.assertTrue(response.data['data']['is_trial_active'])
        self.assertTrue(response.data['data']['trial_used'])

    def test_start_trial_endpoint_is_idempotent_while_active(self):
        self.client.post('/api/v1/subscription/start-trial/', {}, format='json')
        response = self.client.post('/api/v1/subscription/start-trial/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertTrue(response.data['data']['is_trial_active'])
