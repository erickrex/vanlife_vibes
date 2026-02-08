# core/serializers/__init__.py
"""
Serializers package for the core app.

This module re-exports all serializers for backwards compatibility.
Serializers are organized into domain-specific modules:
- auth.py: Authentication serializers
- profiles.py: Profile, vehicle, location, and prompt serializers
- matches.py: Person match, swipe, and direct message serializers
- plans.py: Plan and plan message serializers
- activities.py: Activity, swipe, match, and message serializers
- friends.py: Friend request, friendship, and friend message serializers
- analytics.py: Analytics event serializers

Requirements: 2.2, 2.4, 2.6 (Backend File Organization)
"""

# Auth serializers
from .auth import (
    UserAccountSerializer,
    UserRegistrationSerializer,
    UserLoginSerializer,
)

# Profile serializers
from .profiles import (
    ProfileCardDataSerializer,
    CountrySerializer,
    HobbyTagSerializer,
    VehiclePhotoSerializer,
    VehicleSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    VehicleUpdateSerializer,
    VehiclePhotoCreateSerializer,
    FeedCardSerializer,
    ProfileSummarySerializer,
    InTownWindowSerializer,
    CitySerializer,
    PromptListSerializer,
    AvailablePromptSerializer,
    ProfilePromptSerializer,
)

# Match serializers
from .matches import (
    PersonMatchSerializer,
    PersonSwipeSerializer,
    DirectMessageSerializer,
    DirectMessageCreateSerializer,
    UserReportSerializer,
    UserReportCreateSerializer,
)

# Plan serializers
from .plans import (
    PlanAttendeeSerializer,
    PlanMessageSerializer,
    PlanSerializer,
    PlanCreateSerializer,
    PlanUpdateSerializer,
    PlanMessageCreateSerializer,
)

# Activity serializers
from .activities import (
    ActivityCreatedBySerializer,
    ActivitySerializer,
    ActivityCreateSerializer,
    ActivitySwipeSerializer,
    ActivityMatchSerializer,
    ActivityMessageSerializer,
)

# Friend serializers
from .friends import (
    FriendRequestSerializer,
    FriendshipSerializer,
    FriendMessageSerializer,
)

# Analytics serializers
from .analytics import (
    AnalyticsEventSerializer,
    AnalyticsEventCreateSerializer,
)

__all__ = [
    # Auth
    'UserAccountSerializer',
    'UserRegistrationSerializer',
    'UserLoginSerializer',
    # Profile
    'ProfileCardDataSerializer',
    'CountrySerializer',
    'HobbyTagSerializer',
    'VehiclePhotoSerializer',
    'VehicleSerializer',
    'ProfileSerializer',
    'ProfileUpdateSerializer',
    'VehicleUpdateSerializer',
    'VehiclePhotoCreateSerializer',
    'FeedCardSerializer',
    'ProfileSummarySerializer',
    'InTownWindowSerializer',
    'CitySerializer',
    'PromptListSerializer',
    'AvailablePromptSerializer',
    'ProfilePromptSerializer',
    # Match
    'PersonMatchSerializer',
    'PersonSwipeSerializer',
    'DirectMessageSerializer',
    'DirectMessageCreateSerializer',
    'UserReportSerializer',
    'UserReportCreateSerializer',
    # Plan
    'PlanAttendeeSerializer',
    'PlanMessageSerializer',
    'PlanSerializer',
    'PlanCreateSerializer',
    'PlanUpdateSerializer',
    'PlanMessageCreateSerializer',
    # Activity
    'ActivityCreatedBySerializer',
    'ActivitySerializer',
    'ActivityCreateSerializer',
    'ActivitySwipeSerializer',
    'ActivityMatchSerializer',
    'ActivityMessageSerializer',
    # Friend
    'FriendRequestSerializer',
    'FriendshipSerializer',
    'FriendMessageSerializer',
    # Analytics
    'AnalyticsEventSerializer',
    'AnalyticsEventCreateSerializer',
]
