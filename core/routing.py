from django.urls import re_path

from core.consumers import MatchListConsumer, MatchChatConsumer


websocket_urlpatterns = [
    re_path(r'^ws/matches/$', MatchListConsumer.as_asgi()),
    re_path(r'^ws/matches/(?P<match_id>[0-9a-fA-F-]+)/$', MatchChatConsumer.as_asgi()),
]

