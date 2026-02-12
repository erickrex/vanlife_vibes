from datetime import timedelta
import uuid

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import (
    BuilderListing,
    City,
    Country,
    InTownWindow,
    UserAccount,
    UserSubscription,
)


class BuilderAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.country, _ = Country.objects.get_or_create(
            code='US',
            defaults={'name': 'United States'},
        )
        self.city_austin, _ = City.objects.get_or_create(
            display_name='Austin, TX',
            defaults={
                'name': 'Austin',
                'state_code': 'TX',
                'country': self.country,
            },
        )
        self.city_portland, _ = City.objects.get_or_create(
            display_name='Portland, OR',
            defaults={
                'name': 'Portland',
                'state_code': 'OR',
                'country': self.country,
            },
        )

        suffix = uuid.uuid4().hex[:8]

        self.viewer = UserAccount.objects.create_user(
            username=f'viewer_{suffix}',
            email=f'viewer_{suffix}@example.com',
            password='testpass123',
        )
        self.owner_near = UserAccount.objects.create_user(
            username=f'owner_near_{suffix}',
            email=f'owner_near_{suffix}@example.com',
            password='testpass123',
        )
        self.owner_far = UserAccount.objects.create_user(
            username=f'owner_far_{suffix}',
            email=f'owner_far_{suffix}@example.com',
            password='testpass123',
        )
        self.inquirer = UserAccount.objects.create_user(
            username=f'inquirer_{suffix}',
            email=f'inquirer_{suffix}@example.com',
            password='testpass123',
        )

    @staticmethod
    def _mark_premium(user):
        UserSubscription.objects.create(
            profile=user.profile,
            plan='premium',
            is_active=True,
            current_period_end=timezone.now() + timedelta(days=30),
        )

    def test_list_requires_premium_subscription(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get('/api/v1/builder/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['message'], 'Premium subscription required')

    def test_list_orders_by_location_relevance(self):
        self._mark_premium(self.viewer)
        self.client.force_authenticate(user=self.viewer)

        today = timezone.now().date()
        InTownWindow.objects.create(
            profile=self.viewer.profile,
            city_area='Austin, TX',
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=2),
        )

        InTownWindow.objects.create(
            profile=self.owner_near.profile,
            city_area='Austin, TX',
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=2),
        )
        InTownWindow.objects.create(
            profile=self.owner_far.profile,
            city_area='Portland, OR',
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=2),
        )

        near_listing = BuilderListing.objects.create(
            user=self.owner_near,
            title='Austin Solar Help',
            description='I can help install solar.',
            category='solar',
            listing_type='offering',
            city=self.city_austin,
        )
        far_listing = BuilderListing.objects.create(
            user=self.owner_far,
            title='Portland Plumbing Help',
            description='Need plumbing guidance.',
            category='plumbing',
            listing_type='requesting',
            city=self.city_portland,
        )

        response = self.client.get('/api/v1/builder/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', [])
        self.assertGreaterEqual(len(results), 2)
        self.assertEqual(results[0]['id'], str(near_listing.id))
        self.assertEqual(results[1]['id'], str(far_listing.id))

    def test_owner_reply_requires_recipient_id(self):
        self._mark_premium(self.owner_near)
        self._mark_premium(self.inquirer)

        listing = BuilderListing.objects.create(
            user=self.owner_near,
            title='Electrical build consult',
            description='Happy to help with wiring.',
            category='electrical',
            listing_type='offering',
            city=self.city_austin,
        )

        self.client.force_authenticate(user=self.inquirer)
        first_msg = self.client.post(
            f'/api/v1/builder/{listing.id}/messages/',
            {'content': 'Hey, are you available next week?'},
            format='json',
        )
        self.assertEqual(first_msg.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.owner_near)
        missing_recipient = self.client.post(
            f'/api/v1/builder/{listing.id}/messages/',
            {'content': 'Yes, I can help.'},
            format='json',
        )
        self.assertEqual(missing_recipient.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing_recipient.data['message'], 'Invalid message data')
        self.assertIn('recipient_id', missing_recipient.data['errors'])

        with_recipient = self.client.post(
            f'/api/v1/builder/{listing.id}/messages/',
            {
                'content': 'Yes, I can help.',
                'recipient_id': str(self.inquirer.profile.id),
            },
            format='json',
        )
        self.assertEqual(with_recipient.status_code, status.HTTP_201_CREATED)
