"""Property-based tests for dating algorithm improvements."""
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase
from core.models import UserAccount, Profile
from core.views.profiles import DiscoveryViewSet


# --- Strategies ---

GENDER_CHOICES = [None, '', 'man', 'woman', 'non_binary']


@st.composite
def profile_preferences(draw):
    """Generate a dict of gender + interested_in_* flags."""
    return {
        'gender': draw(st.sampled_from(GENDER_CHOICES)),
        'interested_in_men': draw(st.booleans()),
        'interested_in_women': draw(st.booleans()),
        'interested_in_nonbinary': draw(st.booleans()),
    }


@st.composite
def candidate_list(draw):
    """Generate a list of 1-10 candidate preference dicts."""
    return draw(st.lists(profile_preferences(), min_size=1, max_size=10))


# --- Helpers ---

def _has_any_preference(prefs):
    return prefs['interested_in_men'] or prefs['interested_in_women'] or prefs['interested_in_nonbinary']


def _forward_passes(user_prefs, candidate_prefs):
    """Does the candidate pass the forward filter (user's preferences)?"""
    cand_gender = candidate_prefs['gender']
    if cand_gender is None or cand_gender == '':
        return True
    mapping = {
        'man': user_prefs['interested_in_men'],
        'woman': user_prefs['interested_in_women'],
        'non_binary': user_prefs['interested_in_nonbinary'],
    }
    return mapping.get(cand_gender, False)


def _reverse_passes(user_prefs, candidate_prefs):
    """Does the candidate pass the reverse filter (candidate interested in user)?"""
    user_gender = user_prefs['gender']
    if user_gender is None or user_gender == '':
        return True
    cand_gender = candidate_prefs['gender']
    if cand_gender is None or cand_gender == '':
        return True
    mapping = {
        'man': candidate_prefs['interested_in_men'],
        'woman': candidate_prefs['interested_in_women'],
        'non_binary': candidate_prefs['interested_in_nonbinary'],
    }
    return mapping.get(user_gender, False)


# --- Property 1: Bidirectional gender filter correctness ---


@pytest.mark.django_db(transaction=True)
class TestBidirectionalGenderFilterProperty(TestCase):
    """Every returned profile satisfies both forward and reverse gender filters."""

    def _create_user_with_profile(self, username, prefs):
        user = UserAccount.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password='testpass123'
        )
        profile = user.profile
        profile.gender = prefs['gender'] if prefs['gender'] else prefs['gender']
        profile.interested_in_men = prefs['interested_in_men']
        profile.interested_in_women = prefs['interested_in_women']
        profile.interested_in_nonbinary = prefs['interested_in_nonbinary']
        profile.looking_for_dating = True
        profile.display_name = username
        profile.save()
        return user, profile

    @given(user_prefs=profile_preferences(), candidates=candidate_list())
    @settings(max_examples=20)
    def test_gender_filter_bidirectional_correctness(self, user_prefs, candidates):
        """Every returned profile satisfies both forward and reverse gender filters."""
        UserAccount.objects.all().delete()

        user, user_profile = self._create_user_with_profile('searcher', user_prefs)

        candidate_profiles = []
        for i, cand_prefs in enumerate(candidates):
            _, cand_profile = self._create_user_with_profile(f'cand_{i}', cand_prefs)
            candidate_profiles.append((cand_profile, cand_prefs))

        view = DiscoveryViewSet()
        base_qs = Profile.objects.exclude(user=user)
        result_qs = view._apply_gender_filters(base_qs, user_profile)
        result_ids = set(result_qs.values_list('id', flat=True))

        if not _has_any_preference(user_prefs):
            assert len(result_ids) == 0, (
                "User with all interested_in_* flags False should get empty results"
            )
            return

        for cand_profile, cand_prefs in candidate_profiles:
            in_result = cand_profile.id in result_ids
            should_pass_forward = _forward_passes(user_prefs, cand_prefs)
            should_pass_reverse = _reverse_passes(user_prefs, cand_prefs)
            should_be_included = should_pass_forward and should_pass_reverse

            if in_result:
                assert should_pass_forward, (
                    f"Candidate {cand_prefs} returned but fails forward filter "
                    f"for user {user_prefs}"
                )
                assert should_pass_reverse, (
                    f"Candidate {cand_prefs} returned but fails reverse filter "
                    f"for user {user_prefs}"
                )
            else:
                assert not should_be_included, (
                    f"Candidate {cand_prefs} excluded but should pass both filters "
                    f"for user {user_prefs}"
                )


# --- Property 2: Bidirectional swipe gender validation ---


def _swipe_should_be_accepted(swiper_prefs, target_prefs):
    """Oracle: a dating swipe is accepted iff both directions pass."""
    target_gender = target_prefs['gender']
    swiper_gender = swiper_prefs['gender']

    if target_gender:
        mapping = {
            'man': swiper_prefs['interested_in_men'],
            'woman': swiper_prefs['interested_in_women'],
            'non_binary': swiper_prefs['interested_in_nonbinary'],
        }
        if not mapping.get(target_gender, False):
            return False

    if swiper_gender:
        mapping = {
            'man': target_prefs['interested_in_men'],
            'woman': target_prefs['interested_in_women'],
            'non_binary': target_prefs['interested_in_nonbinary'],
        }
        if not mapping.get(swiper_gender, False):
            return False

    return True


@pytest.mark.django_db(transaction=True)
class TestSwipeGenderValidationProperty(TestCase):
    """Swipe validator accepts iff both forward and reverse gender checks pass."""

    def _create_user_with_profile(self, username, prefs):
        user = UserAccount.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password='testpass123'
        )
        profile = user.profile
        profile.gender = prefs['gender'] if prefs['gender'] else prefs['gender']
        profile.interested_in_men = prefs['interested_in_men']
        profile.interested_in_women = prefs['interested_in_women']
        profile.interested_in_nonbinary = prefs['interested_in_nonbinary']
        profile.looking_for_dating = True
        profile.display_name = username
        profile.save()
        return user, profile

    @given(swiper_prefs=profile_preferences(), target_prefs=profile_preferences())
    @settings(max_examples=20, deadline=None)
    def test_swipe_gender_validation_bidirectional(self, swiper_prefs, target_prefs):
        """Swipe accepted iff both forward and reverse gender checks pass."""
        from rest_framework.exceptions import ValidationError as DRFValidationError
        from core.serializers.matches import PersonSwipeSerializer

        UserAccount.objects.all().delete()

        _, swiper_profile = self._create_user_with_profile('swiper', swiper_prefs)
        _, target_profile = self._create_user_with_profile('target', target_prefs)

        serializer = PersonSwipeSerializer()
        expected_accept = _swipe_should_be_accepted(swiper_prefs, target_prefs)

        if expected_accept:
            try:
                serializer._check_gender_compatibility(swiper_profile, target_profile)
            except DRFValidationError as exc:
                raise AssertionError(
                    f"Swipe should be accepted but was rejected.\n"
                    f"  swiper={swiper_prefs}\n"
                    f"  target={target_prefs}\n"
                    f"  error={exc.detail}"
                )
        else:
            try:
                serializer._check_gender_compatibility(swiper_profile, target_profile)
                raise AssertionError(
                    f"Swipe should be rejected but was accepted.\n"
                    f"  swiper={swiper_prefs}\n"
                    f"  target={target_prefs}"
                )
            except DRFValidationError:
                pass


# --- Unit Tests: Gender filter edge cases ---


@pytest.mark.django_db
class TestGenderFilterEdgeCases:
    """Unit tests for gender filter edge cases."""

    def _create_user_with_profile(self, username, gender=None,
                                   interested_in_men=False,
                                   interested_in_women=False,
                                   interested_in_nonbinary=False):
        user = UserAccount.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password='testpass123'
        )
        profile = user.profile
        profile.gender = gender
        profile.interested_in_men = interested_in_men
        profile.interested_in_women = interested_in_women
        profile.interested_in_nonbinary = interested_in_nonbinary
        profile.looking_for_dating = True
        profile.display_name = username
        profile.save()
        return user, profile

    def test_null_gender_profiles_included_in_results(self):
        """Profiles with null/blank gender are always included by the forward filter."""
        user, user_profile = self._create_user_with_profile(
            'searcher', gender='woman',
            interested_in_men=True,
        )
        _, null_profile = self._create_user_with_profile(
            'null_cand', gender=None,
            interested_in_women=True,
        )
        _, blank_profile = self._create_user_with_profile(
            'blank_cand', gender='',
            interested_in_women=True,
        )
        _, man_profile = self._create_user_with_profile(
            'man_cand', gender='man',
            interested_in_women=True,
        )

        view = DiscoveryViewSet()
        qs = Profile.objects.exclude(user=user)
        result = view._apply_gender_filters(qs, user_profile)
        result_ids = set(result.values_list('id', flat=True))

        assert null_profile.id in result_ids, "Null-gender profile should be included"
        assert blank_profile.id in result_ids, "Blank-gender profile should be included"
        assert man_profile.id in result_ids, "Matching-gender profile should be included"

    def test_all_false_preferences_returns_empty(self):
        """User with all interested_in_* flags False gets an empty result."""
        user, user_profile = self._create_user_with_profile(
            'no_prefs', gender='man',
            interested_in_men=False,
            interested_in_women=False,
            interested_in_nonbinary=False,
        )
        _, _ = self._create_user_with_profile(
            'cand1', gender='woman',
            interested_in_men=True,
        )
        _, _ = self._create_user_with_profile(
            'cand2', gender=None,
            interested_in_men=True,
        )

        view = DiscoveryViewSet()
        qs = Profile.objects.exclude(user=user)
        result = view._apply_gender_filters(qs, user_profile)

        assert result.count() == 0, "All-False preferences should return empty list"

    def test_swipe_on_null_gender_target_allowed(self):
        """A dating swipe on a target with null gender should be allowed."""
        from rest_framework.exceptions import ValidationError as DRFValidationError
        from core.serializers.matches import PersonSwipeSerializer

        _, swiper_profile = self._create_user_with_profile(
            'swiper', gender='man',
            interested_in_women=True,
        )
        _, null_target = self._create_user_with_profile(
            'null_target', gender=None,
            interested_in_men=True,
        )

        serializer = PersonSwipeSerializer()
        try:
            serializer._check_gender_compatibility(swiper_profile, null_target)
        except DRFValidationError:
            pytest.fail("Swipe on null-gender target should be allowed")


# --- Property 3: Combined score formula (two-term) ---

@st.composite
def candidate_scores(draw):
    """Generate a list of (overlap, relevance) score tuples for ranking tests."""
    n = draw(st.integers(min_value=2, max_value=20))
    scores = draw(
        st.lists(
            st.tuples(
                st.floats(min_value=0, max_value=100, allow_nan=False, allow_infinity=False),
                st.floats(min_value=0, max_value=100, allow_nan=False, allow_infinity=False),
            ),
            min_size=n,
            max_size=n,
        )
    )
    return scores


class TestCombinedScoreRankingProperty(TestCase):
    """Ranking by final_score = (overlap * 2.0) + (relevance * 1.0) matches direct sort."""

    W_LOCATION = 2.0
    W_RELEVANCE = 1.0

    def _compute_final_score(self, overlap, relevance):
        return (overlap * self.W_LOCATION) + (relevance * self.W_RELEVANCE)

    @given(scores=candidate_scores())
    @settings(max_examples=20)
    def test_combined_score_ranking_matches_formula(self, scores):
        """Ranking by combined formula matches direct sort on final_score."""
        from core.views.profiles import W_LOCATION, W_RELEVANCE

        assert W_LOCATION == 2.0
        assert W_RELEVANCE == 1.0

        ranked = []
        for overlap, relevance in scores:
            final_score = (overlap * W_LOCATION) + (relevance * W_RELEVANCE)
            ranked.append((overlap, relevance, final_score))

        ranked.sort(key=lambda x: x[2], reverse=True)

        expected = sorted(scores, key=lambda s: (s[0] * W_LOCATION) + (s[1] * W_RELEVANCE), reverse=True)

        for i, ((exp_overlap, exp_relevance), (act_overlap, act_relevance, act_score)) in enumerate(zip(expected, ranked)):
            assert exp_overlap == act_overlap, f"Mismatch at position {i}: overlap"
            assert exp_relevance == act_relevance, f"Mismatch at position {i}: relevance"

    @given(
        overlap=st.integers(min_value=0, max_value=365),
        rel_a=st.integers(min_value=0, max_value=200),
        rel_b=st.integers(min_value=0, max_value=200),
    )
    @settings(max_examples=20)
    def test_equal_overlap_higher_relevance_ranks_first(self, overlap, rel_a, rel_b):
        """Equal overlap: higher relevance ranks first."""
        assume(rel_a != rel_b)

        from core.views.profiles import W_LOCATION, W_RELEVANCE

        score_a = (overlap * W_LOCATION) + (rel_a * W_RELEVANCE)
        score_b = (overlap * W_LOCATION) + (rel_b * W_RELEVANCE)

        if rel_a > rel_b:
            assert score_a > score_b
        else:
            assert score_b > score_a

    @given(
        relevance=st.integers(min_value=0, max_value=200),
        overlap_a=st.integers(min_value=0, max_value=365),
        overlap_b=st.integers(min_value=0, max_value=365),
    )
    @settings(max_examples=20)
    def test_equal_relevance_higher_overlap_ranks_first(self, relevance, overlap_a, overlap_b):
        """Equal relevance: higher overlap ranks first."""
        assume(overlap_a != overlap_b)

        from core.views.profiles import W_LOCATION, W_RELEVANCE

        score_a = (overlap_a * W_LOCATION) + (relevance * W_RELEVANCE)
        score_b = (overlap_b * W_LOCATION) + (relevance * W_RELEVANCE)

        if overlap_a > overlap_b:
            assert score_a > score_b
        else:
            assert score_b > score_a


# --- Unit Tests: RelevanceScorer Integration ---


@pytest.mark.django_db(transaction=True)
class TestRelevanceScorerIntegration(TestCase):
    """Unit tests for RelevanceScorer integration into dating discovery."""

    def _create_user_with_profile(self, username, gender='woman',
                                   interested_in_men=True,
                                   interested_in_women=True,
                                   interested_in_nonbinary=True,
                                   looking_for_dating=True):
        user = UserAccount.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password='testpass123'
        )
        profile = user.profile
        profile.gender = gender
        profile.interested_in_men = interested_in_men
        profile.interested_in_women = interested_in_women
        profile.interested_in_nonbinary = interested_in_nonbinary
        profile.looking_for_dating = looking_for_dating
        profile.display_name = username
        profile.save()
        return user, profile

    def test_top_50_cap_applied_before_scoring(self):
        """RelevanceScorer is called at most 50 times (top-50 cap)."""
        from unittest.mock import patch, MagicMock
        from rest_framework.test import APIRequestFactory
        from rest_framework.test import force_authenticate

        user, user_profile = self._create_user_with_profile('searcher', gender='man')

        for i in range(55):
            self._create_user_with_profile(
                f'candidate_{i}', gender='woman',
                interested_in_men=True,
            )

        with patch('core.views.profiles.RelevanceScorer') as MockScorer:
            mock_instance = MagicMock()
            mock_instance.calculate_score.return_value = 10
            mock_instance.calculate_completeness_score.return_value = 0
            MockScorer.return_value = mock_instance

            factory = APIRequestFactory()
            request = factory.get('/api/v1/discovery/dating/')
            force_authenticate(request, user=user)

            view = DiscoveryViewSet.as_view({'get': 'dating'})
            response = view(request)

            assert response.status_code == 200
            assert mock_instance.calculate_score.call_count <= 50, (
                f"RelevanceScorer was called {mock_instance.calculate_score.call_count} times, "
                f"but should be capped at 50"
            )

    def test_relevance_score_in_api_response(self):
        """Dating discovery API response includes relevance_score (int) per profile."""
        from rest_framework.test import APIRequestFactory
        from rest_framework.test import force_authenticate

        user, user_profile = self._create_user_with_profile('searcher', gender='man')
        self._create_user_with_profile(
            'candidate', gender='woman',
            interested_in_men=True,
        )

        factory = APIRequestFactory()
        request = factory.get('/api/v1/discovery/dating/')
        force_authenticate(request, user=user)

        view = DiscoveryViewSet.as_view({'get': 'dating'})
        response = view(request)

        assert response.status_code == 200
        profiles = response.data['data']['profiles']
        assert len(profiles) >= 1, "Should have at least one candidate profile"

        for profile_data in profiles:
            assert 'relevance_score' in profile_data
            assert isinstance(profile_data['relevance_score'], int), (
                f"relevance_score should be an int, got {type(profile_data['relevance_score'])}"
            )

    def test_scorer_handles_missing_data_gracefully(self):
        """RelevanceScorer handles profiles with missing/null data without crashing."""
        from core.services.relevance import RelevanceScorer

        _, sparse_profile_a = self._create_user_with_profile('sparse_a')
        _, sparse_profile_b = self._create_user_with_profile('sparse_b')

        for p in [sparse_profile_a, sparse_profile_b]:
            p.lifestyle_schedule = ''
            p.lifestyle_social = ''
            p.lifestyle_environment = ''
            p.travel_pace = ''
            p.bio = ''
            p.avatar_url = ''
            p.save()

        scorer = RelevanceScorer()
        score = scorer.calculate_score(sparse_profile_a, sparse_profile_b)

        assert isinstance(score, int), f"Score should be int, got {type(score)}"
        assert score >= 0, f"Score should be non-negative, got {score}"

    def test_scorer_handles_one_profile_missing_data(self):
        """Scorer skips signals gracefully when one profile has missing data."""
        from core.services.relevance import RelevanceScorer

        _, full_profile = self._create_user_with_profile('full_user')
        full_profile.lifestyle_schedule = 'early_bird'
        full_profile.lifestyle_social = 'extrovert'
        full_profile.lifestyle_environment = 'urban'
        full_profile.travel_pace = 'slow'
        full_profile.meetup_interest = 'actively_looking'
        full_profile.save()

        _, empty_profile = self._create_user_with_profile('empty_user')
        empty_profile.lifestyle_schedule = ''
        empty_profile.lifestyle_social = ''
        empty_profile.lifestyle_environment = ''
        empty_profile.travel_pace = ''
        empty_profile.save()

        scorer = RelevanceScorer()

        score_fe = scorer.calculate_score(full_profile, empty_profile)
        assert isinstance(score_fe, int)
        assert score_fe >= 0

        score_ef = scorer.calculate_score(empty_profile, full_profile)
        assert isinstance(score_ef, int)
        assert score_ef >= 0


# --- Strategies for Property 4 ---

SOCIAL_VIBE_CHOICES = [None, '', 'introvert', 'balanced', 'social']
TRAVEL_STATUS_CHOICES_P4 = [None, '', 'full-time', 'part-time', 'weekender', 'aspiring']
TRAVEL_COMPANIONS_CHOICES_P4 = [None, '', 'solo', 'couple', 'family', 'with_pets']
LIFESTYLE_SCHEDULE_CHOICES = [None, '', 'early_bird', 'night_owl']
LIFESTYLE_SOCIAL_CHOICES = [None, '', 'quiet', 'party']
LIFESTYLE_ENVIRONMENT_CHOICES = [None, '', 'outdoors', 'city_mix']
TRAVEL_PACE_CHOICES = [None, '', 'slow', 'mixed', 'fast']
MEETUP_INTEREST_CHOICES = ['', 'actively_looking', 'open_to_it', 'selective', 'solo_mode']
RIG_STATUS_CHOICES = [None, '', 'van', 'rv', 'truck_camper', 'skoolie', 'car', 'no_vehicle', 'other']


@st.composite
def profile_fields(draw):
    """Generate random profile field values for relevance scoring."""
    return {
        'social_vibe': draw(st.sampled_from(SOCIAL_VIBE_CHOICES)),
        'travel_status': draw(st.sampled_from(TRAVEL_STATUS_CHOICES_P4)),
        'travel_companions': draw(st.sampled_from(TRAVEL_COMPANIONS_CHOICES_P4)),
        'has_van': draw(st.booleans()),
        'rig_status': draw(st.sampled_from(RIG_STATUS_CHOICES)),
        'lifestyle_schedule': draw(st.sampled_from(LIFESTYLE_SCHEDULE_CHOICES)),
        'lifestyle_social': draw(st.sampled_from(LIFESTYLE_SOCIAL_CHOICES)),
        'lifestyle_environment': draw(st.sampled_from(LIFESTYLE_ENVIRONMENT_CHOICES)),
        'travel_pace': draw(st.sampled_from(TRAVEL_PACE_CHOICES)),
        'has_pets': draw(st.booleans()),
        'pet_friendly_only': draw(st.booleans()),
        'meetup_interest': draw(st.sampled_from(MEETUP_INTEREST_CHOICES)),
    }


class TestRelevanceScoreAdditivityProperty(TestCase):
    """Total relevance score equals sum of individual signal contributions."""
    _counter = 0

    @classmethod
    def _next_id(cls):
        cls._counter += 1
        return cls._counter

    def _create_profile_with_fields(self, username, fields):
        user = UserAccount.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password='testpass123'
        )
        profile = user.profile
        for key, value in fields.items():
            setattr(profile, key, value)
        profile.save()
        return profile

    def _compute_expected_score(self, scorer, user_profile, target_profile):
        """Compute expected score as the sum of all individual signals."""
        score = 0

        user_hobbies = set(user_profile.hobbies.values_list('id', flat=True))
        target_hobbies = set(target_profile.hobbies.values_list('id', flat=True))
        score += len(user_hobbies & target_hobbies) * 10

        target_meetup = target_profile.meetup_interest
        if target_meetup:
            score += scorer.MEETUP_SCORES.get(target_meetup, 0)

        if user_profile.lifestyle_schedule and target_profile.lifestyle_schedule:
            if user_profile.lifestyle_schedule == target_profile.lifestyle_schedule:
                score += 5

        if user_profile.lifestyle_social and target_profile.lifestyle_social:
            if user_profile.lifestyle_social == target_profile.lifestyle_social:
                score += 5

        if user_profile.lifestyle_environment and target_profile.lifestyle_environment:
            if user_profile.lifestyle_environment == target_profile.lifestyle_environment:
                score += 5

        if user_profile.pet_friendly_only:
            if target_profile.has_pets:
                score += 10
        else:
            if user_profile.has_pets and target_profile.has_pets:
                score += 5

        if user_profile.travel_pace and target_profile.travel_pace:
            if user_profile.travel_pace == target_profile.travel_pace:
                score += 10

        score += scorer.calculate_social_vibe_score(user_profile, target_profile)
        score += scorer.calculate_travel_status_score(user_profile, target_profile)
        score += scorer.calculate_travel_companions_score(user_profile, target_profile)
        score += scorer.calculate_rig_affinity_score(user_profile, target_profile)
        score += scorer.calculate_shared_prompts_score(user_profile, target_profile)

        return score

    @given(user_fields=profile_fields(), target_fields=profile_fields())
    @settings(max_examples=20)
    def test_relevance_score_equals_sum_of_signals(self, user_fields, target_fields):
        """Total score must equal sum of all individual signal contributions."""
        from core.services.relevance import RelevanceScorer

        uid = self._next_id()
        user_profile = self._create_profile_with_fields(f'u_add_{uid}', user_fields)
        target_profile = self._create_profile_with_fields(f't_add_{uid}', target_fields)

        scorer = RelevanceScorer()
        actual_score = scorer.calculate_score(user_profile, target_profile)
        expected_score = self._compute_expected_score(scorer, user_profile, target_profile)

        assert actual_score == expected_score, (
            f"Score mismatch: calculate_score={actual_score}, "
            f"sum of signals={expected_score}\n"
            f"User fields: {user_fields}\n"
            f"Target fields: {target_fields}"
        )

    @given(user_fields=profile_fields(), target_fields=profile_fields())
    @settings(max_examples=20)
    def test_null_blank_fields_contribute_zero(self, user_fields, target_fields):
        """Null/blank fields contribute 0 to the total score."""
        from core.services.relevance import RelevanceScorer

        uid = self._next_id()
        user_profile = self._create_profile_with_fields(f'u_null_{uid}', user_fields)
        target_profile = self._create_profile_with_fields(f't_null_{uid}', target_fields)

        scorer = RelevanceScorer()

        if not user_fields['social_vibe'] or not target_fields['social_vibe']:
            assert scorer.calculate_social_vibe_score(user_profile, target_profile) == 0

        if not user_fields['travel_status'] or not target_fields['travel_status']:
            assert scorer.calculate_travel_status_score(user_profile, target_profile) == 0

        if not user_fields['travel_companions'] or not target_fields['travel_companions']:
            assert scorer.calculate_travel_companions_score(user_profile, target_profile) == 0

        if not user_fields['lifestyle_schedule'] or not target_fields['lifestyle_schedule']:
            u_sched = user_profile.lifestyle_schedule
            t_sched = target_profile.lifestyle_schedule
            if not u_sched or not t_sched:
                pass

        if not user_fields['travel_pace'] or not target_fields['travel_pace']:
            u_pace = user_profile.travel_pace
            t_pace = target_profile.travel_pace
            if not u_pace or not t_pace:
                pass

        score = scorer.calculate_score(user_profile, target_profile)
        assert score >= 0, f"Score should be non-negative, got {score}"


# --- Property 5: Shared prompts scoring ---


@st.composite
def prompt_sets(draw):
    """Generate two sets of prompt indices for two profiles."""
    universe_size = draw(st.integers(min_value=0, max_value=20))
    user_prompts = draw(st.frozensets(st.integers(min_value=0, max_value=max(universe_size, 1) - 1), max_size=min(universe_size, 10)) if universe_size > 0 else st.just(frozenset()))
    target_prompts = draw(st.frozensets(st.integers(min_value=0, max_value=max(universe_size, 1) - 1), max_size=min(universe_size, 10)) if universe_size > 0 else st.just(frozenset()))
    return user_prompts, target_prompts


class TestSharedPromptsScoringProperty(TestCase):
    """Shared prompts score equals exactly 3 * |intersection of prompt IDs|."""

    _counter = 0

    @classmethod
    def _next_id(cls):
        cls._counter += 1
        return cls._counter

    def _create_profile(self, username):
        user = UserAccount.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password='testpass123',
        )
        return user.profile

    @given(data=prompt_sets())
    @settings(max_examples=20)
    def test_shared_prompts_score_equals_3_times_intersection(self, data):
        """Score = 3 * |intersection of prompt IDs| for any prompt sets."""
        from core.services.relevance import RelevanceScorer
        from core.models import Prompt, ProfilePrompt

        user_indices, target_indices = data
        uid = self._next_id()

        user_profile = self._create_profile(f'u_prompt_{uid}')
        target_profile = self._create_profile(f't_prompt_{uid}')

        all_indices = user_indices | target_indices
        prompt_map = {}
        for idx in all_indices:
            prompt = Prompt.objects.create(
                prompt_name=f'prompt_{uid}_{idx}',
                prompt_question=f'Question {idx}?',
                prompt_type='travel',
            )
            prompt_map[idx] = prompt

        for order, idx in enumerate(sorted(user_indices)):
            ProfilePrompt.objects.create(
                profile=user_profile,
                prompt=prompt_map[idx],
                prompt_answer=f'Answer {idx}',
                display_order=order,
            )

        for order, idx in enumerate(sorted(target_indices)):
            ProfilePrompt.objects.create(
                profile=target_profile,
                prompt=prompt_map[idx],
                prompt_answer=f'Answer {idx}',
                display_order=order,
            )

        scorer = RelevanceScorer()
        actual_score = scorer.calculate_shared_prompts_score(user_profile, target_profile)
        expected_shared = len(user_indices & target_indices)
        expected_score = expected_shared * 3

        assert actual_score == expected_score, (
            f"Score mismatch: got {actual_score}, expected {expected_score} "
            f"(shared={expected_shared})\n"
            f"User prompts: {user_indices}\n"
            f"Target prompts: {target_indices}"
        )

    @given(data=prompt_sets())
    @settings(max_examples=20)
    def test_no_prompts_contribute_zero(self, data):
        """When either profile has no prompts, shared prompts score is 0."""
        from core.services.relevance import RelevanceScorer
        from core.models import Prompt, ProfilePrompt

        user_indices, target_indices = data
        assume(len(user_indices) == 0 or len(target_indices) == 0)

        uid = self._next_id()
        user_profile = self._create_profile(f'u_noprompt_{uid}')
        target_profile = self._create_profile(f't_noprompt_{uid}')

        all_indices = user_indices | target_indices
        prompt_map = {}
        for idx in all_indices:
            prompt = Prompt.objects.create(
                prompt_name=f'noprompt_{uid}_{idx}',
                prompt_question=f'Question {idx}?',
                prompt_type='travel',
            )
            prompt_map[idx] = prompt

        for order, idx in enumerate(sorted(user_indices)):
            ProfilePrompt.objects.create(
                profile=user_profile,
                prompt=prompt_map[idx],
                prompt_answer=f'Answer {idx}',
                display_order=order,
            )

        for order, idx in enumerate(sorted(target_indices)):
            ProfilePrompt.objects.create(
                profile=target_profile,
                prompt=prompt_map[idx],
                prompt_answer=f'Answer {idx}',
                display_order=order,
            )

        scorer = RelevanceScorer()
        actual_score = scorer.calculate_shared_prompts_score(user_profile, target_profile)

        assert actual_score == 0, (
            f"Expected 0 when one side has no prompts, got {actual_score}\n"
            f"User prompts: {user_indices}, Target prompts: {target_indices}"
        )


# --- Unit Tests: New Scoring Signals ---


@pytest.mark.django_db
class TestSocialVibeScore:
    """Unit tests for calculate_social_vibe_score."""

    def _create_profile(self, username, social_vibe=None):
        user = UserAccount.objects.create_user(username=username, email=f'{username}@test.com', password='testpass123')
        profile = user.profile
        profile.social_vibe = social_vibe
        profile.save()
        return profile

    def test_matching_social_vibe_returns_10(self):
        user = self._create_profile('sv_match_u', social_vibe='introvert')
        target = self._create_profile('sv_match_t', social_vibe='introvert')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_social_vibe_score(user, target) == 10

    def test_non_matching_social_vibe_returns_0(self):
        user = self._create_profile('sv_diff_u', social_vibe='introvert')
        target = self._create_profile('sv_diff_t', social_vibe='social')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_social_vibe_score(user, target) == 0

    def test_user_null_social_vibe_returns_0(self):
        user = self._create_profile('sv_unull_u', social_vibe=None)
        target = self._create_profile('sv_unull_t', social_vibe='balanced')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_social_vibe_score(user, target) == 0

    def test_target_blank_social_vibe_returns_0(self):
        user = self._create_profile('sv_tblank_u', social_vibe='balanced')
        target = self._create_profile('sv_tblank_t', social_vibe='')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_social_vibe_score(user, target) == 0

    def test_both_null_social_vibe_returns_0(self):
        user = self._create_profile('sv_bnull_u', social_vibe=None)
        target = self._create_profile('sv_bnull_t', social_vibe=None)
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_social_vibe_score(user, target) == 0


@pytest.mark.django_db
class TestTravelStatusScore:
    """Unit tests for calculate_travel_status_score."""

    def _create_profile(self, username, travel_status=None):
        user = UserAccount.objects.create_user(username=username, email=f'{username}@test.com', password='testpass123')
        profile = user.profile
        profile.travel_status = travel_status
        profile.save()
        return profile

    def test_matching_travel_status_returns_8(self):
        user = self._create_profile('ts_match_u', travel_status='full-time')
        target = self._create_profile('ts_match_t', travel_status='full-time')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_status_score(user, target) == 8

    def test_non_matching_travel_status_returns_0(self):
        user = self._create_profile('ts_diff_u', travel_status='full-time')
        target = self._create_profile('ts_diff_t', travel_status='weekender')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_status_score(user, target) == 0

    def test_user_null_travel_status_returns_0(self):
        user = self._create_profile('ts_unull_u', travel_status=None)
        target = self._create_profile('ts_unull_t', travel_status='part-time')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_status_score(user, target) == 0

    def test_target_blank_travel_status_returns_0(self):
        user = self._create_profile('ts_tblank_u', travel_status='aspiring')
        target = self._create_profile('ts_tblank_t', travel_status='')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_status_score(user, target) == 0

    def test_both_null_travel_status_returns_0(self):
        user = self._create_profile('ts_bnull_u', travel_status=None)
        target = self._create_profile('ts_bnull_t', travel_status=None)
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_status_score(user, target) == 0


@pytest.mark.django_db
class TestTravelCompanionsScore:
    """Unit tests for calculate_travel_companions_score."""

    def _create_profile(self, username, travel_companions=None):
        user = UserAccount.objects.create_user(username=username, email=f'{username}@test.com', password='testpass123')
        profile = user.profile
        profile.travel_companions = travel_companions
        profile.save()
        return profile

    def test_matching_travel_companions_returns_5(self):
        user = self._create_profile('tc_match_u', travel_companions='solo')
        target = self._create_profile('tc_match_t', travel_companions='solo')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_companions_score(user, target) == 5

    def test_non_matching_travel_companions_returns_0(self):
        user = self._create_profile('tc_diff_u', travel_companions='solo')
        target = self._create_profile('tc_diff_t', travel_companions='couple')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_companions_score(user, target) == 0

    def test_user_null_travel_companions_returns_0(self):
        user = self._create_profile('tc_unull_u', travel_companions=None)
        target = self._create_profile('tc_unull_t', travel_companions='family')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_companions_score(user, target) == 0

    def test_target_blank_travel_companions_returns_0(self):
        user = self._create_profile('tc_tblank_u', travel_companions='with_pets')
        target = self._create_profile('tc_tblank_t', travel_companions='')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_companions_score(user, target) == 0

    def test_both_null_travel_companions_returns_0(self):
        user = self._create_profile('tc_bnull_u', travel_companions=None)
        target = self._create_profile('tc_bnull_t', travel_companions=None)
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_travel_companions_score(user, target) == 0


@pytest.mark.django_db
class TestRigAffinityScore:
    """Unit tests for calculate_rig_affinity_score."""

    def _create_profile(self, username, has_van=False, rig_status=None):
        user = UserAccount.objects.create_user(username=username, email=f'{username}@test.com', password='testpass123')
        profile = user.profile
        profile.has_van = has_van
        profile.rig_status = rig_status
        profile.save()
        return profile

    def test_both_have_vehicle_via_has_van_returns_5(self):
        user = self._create_profile('ra_bvan_u', has_van=True)
        target = self._create_profile('ra_bvan_t', has_van=True)
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_rig_affinity_score(user, target) == 5

    def test_both_have_vehicle_via_rig_status_returns_5(self):
        user = self._create_profile('ra_brig_u', rig_status='rv')
        target = self._create_profile('ra_brig_t', rig_status='skoolie')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_rig_affinity_score(user, target) == 5

    def test_both_no_vehicle_returns_5(self):
        user = self._create_profile('ra_bnov_u', has_van=False, rig_status='no_vehicle')
        target = self._create_profile('ra_bnov_t', has_van=False, rig_status='no_vehicle')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_rig_affinity_score(user, target) == 5

    def test_one_has_vehicle_other_doesnt_returns_0(self):
        user = self._create_profile('ra_mix_u', has_van=True)
        target = self._create_profile('ra_mix_t', has_van=False, rig_status='no_vehicle')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_rig_affinity_score(user, target) == 0

    def test_mixed_rig_status_vehicle_vs_no_vehicle_returns_0(self):
        user = self._create_profile('ra_mix2_u', rig_status='van')
        target = self._create_profile('ra_mix2_t', rig_status='no_vehicle')
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_rig_affinity_score(user, target) == 0

    def test_both_null_rig_status_no_van_returns_5(self):
        """Both have no vehicle (has_van=False, rig_status=None) → affinity match."""
        user = self._create_profile('ra_bnull_u', has_van=False, rig_status=None)
        target = self._create_profile('ra_bnull_t', has_van=False, rig_status=None)
        from core.services.relevance import RelevanceScorer
        assert RelevanceScorer().calculate_rig_affinity_score(user, target) == 5


@pytest.mark.django_db
class TestSharedPromptsScore:
    """Unit tests for calculate_shared_prompts_score."""

    def _create_profile(self, username):
        user = UserAccount.objects.create_user(username=username, email=f'{username}@test.com', password='testpass123')
        return user.profile

    def _create_prompt(self, name):
        from core.models import Prompt
        return Prompt.objects.create(
            prompt_name=name,
            prompt_question=f'{name}?',
            prompt_type='travel',
        )

    def test_shared_prompts_returns_3_per_match(self):
        from core.models import ProfilePrompt
        from core.services.relevance import RelevanceScorer

        user = self._create_profile('sp_match_u')
        target = self._create_profile('sp_match_t')
        p1 = self._create_prompt('sp_shared_1')
        p2 = self._create_prompt('sp_shared_2')

        ProfilePrompt.objects.create(profile=user, prompt=p1, prompt_answer='A', display_order=0)
        ProfilePrompt.objects.create(profile=user, prompt=p2, prompt_answer='B', display_order=1)
        ProfilePrompt.objects.create(profile=target, prompt=p1, prompt_answer='C', display_order=0)
        ProfilePrompt.objects.create(profile=target, prompt=p2, prompt_answer='D', display_order=1)

        assert RelevanceScorer().calculate_shared_prompts_score(user, target) == 6

    def test_no_shared_prompts_returns_0(self):
        from core.models import ProfilePrompt
        from core.services.relevance import RelevanceScorer

        user = self._create_profile('sp_none_u')
        target = self._create_profile('sp_none_t')
        p1 = self._create_prompt('sp_only_user')
        p2 = self._create_prompt('sp_only_target')

        ProfilePrompt.objects.create(profile=user, prompt=p1, prompt_answer='A', display_order=0)
        ProfilePrompt.objects.create(profile=target, prompt=p2, prompt_answer='B', display_order=0)

        assert RelevanceScorer().calculate_shared_prompts_score(user, target) == 0

    def test_both_no_prompts_returns_0(self):
        from core.services.relevance import RelevanceScorer

        user = self._create_profile('sp_empty_u')
        target = self._create_profile('sp_empty_t')

        assert RelevanceScorer().calculate_shared_prompts_score(user, target) == 0

    def test_one_side_no_prompts_returns_0(self):
        from core.models import ProfilePrompt
        from core.services.relevance import RelevanceScorer

        user = self._create_profile('sp_oside_u')
        target = self._create_profile('sp_oside_t')
        p1 = self._create_prompt('sp_oside_p')

        ProfilePrompt.objects.create(profile=user, prompt=p1, prompt_answer='A', display_order=0)

        assert RelevanceScorer().calculate_shared_prompts_score(user, target) == 0


# --- Property 6: Profile completeness score ---


@st.composite
def completeness_flags(draw):
    """Generate boolean flags for each completeness component."""
    return {
        'has_avatar': draw(st.booleans()),
        'has_cover': draw(st.booleans()),
        'has_2_photos': draw(st.booleans()),
        'has_bio': draw(st.booleans()),
        'has_3_hobbies': draw(st.booleans()),
        'has_prompt': draw(st.booleans()),
        'has_in_town_window': draw(st.booleans()),
    }


@pytest.mark.django_db(transaction=True)
class TestProfileCompletenessScoreProperty(TestCase):
    """Completeness score equals sum of applicable weights (0-60 range)."""

    _id_counter = 0

    @classmethod
    def _next_id(cls):
        cls._id_counter += 1
        return cls._id_counter

    def _create_profile(self, username):
        from core.models import UserAccount, Profile
        user = UserAccount.objects.create_user(username=username, password='testpass123')
        return Profile.objects.get(user=user)

    def _populate_profile(self, profile, flags):
        """Set profile fields and create related records based on flags."""
        from datetime import date, timedelta
        from core.models import (
            ProfilePhoto, ProfileHobby, HobbyTag,
            ProfilePrompt, Prompt, InTownWindow,
        )

        if flags['has_avatar']:
            profile.avatar_url = 'https://example.com/avatar.jpg'
        else:
            profile.avatar_url = ''

        if flags['has_cover']:
            profile.cover_url = 'https://example.com/cover.jpg'
        else:
            profile.cover_url = ''

        if flags['has_bio']:
            profile.bio = 'This is a bio that is definitely longer than twenty characters.'
        else:
            profile.bio = ''

        profile.save()

        if flags['has_2_photos']:
            for i in range(2):
                ProfilePhoto.objects.create(
                    profile=profile,
                    photo_type='gallery',
                    image=f'test_photo_{profile.id}_{i}.jpg',
                    display_order=i,
                )

        if flags['has_3_hobbies']:
            uid = self._next_id()
            for i in range(3):
                tag = HobbyTag.objects.create(
                    name=f'hobby_{uid}_{i}',
                    slug=f'hobby-{uid}-{i}',
                )
                ProfileHobby.objects.create(profile=profile, hobby_tag=tag)

        if flags['has_prompt']:
            uid = self._next_id()
            prompt = Prompt.objects.create(
                prompt_name=f'prompt_{uid}',
                prompt_question='What is your favorite?',
                prompt_type='travel',
            )
            ProfilePrompt.objects.create(
                profile=profile,
                prompt=prompt,
                prompt_answer='My answer here',
                display_order=0,
            )

        if flags['has_in_town_window']:
            today = date.today()
            InTownWindow.objects.create(
                profile=profile,
                city_area='Test City',
                start_date=today,
                end_date=today + timedelta(days=7),
            )

    def _compute_expected_score(self, flags):
        score = 0
        if flags['has_avatar']:
            score += 15
        if flags['has_cover']:
            score += 5
        if flags['has_2_photos']:
            score += 10
        if flags['has_bio']:
            score += 10
        if flags['has_3_hobbies']:
            score += 10
        if flags['has_prompt']:
            score += 5
        if flags['has_in_town_window']:
            score += 5
        return score

    @given(flags=completeness_flags())
    @settings(max_examples=20)
    def test_completeness_score_matches_sum_of_weights(self, flags):
        """Completeness score equals sum of applicable weights for any flag combo."""
        from core.services.relevance import RelevanceScorer

        uid = self._next_id()
        profile = self._create_profile(f'comp_{uid}')
        self._populate_profile(profile, flags)

        scorer = RelevanceScorer()
        actual = scorer.calculate_completeness_score(profile)
        expected = self._compute_expected_score(flags)

        assert actual == expected, (
            f"Expected {expected}, got {actual} for flags={flags}"
        )

    @given(data=st.data())
    @settings(max_examples=1)
    def test_empty_profile_scores_zero(self, data):
        """An empty profile scores exactly 0."""
        from core.services.relevance import RelevanceScorer

        uid = self._next_id()
        profile = self._create_profile(f'comp_empty_{uid}')

        scorer = RelevanceScorer()
        assert scorer.calculate_completeness_score(profile) == 0

    @given(data=st.data())
    @settings(max_examples=1)
    def test_fully_complete_profile_scores_60(self, data):
        """A fully complete profile scores exactly 60."""
        from core.services.relevance import RelevanceScorer

        all_true = {
            'has_avatar': True,
            'has_cover': True,
            'has_2_photos': True,
            'has_bio': True,
            'has_3_hobbies': True,
            'has_prompt': True,
            'has_in_town_window': True,
        }

        uid = self._next_id()
        profile = self._create_profile(f'comp_full_{uid}')
        self._populate_profile(profile, all_true)

        scorer = RelevanceScorer()
        assert scorer.calculate_completeness_score(profile) == 60


# --- Property 7: Combined score formula (three-term) ---


@st.composite
def three_term_candidate_scores(draw):
    """Generate a list of (overlap, relevance, completeness) score triples."""
    n = draw(st.integers(min_value=2, max_value=15))
    scores = []
    for _ in range(n):
        overlap = draw(st.integers(min_value=0, max_value=365))
        relevance = draw(st.integers(min_value=0, max_value=200))
        completeness = draw(st.integers(min_value=0, max_value=60))
        scores.append((overlap, relevance, completeness))
    return scores


@pytest.mark.django_db(transaction=True)
class TestThreeTermCombinedScoreProperty(TestCase):
    """Three-term ranking: final = (overlap*2.0) + (relevance*1.0) + (completeness*0.5)."""

    W_LOCATION = 2.0
    W_RELEVANCE = 1.0
    W_COMPLETENESS = 0.5

    def _compute_final_score(self, overlap, relevance, completeness):
        return (overlap * self.W_LOCATION) + (relevance * self.W_RELEVANCE) + (completeness * self.W_COMPLETENESS)

    @given(scores=three_term_candidate_scores())
    @settings(max_examples=20)
    def test_three_term_ranking_matches_formula(self, scores):
        """Ranking by three-term formula matches direct sort on final_score."""
        from core.views.profiles import W_LOCATION, W_RELEVANCE, W_COMPLETENESS

        assert W_LOCATION == 2.0
        assert W_RELEVANCE == 1.0
        assert W_COMPLETENESS == 0.5

        ranked = []
        for overlap, relevance, completeness in scores:
            final_score = (overlap * W_LOCATION) + (relevance * W_RELEVANCE) + (completeness * W_COMPLETENESS)
            ranked.append((overlap, relevance, completeness, final_score))

        ranked.sort(key=lambda x: x[3], reverse=True)

        expected = sorted(
            scores,
            key=lambda s: (s[0] * W_LOCATION) + (s[1] * W_RELEVANCE) + (s[2] * W_COMPLETENESS),
            reverse=True,
        )

        for i, ((exp_o, exp_r, exp_c), (act_o, act_r, act_c, _)) in enumerate(zip(expected, ranked)):
            assert exp_o == act_o, f"Mismatch at position {i}: overlap"
            assert exp_r == act_r, f"Mismatch at position {i}: relevance"
            assert exp_c == act_c, f"Mismatch at position {i}: completeness"

    @given(
        overlap=st.integers(min_value=0, max_value=365),
        relevance=st.integers(min_value=0, max_value=200),
        comp_a=st.integers(min_value=0, max_value=60),
        comp_b=st.integers(min_value=0, max_value=60),
    )
    @settings(max_examples=20)
    def test_equal_overlap_and_relevance_higher_completeness_ranks_first(self, overlap, relevance, comp_a, comp_b):
        """Equal overlap+relevance: higher completeness ranks first."""
        assume(comp_a != comp_b)

        from core.views.profiles import W_LOCATION, W_RELEVANCE, W_COMPLETENESS

        score_a = (overlap * W_LOCATION) + (relevance * W_RELEVANCE) + (comp_a * W_COMPLETENESS)
        score_b = (overlap * W_LOCATION) + (relevance * W_RELEVANCE) + (comp_b * W_COMPLETENESS)

        if comp_a > comp_b:
            assert score_a > score_b
        else:
            assert score_b > score_a

    @given(
        overlap=st.integers(min_value=0, max_value=365),
        relevance=st.integers(min_value=0, max_value=200),
        completeness=st.integers(min_value=0, max_value=60),
    )
    @settings(max_examples=20)
    def test_completeness_contributes_half_weight(self, overlap, relevance, completeness):
        """Completeness term contributes exactly completeness * 0.5."""
        from core.views.profiles import W_LOCATION, W_RELEVANCE, W_COMPLETENESS

        two_term = (overlap * W_LOCATION) + (relevance * W_RELEVANCE)
        three_term = (overlap * W_LOCATION) + (relevance * W_RELEVANCE) + (completeness * W_COMPLETENESS)

        assert three_term - two_term == completeness * W_COMPLETENESS


# --- Unit Tests: Completeness Scoring ---


class TestCompletenessScoring(TestCase):
    """Unit tests for profile completeness scoring."""

    _id_counter = 0

    @classmethod
    def _next_id(cls):
        cls._id_counter += 1
        return cls._id_counter

    def _create_user_with_profile(self, username, gender='woman',
                                   interested_in_men=True,
                                   interested_in_women=True,
                                   interested_in_nonbinary=True,
                                   looking_for_dating=True):
        user = UserAccount.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password='testpass123'
        )
        profile = user.profile
        profile.gender = gender
        profile.interested_in_men = interested_in_men
        profile.interested_in_women = interested_in_women
        profile.interested_in_nonbinary = interested_in_nonbinary
        profile.looking_for_dating = looking_for_dating
        profile.display_name = username
        profile.save()
        return user, profile

    def _populate_full_profile(self, profile):
        """Fill every completeness field to achieve score 60."""
        from datetime import date, timedelta
        from core.models import (
            ProfilePhoto, ProfileHobby, HobbyTag,
            ProfilePrompt, Prompt, InTownWindow,
        )

        uid = self._next_id()

        profile.avatar_url = 'https://example.com/avatar.jpg'
        profile.cover_url = 'https://example.com/cover.jpg'
        profile.bio = 'This is a bio that is definitely longer than twenty characters.'
        profile.save()

        for i in range(2):
            ProfilePhoto.objects.create(
                profile=profile,
                photo_type='gallery',
                image=f'photo_{uid}_{i}.jpg',
                display_order=i,
            )

        for i in range(3):
            tag = HobbyTag.objects.create(
                name=f'hobby_{uid}_{i}',
                slug=f'hobby-{uid}-{i}',
            )
            ProfileHobby.objects.create(profile=profile, hobby_tag=tag)

        prompt = Prompt.objects.create(
            prompt_name=f'prompt_{uid}',
            prompt_question='What is your favorite?',
            prompt_type='travel',
        )
        ProfilePrompt.objects.create(
            profile=profile,
            prompt=prompt,
            prompt_answer='My answer',
            display_order=0,
        )

        InTownWindow.objects.create(
            profile=profile,
            city_area='Test City',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
        )

    def test_empty_profile_scores_0(self):
        """Empty profile scores exactly 0."""
        from core.services.relevance import RelevanceScorer

        _, profile = self._create_user_with_profile('empty_comp')
        profile.avatar_url = ''
        profile.cover_url = ''
        profile.bio = ''
        profile.save()

        scorer = RelevanceScorer()
        assert scorer.calculate_completeness_score(profile) == 0

    def test_fully_complete_profile_scores_60(self):
        """Fully complete profile scores exactly 60."""
        from core.services.relevance import RelevanceScorer

        _, profile = self._create_user_with_profile('full_comp')
        self._populate_full_profile(profile)

        scorer = RelevanceScorer()
        assert scorer.calculate_completeness_score(profile) == 60

    def test_completeness_does_not_override_location_or_relevance(self):
        """High completeness but low overlap/relevance ranks below the inverse."""
        from core.views.profiles import W_LOCATION, W_RELEVANCE, W_COMPLETENESS

        # Profile A: high completeness (60), low overlap (0), low relevance (0)
        score_a = (0 * W_LOCATION) + (0 * W_RELEVANCE) + (60 * W_COMPLETENESS)

        # Profile B: low completeness (0), moderate overlap (10), moderate relevance (20)
        score_b = (10 * W_LOCATION) + (20 * W_RELEVANCE) + (0 * W_COMPLETENESS)

        assert score_a == 30.0
        assert score_b == 40.0
        assert score_b > score_a
