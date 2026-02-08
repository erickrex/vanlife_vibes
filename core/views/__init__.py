# core/views/__init__.py
"""
Views package for the core app.

This module re-exports all ViewSets for backwards compatibility.
ViewSets are being progressively extracted from the original views.py
into separate domain-specific modules.

Requirements: 2.1, 2.3, 2.5 (Backend File Organization)
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
from .plans import PlanViewSet
from .activities import ActivityViewSet
from .friends import FriendViewSet

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
    'PlanViewSet',
    'ActivityViewSet',
    'FriendViewSet',
]
