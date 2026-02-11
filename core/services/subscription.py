import logging

from dateutil.parser import isoparse
from django.utils import timezone

from core.models import Profile, UserSubscription

logger = logging.getLogger(__name__)

# RevenueCat events that should activate/maintain entitlement access.
ACTIVE_EVENTS = {
    'INITIAL_PURCHASE',
    'RENEWAL',
    'NON_RENEWING_PURCHASE',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
    'TEMPORARY_ENTITLEMENT_GRANT',
}

# RevenueCat events that should end entitlement access immediately.
INACTIVE_EVENTS = {
    'EXPIRATION',
    'REFUND',
    'REVOKE',
}

# RevenueCat events that should not immediately remove access.
NON_TERMINATING_EVENTS = {
    'CANCELLATION',
    'BILLING_ISSUE',
    'SUBSCRIBER_ALIAS',
    'TRANSFER',
}


class SubscriptionService:
    """Manages subscription status from RevenueCat webhooks."""

    @staticmethod
    def update_from_webhook(event_type: str, app_user_id: str, expiration_date: str | None) -> None:
        """Update user subscription status based on a RevenueCat webhook event."""
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

        parsed_expiration = SubscriptionService._parse_expiration_date(expiration_date)

        if event_type in ACTIVE_EVENTS:
            subscription.plan = 'premium'
            subscription.is_active = SubscriptionService._is_active_from_expiration(parsed_expiration)
            if parsed_expiration:
                subscription.current_period_end = parsed_expiration
        elif event_type in INACTIVE_EVENTS:
            subscription.plan = 'free'
            subscription.is_active = False
            if parsed_expiration:
                subscription.current_period_end = parsed_expiration
        elif event_type in NON_TERMINATING_EVENTS:
            if parsed_expiration:
                subscription.current_period_end = parsed_expiration
                if parsed_expiration <= timezone.now():
                    subscription.plan = 'free'
                    subscription.is_active = False
        else:
            logger.info("Unhandled webhook event type: %s", event_type)

        subscription.save()

    @staticmethod
    def sync_from_client(profile, customer_info: dict, entitlement_id: str = 'premium') -> dict:
        """
        Sync subscription status from RevenueCat customerInfo payload.

        This is a client-triggered fallback for delayed/missed webhooks.
        """
        if not isinstance(customer_info, dict):
            raise ValueError("customer_info must be a JSON object")

        entitlements = customer_info.get('entitlements', {}) or {}
        active_entitlements = entitlements.get('active', {}) or {}
        all_entitlements = entitlements.get('all', {}) or {}

        entitlement = active_entitlements.get(entitlement_id)
        is_active = entitlement is not None

        if entitlement is None:
            entitlement = all_entitlements.get(entitlement_id)

        expiration = SubscriptionService._extract_entitlement_expiration(entitlement)
        if is_active and expiration is not None and expiration <= timezone.now():
            is_active = False

        subscription, _created = UserSubscription.objects.get_or_create(
            profile=profile,
            defaults={'revenuecat_app_user_id': str(profile.user_id)},
        )

        subscription.revenuecat_app_user_id = str(profile.user_id)
        subscription.plan = 'premium' if is_active else 'free'
        subscription.is_active = bool(is_active)
        if expiration is not None:
            subscription.current_period_end = expiration
        subscription.save()

        return SubscriptionService.get_subscription_status(profile)

    @staticmethod
    def get_subscription_status(profile) -> dict:
        """Return subscription status dict (plan, is_premium, current_period_end)."""
        try:
            subscription = profile.subscription
            # Protect against stale active flags if expiration has already passed.
            if (
                subscription.is_active
                and subscription.current_period_end is not None
                and subscription.current_period_end <= timezone.now()
            ):
                subscription.plan = 'free'
                subscription.is_active = False
                subscription.save(update_fields=['plan', 'is_active', 'updated_at'])

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

    @staticmethod
    def _parse_expiration_date(expiration_date: str | None):
        if not expiration_date:
            return None
        try:
            return isoparse(expiration_date)
        except (ValueError, TypeError):
            logger.warning("Invalid expiration_date in webhook: %s", expiration_date)
            return None

    @staticmethod
    def _is_active_from_expiration(expiration):
        if expiration is None:
            return True
        return expiration > timezone.now()

    @staticmethod
    def _extract_entitlement_expiration(entitlement):
        if not isinstance(entitlement, dict):
            return None

        raw_expiration = (
            entitlement.get('expires_date')
            or entitlement.get('expiresDate')
            or entitlement.get('expiration_date')
            or entitlement.get('expirationDate')
        )
        return SubscriptionService._parse_expiration_date(raw_expiration)
