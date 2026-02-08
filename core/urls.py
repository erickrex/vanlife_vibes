from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    AuthViewSet, ProfileViewSet, VehicleViewSet,
    LocationViewSet, FeedViewSet, DiscoveryViewSet, PersonMatchViewSet,
    PlanViewSet, ActivityViewSet, FriendViewSet
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'profiles', VehicleViewSet, basename='vehicle')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'feed', FeedViewSet, basename='feed')
router.register(r'discovery', DiscoveryViewSet, basename='discovery')
router.register(r'matches', PersonMatchViewSet, basename='matches')
router.register(r'plans', PlanViewSet, basename='plans')
router.register(r'activities', ActivityViewSet, basename='activity')
router.register(r'friends', FriendViewSet, basename='friends')

urlpatterns = [
    path('', include(router.urls)),
]
