"""
Integration test for dating discovery swipe -> match -> chat flow.
"""
import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from core.models import UserAccount, PersonMatch, DirectMessage


@pytest.mark.django_db
class TestDiscoveryDatingFlow(TestCase):
    def setUp(self):
        self.user1 = UserAccount.objects.create_user(
            username='dating_flow_u1',
            email='dating_flow_u1@test.com',
            password='testpass123'
        )
        self.user2 = UserAccount.objects.create_user(
            username='dating_flow_u2',
            email='dating_flow_u2@test.com',
            password='testpass123'
        )

        self.profile1 = self.user1.profile
        self.profile2 = self.user2.profile

        self.profile1.display_name = 'Dating Flow One'
        self.profile2.display_name = 'Dating Flow Two'
        self.profile1.looking_for_dating = True
        self.profile2.looking_for_dating = True
        # Set gender preferences so profiles pass bidirectional gender filter
        self.profile1.gender = 'man'
        self.profile1.interested_in_women = True
        self.profile2.gender = 'woman'
        self.profile2.interested_in_men = True
        self.profile1.save()
        self.profile2.save()

        self.token1, _ = Token.objects.get_or_create(user=self.user1)
        self.token2, _ = Token.objects.get_or_create(user=self.user2)

        self.client1 = APIClient()
        self.client1.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)

        self.client2 = APIClient()
        self.client2.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)

    def test_dating_swipe_match_and_chat(self):
        resp1 = self.client1.get('/api/v1/discovery/dating/')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        profiles1 = resp1.json().get('data', {}).get('profiles', [])
        self.assertTrue(
            any(p['id'] == str(self.profile2.id) for p in profiles1)
        )

        resp2 = self.client2.get('/api/v1/discovery/dating/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        profiles2 = resp2.json().get('data', {}).get('profiles', [])
        self.assertTrue(
            any(p['id'] == str(self.profile1.id) for p in profiles2)
        )

        like1 = self.client1.post(
            '/api/v1/discovery/swipe/',
            {'swiped_on': str(self.profile2.id), 'is_like': True, 'mode': 'dating'},
            format='json'
        )
        self.assertEqual(like1.status_code, status.HTTP_201_CREATED)
        self.assertFalse(like1.json()['data']['is_match'])

        like2 = self.client2.post(
            '/api/v1/discovery/swipe/',
            {'swiped_on': str(self.profile1.id), 'is_like': True, 'mode': 'dating'},
            format='json'
        )
        self.assertEqual(like2.status_code, status.HTTP_201_CREATED)
        self.assertTrue(like2.json()['data']['is_match'])
        match_id = like2.json()['data']['match']['id']

        matches1 = self.client1.get('/api/v1/matches/')
        self.assertEqual(matches1.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(m['id'] == match_id for m in matches1.json().get('data', []))
        )

        send = self.client1.post(
            f'/api/v1/matches/{match_id}/messages/',
            {'content': 'Hello from discovery flow'},
            format='json'
        )
        self.assertEqual(send.status_code, status.HTTP_201_CREATED)
        self.assertEqual(send.json()['data']['content'], 'Hello from discovery flow')

        msgs = self.client2.get(f'/api/v1/matches/{match_id}/messages/')
        self.assertEqual(msgs.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(m['content'] == 'Hello from discovery flow' for m in msgs.json().get('data', []))
        )

        self.assertTrue(PersonMatch.objects.filter(id=match_id).exists())
        self.assertEqual(DirectMessage.objects.filter(match_id=match_id).count(), 1)
