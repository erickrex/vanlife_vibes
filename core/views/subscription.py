"""
Subscription views for RevenueCat webhook handling and subscription status.

Provides:
- RevenueCatWebhookView: Receives and processes RevenueCat webhook events
- SubscriptionViewSet: Returns user subscription status
"""

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from core.services.subscription import SubscriptionService

logger = logging.getLogger(__name__)


class RevenueCatWebhookView(APIView):
    """
    Receives webhook events from RevenueCat to sync subscription status.

    POST /webhooks/revenuecat/

    Validates the Authorization header against REVENUECAT_WEBHOOK_SECRET,
    parses the event payload, and delegates to SubscriptionService.

    Returns 401 for invalid/missing auth, 200 for all valid requests
    (including unknown users — to prevent RevenueCat retries).
    """

    authentication_classes = []  # Webhook uses its own auth
    permission_classes = [AllowAny]

    def post(self, request):
        # Validate authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        expected_secret = getattr(settings, 'REVENUECAT_WEBHOOK_SECRET', '')

        if not expected_secret or not self._is_valid_auth(auth_header, expected_secret):
            return Response(
                {'status': 'error', 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Parse event from webhook payload
        event = request.data.get('event', {})
        event_type = event.get('type', '')
        app_user_id = event.get('app_user_id', '')
        expiration_at_ms = event.get('expiration_at_ms')

        if not event_type or not app_user_id:
            logger.warning("Webhook missing event type or app_user_id: %s", request.data)
            return Response(
                {'status': 'success', 'message': 'Event ignored (missing fields)'},
                status=status.HTTP_200_OK,
            )

        # Convert expiration_at_ms to ISO 8601 string if present
        expiration_date = None
        if expiration_at_ms is not None:
            try:
                from datetime import datetime, timezone

                expiration_date = datetime.fromtimestamp(
                    expiration_at_ms / 1000, tz=timezone.utc
                ).isoformat()
            except (ValueError, TypeError, OverflowError):
                logger.warning("Invalid expiration_at_ms: %s", expiration_at_ms)

        # Delegate to SubscriptionService
        SubscriptionService.update_from_webhook(event_type, app_user_id, expiration_date)

        return Response(
            {'status': 'success', 'message': 'Webhook processed'},
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _is_valid_auth(auth_header: str, expected_secret: str) -> bool:
        """Check if the Authorization header matches the expected Bearer token."""
        if not auth_header:
            return False
        parts = auth_header.split(' ', 1)
        if len(parts) != 2 or parts[0] != 'Bearer':
            return False
        return parts[1] == expected_secret

class SubscriptionViewSet(ViewSet):
    """
    ViewSet for subscription status.

    GET /subscription/status/ — Return the authenticated user's subscription info.
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Return the user's subscription plan, premium flag, and period end."""
        profile = request.user.profile
        data = SubscriptionService.get_subscription_status(profile)
        return Response(
            {'status': 'success', 'data': data},
            status=status.HTTP_200_OK,
        )

