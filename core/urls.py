from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    AuthViewSet, ProfileViewSet, VehicleViewSet,
    LocationViewSet, FeedViewSet, DiscoveryViewSet, PersonMatchViewSet,
    AnalyticsViewSet, EventViewSet, health_check,
    SubscriptionViewSet, RevenueCatWebhookView,
    BuilderListingViewSet,
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'profiles', VehicleViewSet, basename='vehicle')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'feed', FeedViewSet, basename='feed')
router.register(r'discovery', DiscoveryViewSet, basename='discovery')
router.register(r'matches', PersonMatchViewSet, basename='matches')
router.register(r'analytics', AnalyticsViewSet, basename='analytics')
router.register(r'events', EventViewSet, basename='events')
router.register(r'subscription', SubscriptionViewSet, basename='subscription')
router.register(r'builder', BuilderListingViewSet, basename='builder')

urlpatterns = [
    path('', include(router.urls)),
    path('health/', health_check, name='health-check'),
    path('webhooks/revenuecat/', RevenueCatWebhookView.as_view(), name='revenuecat-webhook'),
]
