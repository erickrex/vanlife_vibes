from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    AuthViewSet, GroupViewSet, SessionViewSet, TaxonomyViewSet,
    CandidateViewSet, SwipeViewSet, QuestionViewSet,
    UserAnswerViewSet, MatchMessageViewSet, ProfileViewSet, VehicleViewSet,
    LocationViewSet, FeedViewSet, DiscoveryViewSet, PersonMatchViewSet,
    PlanViewSet, ActivityViewSet, FriendViewSet
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'taxonomies', TaxonomyViewSet, basename='taxonomy')
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'swipes', SwipeViewSet, basename='swipe')
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'answers', UserAnswerViewSet, basename='answer')
router.register(r'match-messages', MatchMessageViewSet, basename='match-message')
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
