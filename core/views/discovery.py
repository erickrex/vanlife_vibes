"""Discovery ViewSet for dating/friends swiping."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from core.models import Profile, PersonSwipe
from core.serializers import ProfileSerializer, PersonSwipeSerializer
from core.services.swipe_limit import SwipeLimitService
from core.services.relevance import RelevanceScorer


# Combined score weights for dating discovery ranking
W_LOCATION = 2.0
W_RELEVANCE = 1.0
W_COMPLETENESS = 0.5


class DiscoveryViewSet(viewsets.GenericViewSet):
    """Discovery and swiping for dating/friends modes."""
    permission_classes = [IsAuthenticated]

    def _get_user_profile(self, request):
        """Get the current user's profile"""
        try:
            return request.user.profile
        except Profile.DoesNotExist:
            return None

    def _get_swiped_profile_ids(self, user_profile, mode):
        """Get IDs of profiles the user has already swiped on in this mode"""
        return PersonSwipe.objects.filter(
            swiper=user_profile,
            mode=mode
        ).values_list('swiped_on_id', flat=True)

    def _calculate_overlaps(self, user_windows, profile_windows):
        """Calculate overlap score and window details in a single pass.

        Returns (overlap_score, overlap_windows) where overlap_score is the
        total number of overlapping days and overlap_windows is a list of
        dicts describing each overlapping window.
        """
        if not user_windows or not profile_windows:
            return 0, []

        total_overlap_days = 0
        overlaps = []

        for user_window in user_windows:
            for profile_window in profile_windows:
                if user_window.city_area.lower() == profile_window.city_area.lower():
                    overlap_start = max(user_window.start_date, profile_window.start_date)
                    overlap_end = min(user_window.end_date, profile_window.end_date)
                    if overlap_start <= overlap_end:
                        days = (overlap_end - overlap_start).days + 1
                        total_overlap_days += days
                        overlaps.append({
                            'city_area': profile_window.city_area,
                            'start_date': overlap_start.isoformat(),
                            'end_date': overlap_end.isoformat(),
                            'overlap_days': days,
                        })

        return total_overlap_days, overlaps

    def _filter_rankable_windows(self, windows, allow_future):
        """Filter windows used for ranking, gating future windows by premium."""
        today = timezone.now().date()
        if allow_future:
            return [window for window in windows if window.end_date >= today]
        return [window for window in windows if window.start_date <= today <= window.end_date]

    def _apply_filters(self, queryset, request, user_profile):
        """Apply discovery filters (travel_pace, profile_type, pet_compatible)."""
        travel_pace = request.query_params.get('travel_pace')
        if travel_pace:
            queryset = queryset.filter(travel_pace=travel_pace)

        profile_type = request.query_params.get('profile_type')
        if profile_type:
            queryset = queryset.filter(profile_type=profile_type)

        pet_compatible = request.query_params.get('pet_compatible')
        if pet_compatible is not None:
            pet_compatible_bool = pet_compatible.lower() in ('true', '1', 'yes')
            if pet_compatible_bool:
                if user_profile.has_pets:
                    queryset = queryset.filter(
                        Q(pet_friendly_only=False) | Q(has_pets=True)
                    )
                else:
                    queryset = queryset.filter(pet_friendly_only=False)

        return queryset

    def _apply_gender_filters(self, queryset, user_profile):
        """Apply bidirectional gender preference filtering."""
        gender_q = Q()
        if user_profile.interested_in_men:
            gender_q |= Q(gender='man')
        if user_profile.interested_in_women:
            gender_q |= Q(gender='woman')
        if user_profile.interested_in_nonbinary:
            gender_q |= Q(gender='non_binary')
        gender_q |= Q(gender__isnull=True) | Q(gender='')

        if not (user_profile.interested_in_men or user_profile.interested_in_women or user_profile.interested_in_nonbinary):
            return queryset.none()

        queryset = queryset.filter(gender_q)

        user_gender = user_profile.gender
        if user_gender == 'man':
            queryset = queryset.filter(Q(interested_in_men=True) | Q(gender__isnull=True) | Q(gender=''))
        elif user_gender == 'woman':
            queryset = queryset.filter(Q(interested_in_women=True) | Q(gender__isnull=True) | Q(gender=''))
        elif user_gender == 'non_binary':
            queryset = queryset.filter(Q(interested_in_nonbinary=True) | Q(gender__isnull=True) | Q(gender=''))

        return queryset

    def _get_discovery_profiles(self, request, mode):
        """Get filtered and sorted profiles for discovery by mode."""
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return None, Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)

        swiped_ids = self._get_swiped_profile_ids(user_profile, mode)

        queryset = Profile.objects.exclude(
            id=user_profile.id
        ).exclude(
            id__in=swiped_ids
        )

        if mode == 'dating':
            queryset = queryset.filter(looking_for_dating=True)
            queryset = self._apply_gender_filters(queryset, user_profile)
        else:
            queryset = queryset.filter(looking_for_friends=True)

        queryset = self._apply_filters(queryset, request, user_profile)
        queryset = queryset.select_related('user').prefetch_related('in_town_windows', 'hobbies', 'photos')

        user_is_premium = SwipeLimitService.is_premium(user_profile)
        user_windows = self._filter_rankable_windows(
            list(user_profile.in_town_windows.all()),
            allow_future=user_is_premium,
        )

        profiles_with_scores = []
        for profile in queryset:
            candidate_is_premium = SwipeLimitService.is_premium(profile)
            profile_windows = self._filter_rankable_windows(
                list(profile.in_town_windows.all()),
                allow_future=candidate_is_premium,
            )
            overlap_score, profile.overlap_windows = self._calculate_overlaps(user_windows, profile_windows)
            profiles_with_scores.append((profile, overlap_score))

        profiles_with_scores.sort(key=lambda x: x[1], reverse=True)

        top_candidates = profiles_with_scores[:50]
        scorer = RelevanceScorer()
        ranked = []
        for profile, overlap in top_candidates:
            relevance = scorer.calculate_score(user_profile, profile)
            completeness = scorer.calculate_completeness_score(profile)
            final_score = (overlap * W_LOCATION) + (relevance * W_RELEVANCE) + (completeness * W_COMPLETENESS)
            profile.relevance_score = relevance
            ranked.append((profile, final_score))
        ranked.sort(key=lambda x: x[1], reverse=True)
        sorted_profiles = [p[0] for p in ranked]

        return sorted_profiles, None

    @action(detail=False, methods=['get'])
    def dating(self, request):
        """Get profiles for dating mode discovery."""
        profiles, error_response = self._get_discovery_profiles(request, 'dating')
        if error_response:
            return error_response

        user_profile = self._get_user_profile(request)
        serializer = ProfileSerializer(profiles, many=True, context={'request': request})

        return Response({
            'status': 'success',
            'data': {
                'profiles': serializer.data,
                'remaining_swipes': SwipeLimitService.get_remaining_swipes(user_profile),
                'is_premium': SwipeLimitService.is_premium(user_profile),
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def friends(self, request):
        """Get profiles for friends mode discovery."""
        profiles, error_response = self._get_discovery_profiles(request, 'friends')
        if error_response:
            return error_response

        user_profile = self._get_user_profile(request)
        serializer = ProfileSerializer(profiles, many=True, context={'request': request})

        return Response({
            'status': 'success',
            'data': {
                'profiles': serializer.data,
                'remaining_swipes': SwipeLimitService.get_remaining_swipes(user_profile),
                'is_premium': SwipeLimitService.is_premium(user_profile),
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='swipe')
    def swipe(self, request):
        """Record a swipe (like/pass) on a profile."""
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check swipe limit before creating swipe
        if not SwipeLimitService.can_swipe(user_profile):
            user_is_premium = SwipeLimitService.is_premium(user_profile)
            daily_cap = (
                SwipeLimitService.PREMIUM_DAILY_LIMIT
                if user_is_premium
                else SwipeLimitService.FREE_DAILY_LIMIT
            )
            message = (
                f'Daily swipe limit reached. You have used all {daily_cap} swipes for today.'
                if user_is_premium
                else f'Daily swipe limit reached. Free plan allows {daily_cap} swipes/day. Upgrade for 20/day.'
            )
            return Response({
                'status': 'error',
                'message': message,
                'data': {
                    'swipe_limit_reached': True,
                    'remaining_swipes': 0,
                    'is_premium': user_is_premium
                }
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        data['swiper'] = user_profile.id

        serializer = PersonSwipeSerializer(data=data, context={'swiper': user_profile})

        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid swipe data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        swipe = serializer.save()

        match_created = serializer.get_match_created(swipe)
        match = serializer._match if match_created else None

        response_data = {
            'swipe': {
                'id': str(swipe.id),
                'swiped_on': str(swipe.swiped_on.id),
                'is_like': swipe.is_like,
                'mode': swipe.mode,
                'swiped_at': swipe.swiped_at.isoformat()
            }
        }

        if match_created and match:
            response_data['match'] = {
                'id': str(match.id),
                'matched_with': {
                    'id': str(match.get_other_user(user_profile).id),
                    'display_name': match.get_other_user(user_profile).display_name,
                    'avatar_url': match.get_other_user(user_profile).avatar_url
                },
                'mode': match.mode,
                'matched_at': match.matched_at.isoformat()
            }
            response_data['is_match'] = True
        else:
            response_data['is_match'] = False

        response_data['remaining_swipes'] = SwipeLimitService.get_remaining_swipes(user_profile)
        response_data['is_premium'] = SwipeLimitService.is_premium(user_profile)

        return Response({
            'status': 'success',
            'data': response_data
        }, status=status.HTTP_201_CREATED)
