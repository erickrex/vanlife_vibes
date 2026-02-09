# core/serializers/__init__.py
"""
Serializers package for the core app.

This module re-exports all serializers for backwards compatibility.
Serializers are organized into domain-specific modules:
- auth.py: Authentication serializers
- profiles.py: Profile, vehicle, location, and prompt serializers
- matches.py: Person match, swipe, and direct message serializers (unified for dating + friends)
- events.py: Event, attendee, swipe, and message serializers
- analytics.py: Analytics event serializers

Note: Friend messages now use the unified DirectMessage model from matches.py.

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

# Match serializers (unified for dating + friends messaging)
from .matches import (
    PersonMatchSerializer,
    PersonSwipeSerializer,
    DirectMessageSerializer,
    DirectMessageCreateSerializer,
    UserReportSerializer,
    UserReportCreateSerializer,
)

# Event serializers
from .events import (
    EventCreatedBySerializer,
    EventAttendeeSerializer,
    EventMessageSerializer,
    EventSerializer,
    EventCreateSerializer,
    EventUpdateSerializer,
    EventSwipeSerializer,
    EventSwipeCreateSerializer,
    EventMessageCreateSerializer,
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
    # Match (unified for dating + friends messaging)
    'PersonMatchSerializer',
    'PersonSwipeSerializer',
    'DirectMessageSerializer',
    'DirectMessageCreateSerializer',
    'UserReportSerializer',
    'UserReportCreateSerializer',
    # Event
    'EventCreatedBySerializer',
    'EventAttendeeSerializer',
    'EventMessageSerializer',
    'EventSerializer',
    'EventCreateSerializer',
    'EventUpdateSerializer',
    'EventSwipeSerializer',
    'EventSwipeCreateSerializer',
    'EventMessageCreateSerializer',
    # Analytics
    'AnalyticsEventSerializer',
    'AnalyticsEventCreateSerializer',
]
