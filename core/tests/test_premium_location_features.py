from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import InTownWindow, UserAccount, UserSubscription


def _create_user(username):
    user = UserAccount.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="testpass123",
    )
    return user, user.profile


class PremiumLocationProfileUpdateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_user("premium_loc_user")
        self.client.force_authenticate(user=self.user)

    def test_free_user_cannot_set_next_week_or_next_month_city(self):
        response = self.client.patch(
            "/api/v1/profiles/me/",
            {
                "next_week_in_city": "Denver, CO",
                "next_month_in_city": "Moab, UT",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", response.data)
        self.assertIn("next_week_in_city", response.data["errors"])
        self.assertIn("next_month_in_city", response.data["errors"])

    def test_premium_user_can_set_future_location_cities(self):
        UserSubscription.objects.create(
            profile=self.profile,
            plan="premium",
            is_active=True,
        )

        response = self.client.patch(
            "/api/v1/profiles/me/",
            {
                "next_week_in_city": "Denver, CO",
                "next_month_in_city": "Moab, UT",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["next_week_in_city"], "Denver, CO")
        self.assertEqual(response.data["data"]["next_month_in_city"], "Moab, UT")


class PremiumLocationDiscoveryRankingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.this_sunday = self.today + timedelta(days=(6 - self.today.weekday()))
        self.next_monday = self.this_sunday + timedelta(days=1)
        self.next_sunday = self.next_monday + timedelta(days=6)

    def _set_premium(self, profile):
        UserSubscription.objects.create(
            profile=profile,
            plan="premium",
            is_active=True,
        )

    def test_free_discovery_ignores_future_overlap_for_ranking(self):
        user, user_profile = _create_user("free_discovery_user")
        self.client.force_authenticate(user=user)

        candidate_now_user, candidate_now = _create_user("free_candidate_now")
        candidate_future_user, candidate_future = _create_user("free_candidate_future")
        _ = candidate_now_user, candidate_future_user

        InTownWindow.objects.create(
            profile=user_profile,
            city_area="Austin, TX",
            start_date=self.today,
            end_date=self.today,
        )
        InTownWindow.objects.create(
            profile=user_profile,
            city_area="Denver, CO",
            start_date=self.next_monday,
            end_date=self.next_sunday,
        )

        InTownWindow.objects.create(
            profile=candidate_now,
            city_area="Austin, TX",
            start_date=self.today,
            end_date=self.today,
        )
        InTownWindow.objects.create(
            profile=candidate_future,
            city_area="Denver, CO",
            start_date=self.next_monday,
            end_date=self.next_sunday,
        )

        with patch("core.views.discovery.RelevanceScorer") as mock_scorer_class:
            scorer = MagicMock()
            scorer.calculate_score.return_value = 0
            scorer.calculate_completeness_score.return_value = 0
            mock_scorer_class.return_value = scorer

            response = self.client.get("/api/v1/discovery/friends/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profiles = response.data["data"]["profiles"]
        self.assertGreaterEqual(len(profiles), 2)
        self.assertEqual(profiles[0]["id"], str(candidate_now.id))
        self.assertEqual(profiles[1]["id"], str(candidate_future.id))

    def test_premium_discovery_uses_future_overlap_when_profiles_are_premium(self):
        user, user_profile = _create_user("premium_discovery_user")
        self._set_premium(user_profile)
        self.client.force_authenticate(user=user)

        candidate_now_user, candidate_now = _create_user("premium_candidate_now")
        candidate_future_user, candidate_future = _create_user("premium_candidate_future")
        _ = candidate_now_user, candidate_future_user
        self._set_premium(candidate_future)

        InTownWindow.objects.create(
            profile=user_profile,
            city_area="Austin, TX",
            start_date=self.today,
            end_date=self.today,
        )
        InTownWindow.objects.create(
            profile=user_profile,
            city_area="Denver, CO",
            start_date=self.next_monday,
            end_date=self.next_sunday,
        )

        InTownWindow.objects.create(
            profile=candidate_now,
            city_area="Austin, TX",
            start_date=self.today,
            end_date=self.today,
        )
        InTownWindow.objects.create(
            profile=candidate_future,
            city_area="Denver, CO",
            start_date=self.next_monday,
            end_date=self.next_sunday,
        )

        with patch("core.views.discovery.RelevanceScorer") as mock_scorer_class:
            scorer = MagicMock()
            scorer.calculate_score.return_value = 0
            scorer.calculate_completeness_score.return_value = 0
            mock_scorer_class.return_value = scorer

            response = self.client.get("/api/v1/discovery/friends/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profiles = response.data["data"]["profiles"]
        self.assertGreaterEqual(len(profiles), 2)
        self.assertEqual(profiles[0]["id"], str(candidate_future.id))
        self.assertEqual(profiles[1]["id"], str(candidate_now.id))
