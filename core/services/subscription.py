import logging
from datetime import timedelta

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

TRIAL_LENGTH_DAYS = 7


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
            subscription.is_trial = False
            if parsed_expiration:
                subscription.current_period_end = parsed_expiration
        elif event_type in INACTIVE_EVENTS:
            subscription.plan = 'free'
            subscription.is_active = False
            subscription.is_trial = False
            if parsed_expiration:
                subscription.current_period_end = parsed_expiration
        elif event_type in NON_TERMINATING_EVENTS:
            if parsed_expiration:
                subscription.current_period_end = parsed_expiration
                if parsed_expiration <= timezone.now():
                    subscription.plan = 'free'
                    subscription.is_active = False
                    subscription.is_trial = False
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
        subscription.is_trial = False
        if expiration is not None:
            subscription.current_period_end = expiration
        subscription.save()

        return SubscriptionService.get_subscription_status(profile)

    @staticmethod
    def get_subscription_status(profile) -> dict:
        """Return subscription status dict (plan, is_premium, current_period_end)."""
        try:
            subscription = profile.subscription
            now = timezone.now()

            if (
                subscription.is_trial
                and subscription.trial_ends_at is not None
                and subscription.trial_ends_at <= now
            ):
                subscription.plan = 'free'
                subscription.is_active = False
                subscription.is_trial = False
                subscription.current_period_end = subscription.trial_ends_at
                subscription.save(
                    update_fields=[
                        'plan',
                        'is_active',
                        'is_trial',
                        'current_period_end',
                        'updated_at',
                    ]
                )

            # Protect against stale active flags if expiration has already passed.
            if (
                subscription.is_active
                and subscription.current_period_end is not None
                and subscription.current_period_end <= now
            ):
                subscription.plan = 'free'
                subscription.is_active = False
                subscription.is_trial = False
                subscription.save(update_fields=['plan', 'is_active', 'is_trial', 'updated_at'])

            trial_used = subscription.trial_started_at is not None
            trial_active = (
                subscription.is_trial
                and subscription.is_active
                and subscription.trial_ends_at is not None
                and subscription.trial_ends_at > now
            )
            requires_billing_details = (
                trial_used
                and not subscription.is_premium
                and subscription.trial_ends_at is not None
                and subscription.trial_ends_at <= now
            )

            return {
                'plan': subscription.plan,
                'is_premium': subscription.is_premium,
                'current_period_end': subscription.current_period_end,
                'trial_used': trial_used,
                'is_trial_active': trial_active,
                'trial_started_at': subscription.trial_started_at,
                'trial_ends_at': subscription.trial_ends_at,
                'requires_billing_details': requires_billing_details,
            }
        except UserSubscription.DoesNotExist:
            return {
                'plan': 'free',
                'is_premium': False,
                'current_period_end': None,
                'trial_used': False,
                'is_trial_active': False,
                'trial_started_at': None,
                'trial_ends_at': None,
                'requires_billing_details': False,
            }

    @staticmethod
    def start_free_trial(profile) -> dict:
        """Activate a one-time 7-day premium trial."""
        now = timezone.now()
        subscription, _created = UserSubscription.objects.get_or_create(
            profile=profile,
            defaults={'revenuecat_app_user_id': str(profile.user_id)},
        )

        if subscription.is_active and not subscription.is_trial:
            raise ValueError("Premium is already active")

        trial_used = subscription.trial_started_at is not None
        if trial_used:
            if (
                subscription.is_trial
                and subscription.is_active
                and subscription.trial_ends_at is not None
                and subscription.trial_ends_at > now
            ):
                return SubscriptionService.get_subscription_status(profile)
            raise ValueError("Free trial already used")

        trial_end = now + timedelta(days=TRIAL_LENGTH_DAYS)
        subscription.revenuecat_app_user_id = str(profile.user_id)
        subscription.plan = 'premium'
        subscription.is_active = True
        subscription.is_trial = True
        subscription.trial_started_at = now
        subscription.trial_ends_at = trial_end
        subscription.current_period_end = trial_end
        subscription.save()

        return SubscriptionService.get_subscription_status(profile)

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
