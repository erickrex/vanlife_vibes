from django.utils import timezone

from core.models import PersonSwipe, UserSubscription


class SwipeLimitService:
    """Enforces daily swipe limits (5/day for free users, 20/day for premium)."""

    FREE_DAILY_LIMIT = 5
    PREMIUM_DAILY_LIMIT = 20

    @staticmethod
    def get_daily_swipe_count(profile) -> int:
        """Count swipes made today (UTC) by this profile."""
        today = timezone.now().date()
        return PersonSwipe.objects.filter(
            swiper=profile,
            swiped_at__date=today,
        ).count()

    @staticmethod
    def get_remaining_swipes(profile) -> int:
        """Return remaining swipes for the profile's plan."""
        daily_limit = (
            SwipeLimitService.PREMIUM_DAILY_LIMIT
            if SwipeLimitService.is_premium(profile)
            else SwipeLimitService.FREE_DAILY_LIMIT
        )
        count = SwipeLimitService.get_daily_swipe_count(profile)
        return max(0, daily_limit - count)

    @staticmethod
    def can_swipe(profile) -> bool:
        """Return True if the user is under their plan's daily swipe limit."""
        daily_limit = (
            SwipeLimitService.PREMIUM_DAILY_LIMIT
            if SwipeLimitService.is_premium(profile)
            else SwipeLimitService.FREE_DAILY_LIMIT
        )
        return SwipeLimitService.get_daily_swipe_count(profile) < daily_limit

    @staticmethod
    def is_premium(profile) -> bool:
        """Check if the profile has an active premium subscription."""
        try:
            return profile.subscription.is_premium
        except UserSubscription.DoesNotExist:
            return False
