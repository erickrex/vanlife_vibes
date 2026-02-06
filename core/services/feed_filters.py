"""
Feed filter service for the nearby feed.

Validates and applies filter parameters for FeedViewSet.nearby endpoint.
Supports filtering by pets, rig status, travel pace, social vibe, hobbies,
and lifestyle preferences.
"""
from typing import Dict, List, Optional, Any

from django.db.models import QuerySet

from core.models import Profile, HobbyTag


class FeedFilterService:
    """Applies filters to profile querysets based on query parameters."""
    
    # Valid values for each filter parameter
    VALID_RIG_STATUS = ['van', 'rv', 'truck_camper', 'skoolie', 'car', 'no_vehicle', 'other']
    VALID_TRAVEL_PACE = ['slow', 'mixed', 'fast']
    VALID_SOCIAL_VIBE = ['introvert', 'balanced', 'social']
    VALID_LIFESTYLE_SCHEDULE = ['early_bird', 'night_owl']
    VALID_LIFESTYLE_SOCIAL = ['quiet', 'party']
    VALID_LIFESTYLE_ENVIRONMENT = ['outdoors', 'city_mix']
    
    def validate_filter_params(self, request) -> Dict[str, str]:
        """Validate filter parameters. Returns dict of field names to error messages."""
        errors = {}
        query_params = request.query_params
        
        # Validate rig_status
        rig_status = query_params.get('rig_status')
        if rig_status is not None and rig_status not in self.VALID_RIG_STATUS:
            errors['rig_status'] = (
                f"Invalid rig_status. Must be one of: {', '.join(self.VALID_RIG_STATUS)}"
            )
        
        # Validate travel_pace
        travel_pace = query_params.get('travel_pace')
        if travel_pace is not None and travel_pace not in self.VALID_TRAVEL_PACE:
            errors['travel_pace'] = (
                f"Invalid travel_pace. Must be one of: {', '.join(self.VALID_TRAVEL_PACE)}"
            )
        
        # Validate social_vibe
        social_vibe = query_params.get('social_vibe')
        if social_vibe is not None and social_vibe not in self.VALID_SOCIAL_VIBE:
            errors['social_vibe'] = (
                f"Invalid social_vibe. Must be one of: {', '.join(self.VALID_SOCIAL_VIBE)}"
            )
        
        # Validate lifestyle_schedule
        lifestyle_schedule = query_params.get('lifestyle_schedule')
        if lifestyle_schedule is not None and lifestyle_schedule not in self.VALID_LIFESTYLE_SCHEDULE:
            errors['lifestyle_schedule'] = (
                f"Invalid lifestyle_schedule. Must be one of: {', '.join(self.VALID_LIFESTYLE_SCHEDULE)}"
            )
        
        # Validate lifestyle_social
        lifestyle_social = query_params.get('lifestyle_social')
        if lifestyle_social is not None and lifestyle_social not in self.VALID_LIFESTYLE_SOCIAL:
            errors['lifestyle_social'] = (
                f"Invalid lifestyle_social. Must be one of: {', '.join(self.VALID_LIFESTYLE_SOCIAL)}"
            )
        
        # Validate lifestyle_environment
        lifestyle_environment = query_params.get('lifestyle_environment')
        if lifestyle_environment is not None and lifestyle_environment not in self.VALID_LIFESTYLE_ENVIRONMENT:
            errors['lifestyle_environment'] = (
                f"Invalid lifestyle_environment. Must be one of: {', '.join(self.VALID_LIFESTYLE_ENVIRONMENT)}"
            )
        
        # Validate hobbies (comma-separated slugs)
        hobbies_param = query_params.get('hobbies')
        if hobbies_param:
            hobby_slugs = [slug.strip() for slug in hobbies_param.split(',') if slug.strip()]
            for slug in hobby_slugs:
                if not HobbyTag.objects.filter(slug=slug).exists():
                    errors['hobbies'] = f"Invalid hobby: {slug}. Hobby not found."
                    break  # Report first invalid hobby
        
        return errors
    
    def apply_filters(self, queryset: QuerySet, request, user_profile: Profile) -> QuerySet:
        """Apply all query parameter filters to the queryset with AND logic."""
        query_params = request.query_params
        
        # Filter by has_pets (boolean)
        has_pets = query_params.get('has_pets')
        if has_pets is not None:
            # Convert string to boolean
            has_pets_bool = has_pets.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(has_pets=has_pets_bool)
        
        # Filter by rig_status
        rig_status = query_params.get('rig_status')
        if rig_status is not None:
            queryset = queryset.filter(rig_status=rig_status)
        
        # Filter by travel_pace
        travel_pace = query_params.get('travel_pace')
        if travel_pace is not None:
            queryset = queryset.filter(travel_pace=travel_pace)
        
        # Filter by social_vibe
        social_vibe = query_params.get('social_vibe')
        if social_vibe is not None:
            queryset = queryset.filter(social_vibe=social_vibe)
        
        # Filter by lifestyle_schedule
        lifestyle_schedule = query_params.get('lifestyle_schedule')
        if lifestyle_schedule is not None:
            queryset = queryset.filter(lifestyle_schedule=lifestyle_schedule)
        
        # Filter by lifestyle_social
        lifestyle_social = query_params.get('lifestyle_social')
        if lifestyle_social is not None:
            queryset = queryset.filter(lifestyle_social=lifestyle_social)
        
        # Filter by lifestyle_environment
        lifestyle_environment = query_params.get('lifestyle_environment')
        if lifestyle_environment is not None:
            queryset = queryset.filter(lifestyle_environment=lifestyle_environment)
        
        # Filter by hobbies (comma-separated slugs)
        # Profiles must have at least one matching hobby
        hobbies_param = query_params.get('hobbies')
        if hobbies_param:
            hobby_slugs = [slug.strip() for slug in hobbies_param.split(',') if slug.strip()]
            if hobby_slugs:
                # Filter to profiles that have at least one of the specified hobbies
                queryset = queryset.filter(hobbies__slug__in=hobby_slugs).distinct()
        
        return queryset
