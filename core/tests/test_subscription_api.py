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
