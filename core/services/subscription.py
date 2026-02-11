import logging

from dateutil.parser import isoparse
from django.utils import timezone

from core.models import Profile, UserSubscription

logger = logging.getLogger(__name__)

# RevenueCat webhook event types that activate a premium subscription
PURCHASE_EVENTS = {'INITIAL_PURCHASE', 'RENEWAL'}
# Event types that deactivate the subscription
CANCELLATION_EVENTS = {'CANCELLATION', 'EXPIRATION'}


class SubscriptionService:
    """
    Manages subscription status updates from RevenueCat webhooks
    and provides subscription status lookups.
    """

    @staticmethod
    def update_from_webhook(event_type: str, app_user_id: str, expiration_date: str | None) -> None:
        """
        Update user subscription status based on a RevenueCat webhook event.

        Args:
            event_type: RevenueCat event type (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION)
            app_user_id: The RevenueCat app_user_id, which maps to the Profile's user UUID.
            expiration_date: ISO 8601 expiration timestamp, or None.
        """
        try:
            profile = Profile.objects.get(user__id=app_user_id)
        except Profile.DoesNotExist:
            logger.warning(
                "Webhook received for unknown user: app_user_id=%s, event=%s",
                app_user_id,
                event_type,
            )
            return

        subscription, _created = UserSubscription.objects.get_or_create(
            profile=profile,
            defaults={'revenuecat_app_user_id': app_user_id},
        )

        # Always keep the revenuecat ID up to date
        if subscription.revenuecat_app_user_id != app_user_id:
            subscription.revenuecat_app_user_id = app_user_id

        parsed_expiration = None
        if expiration_date:
            try:
                parsed_expiration = isoparse(expiration_date)
            except (ValueError, TypeError):
                logger.warning(
                    "Invalid expiration_date in webhook: %s", expiration_date
                )

        if event_type in PURCHASE_EVENTS:
            subscription.plan = 'premium'
            subscription.is_active = True
            if parsed_expiration:
                subscription.current_period_end = parsed_expiration
        elif event_type in CANCELLATION_EVENTS:
            subscription.is_active = False
        else:
            logger.info("Unhandled webhook event type: %s", event_type)

        subscription.save()

    @staticmethod
    def get_subscription_status(profile) -> dict:
        """
        Return subscription status dict for the given profile.

        Returns:
            dict with keys: plan, is_premium, current_period_end
        """
        try:
            subscription = profile.subscription
            return {
                'plan': subscription.plan,
                'is_premium': subscription.is_premium,
                'current_period_end': subscription.current_period_end,
            }
        except UserSubscription.DoesNotExist:
            return {
                'plan': 'free',
                'is_premium': False,
                'current_period_end': None,
            }
