"""
Relevance scoring service for friend matching in the nearby feed.

Calculates relevance scores between profiles to sort feed results by compatibility.
Higher scores indicate more relevant matches.

Scoring factors:
- Shared hobbies: +10 per hobby
- Meetup interest: actively_looking=+20, open_to_it=+10, selective=+5
- Lifestyle compatibility: +5 per matching field
- Pet compatibility: +10 if both have pets or no pet requirement
- Travel pace match: +10 if same pace
"""
from typing import List

from core.models import Profile


class RelevanceScorer:
    """Calculates relevance score between profiles for friend matching."""
    
    # Meetup interest level scores
    MEETUP_SCORES = {
        'actively_looking': 20,
        'open_to_it': 10,
        'selective': 5,
        'solo_mode': 0,
    }
    
    def calculate_score(self, user_profile: Profile, target_profile: Profile) -> int:
        """Calculate relevance score between user and target profile."""
        score = 0
        
        # 1. Shared hobbies: +10 per shared hobby
        user_hobbies = set(user_profile.hobbies.values_list('id', flat=True))
        target_hobbies = set(target_profile.hobbies.values_list('id', flat=True))
        shared_hobbies = user_hobbies & target_hobbies
        score += len(shared_hobbies) * 10
        
        # 2. Meetup interest level
        target_meetup = target_profile.meetup_interest
        if target_meetup:
            score += self.MEETUP_SCORES.get(target_meetup, 0)
        
        # 3. Lifestyle compatibility: +5 per match
        # Only compare if user has the field set (not null)
        if user_profile.lifestyle_schedule and target_profile.lifestyle_schedule:
            if user_profile.lifestyle_schedule == target_profile.lifestyle_schedule:
                score += 5
        
        if user_profile.lifestyle_social and target_profile.lifestyle_social:
            if user_profile.lifestyle_social == target_profile.lifestyle_social:
                score += 5
        
        if user_profile.lifestyle_environment and target_profile.lifestyle_environment:
            if user_profile.lifestyle_environment == target_profile.lifestyle_environment:
                score += 5
        
        # 4. Pet compatibility
        if user_profile.pet_friendly_only:
            # User requires pet-friendly matches
            if target_profile.has_pets:
                score += 10
            # Note: profiles without pets should be filtered out earlier
            # if pet_friendly_only=True, but we still give bonus here
        else:
            # No pet requirement - give bonus if both have pets
            if user_profile.has_pets and target_profile.has_pets:
                score += 5
        
        # 5. Travel pace match: +10 if same travel_pace
        if user_profile.travel_pace and target_profile.travel_pace:
            if user_profile.travel_pace == target_profile.travel_pace:
                score += 10
        
        return score
    
    def sort_by_relevance(self, user_profile: Profile, profiles: List[Profile]) -> List[Profile]:
        """Sort profiles by relevance score descending, then by created_at descending."""
        # Calculate scores for each profile
        scored_profiles = [
            (profile, self.calculate_score(user_profile, profile))
            for profile in profiles
        ]
        
        # Sort by score descending, then by created_at descending (newer first)
        scored_profiles.sort(
            key=lambda x: (x[1], x[0].created_at),
            reverse=True
        )
        
        # Return just the profiles in sorted order
        return [profile for profile, score in scored_profiles]
