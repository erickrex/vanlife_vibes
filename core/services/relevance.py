"""Relevance scoring for friend matching in the nearby feed."""
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
        
        # 6. Social vibe match: +10
        score += self.calculate_social_vibe_score(user_profile, target_profile)
        
        # 7. Travel status match: +8
        score += self.calculate_travel_status_score(user_profile, target_profile)
        
        # 8. Travel companions match: +5
        score += self.calculate_travel_companions_score(user_profile, target_profile)
        
        # 9. Rig affinity: +5
        score += self.calculate_rig_affinity_score(user_profile, target_profile)
        
        # 10. Shared prompts: +3 per shared prompt
        score += self.calculate_shared_prompts_score(user_profile, target_profile)
        
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

    def calculate_social_vibe_score(self, user_profile: Profile, target_profile: Profile) -> int:
        """+10 if social_vibe matches."""
        if user_profile.social_vibe and target_profile.social_vibe:
            return 10 if user_profile.social_vibe == target_profile.social_vibe else 0
        return 0

    def calculate_travel_status_score(self, user_profile: Profile, target_profile: Profile) -> int:
        """+8 if travel_status matches."""
        if user_profile.travel_status and target_profile.travel_status:
            return 8 if user_profile.travel_status == target_profile.travel_status else 0
        return 0

    def calculate_travel_companions_score(self, user_profile: Profile, target_profile: Profile) -> int:
        """+5 if travel_companions match."""
        if user_profile.travel_companions and target_profile.travel_companions:
            return 5 if user_profile.travel_companions == target_profile.travel_companions else 0
        return 0

    def calculate_rig_affinity_score(self, user_profile: Profile, target_profile: Profile) -> int:
        """+5 if both have vehicles or both don't."""
        user_has = user_profile.has_van or (user_profile.rig_status and user_profile.rig_status != 'no_vehicle')
        target_has = target_profile.has_van or (target_profile.rig_status and target_profile.rig_status != 'no_vehicle')
        return 5 if user_has == target_has else 0

    def calculate_shared_prompts_score(self, user_profile: Profile, target_profile: Profile) -> int:
        """+3 per shared prompt topic."""
        user_prompts = set(user_profile.prompts.values_list('prompt_id', flat=True))
        target_prompts = set(target_profile.prompts.values_list('prompt_id', flat=True))
        return len(user_prompts & target_prompts) * 3

    def calculate_completeness_score(self, profile: Profile) -> int:
        """Compute profile completeness score (0-60)."""
        score = 0
        if profile.avatar_url:
            score += 15
        if profile.cover_url:
            score += 5
        if profile.photos.count() >= 2:
            score += 10
        if profile.bio and len(profile.bio) > 20:
            score += 10
        if profile.profile_hobbies.count() >= 3:
            score += 10
        if profile.prompts.count() >= 1:
            score += 5
        if profile.in_town_windows.count() >= 1:
            score += 5
        return score


