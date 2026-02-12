# core/views/__init__.py
"""
Views package for the core app.

Re-exports all ViewSets from their domain-specific modules.
"""

# Re-export the MessageMixin from mixins
from .mixins import MessageMixin

# Import extracted ViewSets from their domain modules
from .auth import AuthViewSet
from .profiles import (
    AnalyticsViewSet,
    ProfileViewSet,
    VehicleViewSet,
    LocationViewSet,
    FeedViewSet,
    DiscoveryViewSet,
)
from .matches import PersonMatchViewSet
from .events import EventViewSet
from .health import health_check
from .subscription import RevenueCatWebhookView, SubscriptionViewSet
from .builder import BuilderListingViewSet

__all__ = [
    'MessageMixin',
    'AuthViewSet',
    'AnalyticsViewSet', 
    'ProfileViewSet',
    'VehicleViewSet',
    'LocationViewSet',
    'FeedViewSet',
    'DiscoveryViewSet',
    'PersonMatchViewSet',
    'EventViewSet',
    'health_check',
    'RevenueCatWebhookView',
    'SubscriptionViewSet',
    'BuilderListingViewSet',
]
