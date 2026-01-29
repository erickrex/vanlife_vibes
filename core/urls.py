from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    AuthViewSet, GroupViewSet, SessionViewSet, TaxonomyViewSet,
    CandidateViewSet, SwipeViewSet, QuestionViewSet,
    UserAnswerViewSet, MatchMessageViewSet
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

urlpatterns = [
    path('', include(router.urls)),
]
