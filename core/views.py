# core/views.py
"""
DEPRECATED: This module is maintained for backwards compatibility only.

All ViewSets have been moved to the core.views package:
- core.views.auth - AuthViewSet
- core.views.profiles - ProfileViewSet, VehicleViewSet, LocationViewSet, FeedViewSet, DiscoveryViewSet, AnalyticsViewSet
- core.views.matches - PersonMatchViewSet
- core.views.plans - PlanViewSet
- core.views.activities - ActivityViewSet
- core.views.friends - FriendViewSet

Import from core.views instead of core.views for new code.

Requirements: 2.3 (Backend File Organization)
"""

# Re-export all ViewSets from the views package for backwards compatibility
from core.views import (
    MessageMixin,
    AuthViewSet,
    AnalyticsViewSet,
    ProfileViewSet,
    VehicleViewSet,
    LocationViewSet,
    FeedViewSet,
    DiscoveryViewSet,
    PersonMatchViewSet,
    PlanViewSet,
    ActivityViewSet,
    FriendViewSet,
)

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
