from django.test import TestCase
from django.utils import timezone

from core.models import PersonSwipe, UserAccount, UserSubscription
from core.services.swipe_limit import SwipeLimitService


def _create_user_with_profile(username: str):
    user = UserAccount.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="testpass123",
    )
    return user, user.profile


class SwipeLimitServiceTests(TestCase):
    def _create_swipes(self, swiper, total):
        swiped_at = timezone.now()
        start_index = PersonSwipe.objects.filter(swiper=swiper).count()
        for index in range(start_index, start_index + total):
            _, target_profile = _create_user_with_profile(f"target_{swiper.user.username}_{index}")
            swipe = PersonSwipe.objects.create(
                swiper=swiper,
                swiped_on=target_profile,
                is_like=(index % 2 == 0),
                mode="friends",
            )
            PersonSwipe.objects.filter(id=swipe.id).update(swiped_at=swiped_at)

    def test_free_user_daily_limit_is_five(self):
        _, profile = _create_user_with_profile("free_limit_user")
        self._create_swipes(profile, SwipeLimitService.FREE_DAILY_LIMIT)

        self.assertEqual(SwipeLimitService.get_remaining_swipes(profile), 0)
        self.assertFalse(SwipeLimitService.can_swipe(profile))

    def test_premium_user_daily_limit_is_twenty(self):
        _, profile = _create_user_with_profile("premium_limit_user")
        UserSubscription.objects.create(profile=profile, plan="premium", is_active=True)
        self._create_swipes(profile, SwipeLimitService.PREMIUM_DAILY_LIMIT - 1)

        self.assertEqual(SwipeLimitService.get_remaining_swipes(profile), 1)
        self.assertTrue(SwipeLimitService.can_swipe(profile))

        self._create_swipes(profile, 1)
        self.assertEqual(SwipeLimitService.get_remaining_swipes(profile), 0)
        self.assertFalse(SwipeLimitService.can_swipe(profile))
