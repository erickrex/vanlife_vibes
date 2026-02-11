# core/serializers/__init__.py
"""Serializers package — re-exports all serializers for backwards compatibility."""

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
    ProfilePhotoSerializer,
    ProfilePhotoUploadSerializer,
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
    'ProfilePhotoSerializer',
    'ProfilePhotoUploadSerializer',
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
