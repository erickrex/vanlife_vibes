from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    AuthViewSet, ProfileViewSet, VehicleViewSet,
    LocationViewSet, FeedViewSet, DiscoveryViewSet, PersonMatchViewSet,
    FriendViewSet, AnalyticsViewSet, EventViewSet
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'profiles', VehicleViewSet, basename='vehicle')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'feed', FeedViewSet, basename='feed')
router.register(r'discovery', DiscoveryViewSet, basename='discovery')
router.register(r'matches', PersonMatchViewSet, basename='matches')
router.register(r'friends', FriendViewSet, basename='friends')
router.register(r'analytics', AnalyticsViewSet, basename='analytics')
router.register(r'events', EventViewSet, basename='events')

urlpatterns = [
    path('', include(router.urls)),
]
