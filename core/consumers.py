from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.db import models
from rest_framework.authtoken.models import Token

from core.models import PersonMatch, Profile, DirectMessage


class TokenAuthConsumer(AsyncJsonWebsocketConsumer):
    """Base consumer with DRF token auth via ?token= query param."""

    profile = None

    async def authenticate_profile(self):
        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token_key = query_params.get('token', [None])[0]
        if not token_key:
            return None
        return await self._get_profile_from_token(token_key)

    @database_sync_to_async
    def _get_profile_from_token(self, token_key):
        try:
            token = Token.objects.select_related('user__profile').get(key=token_key)
            return token.user.profile
        except (Token.DoesNotExist, Profile.DoesNotExist):
            return None


class MatchListConsumer(TokenAuthConsumer):
    """WebSocket consumer for live updates in the matches list."""

    async def connect(self):
        self.profile = await self.authenticate_profile()
        if not self.profile:
            await self.close(code=4401)
            return

        self.user_group_name = f"user_{self.profile.id}"
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()
        await self.send_json({'type': 'connected', 'channel': 'matches'})

    async def disconnect(self, close_code):
        if getattr(self, 'user_group_name', None):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def match_list_update(self, event):
        await self.send_json({
            'type': 'matches_update',
        })

    async def notification_new_message(self, event):
        await self.send_json({
            'type': 'new_message',
            'match_id': event.get('match_id'),
            'message_id': event.get('message_id'),
        })


class MatchChatConsumer(TokenAuthConsumer):
    """WebSocket consumer for a single match thread."""

    async def connect(self):
        self.profile = await self.authenticate_profile()
        if not self.profile:
            await self.close(code=4401)
            return

        self.match_id = self.scope.get('url_route', {}).get('kwargs', {}).get('match_id')
        if not self.match_id:
            await self.close(code=4404)
            return

        has_access = await self._user_has_match_access(str(self.profile.id), str(self.match_id))
        if not has_access:
            await self.close(code=4403)
            return

        self.match_group_name = f"match_{self.match_id}"
        await self.channel_layer.group_add(self.match_group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'connected',
            'channel': 'match_chat',
            'match_id': self.match_id,
        })

    async def disconnect(self, close_code):
        if getattr(self, 'match_group_name', None):
            await self.channel_layer.group_discard(self.match_group_name, self.channel_name)

    @database_sync_to_async
    def _user_has_match_access(self, profile_id, match_id):
        return PersonMatch.objects.filter(
            id=match_id,
            is_active=True,
        ).filter(
            models.Q(user1_id=profile_id) | models.Q(user2_id=profile_id)
        ).exists()

    async def chat_message(self, event):
        message_data = event.get('message') or {}
        sender_id = str(message_data.get('sender_id') or '')
        current_profile_id = str(self.profile.id)
        message_id = message_data.get('id')

        if message_id and sender_id and sender_id != current_profile_id:
            await self._mark_message_read(message_id)
            message_data['is_read'] = True

        await self.send_json({
            'type': 'chat_message',
            'match_id': event.get('match_id'),
            'message': message_data,
        })

    @database_sync_to_async
    def _mark_message_read(self, message_id):
        DirectMessage.objects.filter(id=message_id).update(is_read=True)
