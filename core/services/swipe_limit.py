from django.utils import timezone

from core.models import PersonSwipe, UserSubscription


class SwipeLimitService:
    """
    Enforces the daily swipe limit for free users.

    Free users are limited to 3 person-swipes (dating + friends combined) per UTC day.
    Premium users have unlimited swipes.
    """

    FREE_DAILY_LIMIT = 3

    @staticmethod
    def get_daily_swipe_count(profile) -> int:
        """Count swipes made today (UTC) by this profile."""
        today = timezone.now().date()
        return PersonSwipe.objects.filter(
            swiper=profile,
            swiped_at__date=today,
        ).count()

    @staticmethod
    def get_remaining_swipes(profile) -> int | None:
        """Return remaining swipes for free users, None for premium."""
        if SwipeLimitService.is_premium(profile):
            return None
        count = SwipeLimitService.get_daily_swipe_count(profile)
        return max(0, SwipeLimitService.FREE_DAILY_LIMIT - count)

    @staticmethod
    def can_swipe(profile) -> bool:
        """Return True if the user can swipe (premium or under limit)."""
        if SwipeLimitService.is_premium(profile):
            return True
        return SwipeLimitService.get_daily_swipe_count(profile) < SwipeLimitService.FREE_DAILY_LIMIT

    @staticmethod
    def is_premium(profile) -> bool:
        """Check if the profile has an active premium subscription."""
        try:
            return profile.subscription.is_premium
        except UserSubscription.DoesNotExist:
            return False
