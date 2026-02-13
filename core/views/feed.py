"""Feed ViewSet for nearby users."""

from datetime import timedelta

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from core.models import Profile, InTownWindow
from core.serializers import FeedCardSerializer
from core.services.feed_filters import FeedFilterService
from core.services.relevance import RelevanceScorer


class FeedViewSet(viewsets.GenericViewSet):
    """Nearby users feed."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='nearby')
    def nearby(self, request):
        """Get nearby users grouped by timing (here_now, here_next_week, here_next_month)."""
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)

        # Get user's current location from InTownWindow (window containing today)
        today = timezone.now().date()
        user_current_window = user_profile.in_town_windows.filter(
            start_date__lte=today,
            end_date__gte=today
        ).first()

        if not user_current_window:
            return Response({
                'status': 'success',
                'data': {
                    'here_now': [],
                    'here_next_week': [],
                    'here_next_month': []
                },
                'message': 'Set your "Now In" location to see nearby travelers.'
            }, status=status.HTTP_200_OK)

        user_city = user_current_window.city_area

        # Query profiles for each timing category
        # Exclude current user from all queries
        # Filter by looking_for_friends=True before location queries
        base_queryset = Profile.objects.exclude(id=user_profile.id).filter(looking_for_friends=True)

        # Apply pet-friendly filter if user requires pet-friendly matches
        if user_profile.pet_friendly_only:
            base_queryset = base_queryset.filter(has_pets=True)

        # Apply relationship status filter based on user's looking_for_friend_type
        if user_profile.looking_for_friend_type == 'singles_only':
            base_queryset = base_queryset.filter(relationship_status='single')
        elif user_profile.looking_for_friend_type == 'couples_only':
            base_queryset = base_queryset.filter(relationship_status__in=['in_relationship', 'married'])

        # Validate and apply query parameter filters
        feed_filter_service = FeedFilterService()

        # Validate filter parameters - return 400 if invalid
        validation_errors = feed_filter_service.validate_filter_params(request)
        if validation_errors:
            return Response({
                'status': 'error',
                'message': 'Invalid filter parameters',
                'errors': validation_errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Apply all query parameter filters to base queryset
        base_queryset = feed_filter_service.apply_filters(base_queryset, request, user_profile)

        # Define time ranges
        next_week_start = today + timedelta(days=7)
        next_week_end = today + timedelta(days=13)
        next_month_start = today + timedelta(days=14)
        next_month_end = today + timedelta(days=44)

        # Here Now: profiles with an InTownWindow containing today in the same city
        here_now_profile_ids = InTownWindow.objects.filter(
            start_date__lte=today,
            end_date__gte=today,
            city_area__iexact=user_city
        ).exclude(
            profile=user_profile
        ).values_list('profile_id', flat=True)
        here_now_profiles = base_queryset.filter(id__in=here_now_profile_ids)

        # Here Next Week: profiles with an InTownWindow starting in next 7-13 days in the same city
        here_next_week_profile_ids = InTownWindow.objects.filter(
            start_date__gte=next_week_start,
            start_date__lte=next_week_end,
            city_area__iexact=user_city
        ).exclude(
            profile=user_profile
        ).values_list('profile_id', flat=True)
        here_next_week_profiles = base_queryset.filter(id__in=here_next_week_profile_ids)

        # Here Next Month: profiles with an InTownWindow starting in next 14-44 days in the same city
        here_next_month_profile_ids = InTownWindow.objects.filter(
            start_date__gte=next_month_start,
            start_date__lte=next_month_end,
            city_area__iexact=user_city
        ).exclude(
            profile=user_profile
        ).values_list('profile_id', flat=True)
        here_next_month_profiles = base_queryset.filter(id__in=here_next_month_profile_ids)

        # Create RelevanceScorer instance for sorting profiles
        relevance_scorer = RelevanceScorer()

        # Convert querysets to lists and sort by relevance within each timing category
        here_now_list = list(here_now_profiles)
        here_next_week_list = list(here_next_week_profiles)
        here_next_month_list = list(here_next_month_profiles)

        # Sort each category by relevance score (descending), with created_at as tiebreaker
        here_now_sorted = relevance_scorer.sort_by_relevance(user_profile, here_now_list)
        here_next_week_sorted = relevance_scorer.sort_by_relevance(user_profile, here_next_week_list)
        here_next_month_sorted = relevance_scorer.sort_by_relevance(user_profile, here_next_month_list)

        # Add timing labels and serialize each category
        here_now_data = []
        for profile in here_now_sorted:
            profile.timing_label = "Here Now"
            here_now_data.append(profile)

        here_next_week_data = []
        for profile in here_next_week_sorted:
            profile.timing_label = "Here Next Week"
            here_next_week_data.append(profile)

        here_next_month_data = []
        for profile in here_next_month_sorted:
            profile.timing_label = "Here Next Month"
            here_next_month_data.append(profile)

        # Serialize the data
        here_now_serialized = FeedCardSerializer(here_now_data, many=True).data
        here_next_week_serialized = FeedCardSerializer(here_next_week_data, many=True).data
        here_next_month_serialized = FeedCardSerializer(here_next_month_data, many=True).data

        return Response({
            'status': 'success',
            'data': {
                'here_now': here_now_serialized,
                'here_next_week': here_next_week_serialized,
                'here_next_month': here_next_month_serialized
            }
        }, status=status.HTTP_200_OK)
