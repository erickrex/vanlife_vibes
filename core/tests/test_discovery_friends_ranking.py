"""Tests for friends discovery ranking using combined relevance signals."""
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import InTownWindow, UserAccount
from core.views.profiles import DiscoveryViewSet


def _create_user_with_profile(username):
    user = UserAccount.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="testpass123",
    )
    profile = user.profile
    profile.display_name = username
    profile.looking_for_friends = True
    profile.looking_for_dating = False
    profile.save()
    return user, profile


class TestFriendsDiscoveryRanking(TestCase):
    def test_friends_response_includes_relevance_score(self):
        """Friends discovery should expose relevance_score like dating discovery."""
        user, _ = _create_user_with_profile("friends_searcher")
        _, candidate = _create_user_with_profile("friends_candidate")
        candidate.save()

        factory = APIRequestFactory()
        request = factory.get("/api/v1/discovery/friends/")
        force_authenticate(request, user=user)

        view = DiscoveryViewSet.as_view({"get": "friends"})
        response = view(request)

        assert response.status_code == 200
        profiles = response.data["data"]["profiles"]
        assert len(profiles) >= 1
        assert "relevance_score" in profiles[0]
        assert isinstance(profiles[0]["relevance_score"], int)

    def test_friends_ranking_uses_combined_score_not_overlap_only(self):
        """
        Friends ranking should account for relevance/completeness, not just overlap.

        Candidate A has overlap but weak relevance.
        Candidate B has no overlap but very high relevance.
        B should rank above A when combined score is applied.
        """
        user, user_profile = _create_user_with_profile("friends_rank_searcher")
        _, candidate_a = _create_user_with_profile("friends_rank_overlap")
        _, candidate_b = _create_user_with_profile("friends_rank_relevance")

        today = date.today()
        InTownWindow.objects.create(
            profile=user_profile,
            city_area="Austin",
            start_date=today,
            end_date=today + timedelta(days=2),
        )
        InTownWindow.objects.create(
            profile=candidate_a,
            city_area="Austin",
            start_date=today,
            end_date=today + timedelta(days=2),
        )
        InTownWindow.objects.create(
            profile=candidate_b,
            city_area="Denver",
            start_date=today,
            end_date=today + timedelta(days=2),
        )

        # overlap(A)=3 days -> location contribution = 6.
        # overlap(B)=0 days -> location contribution = 0.
        # With relevance below, B should still rank first.
        with patch("core.views.profiles.RelevanceScorer") as mock_scorer_class:
            scorer = MagicMock()

            def relevance_side_effect(_user_profile, target_profile):
                if target_profile.id == candidate_a.id:
                    return 0
                if target_profile.id == candidate_b.id:
                    return 30
                return 0

            scorer.calculate_score.side_effect = relevance_side_effect
            scorer.calculate_completeness_score.return_value = 0
            mock_scorer_class.return_value = scorer

            factory = APIRequestFactory()
            request = factory.get("/api/v1/discovery/friends/")
            force_authenticate(request, user=user)

            view = DiscoveryViewSet.as_view({"get": "friends"})
            response = view(request)

        assert response.status_code == 200
        profiles = response.data["data"]["profiles"]
        assert len(profiles) >= 2
        assert profiles[0]["id"] == str(candidate_b.id)
        assert profiles[1]["id"] == str(candidate_a.id)
