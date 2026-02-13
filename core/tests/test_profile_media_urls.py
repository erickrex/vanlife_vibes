from django.test import TestCase
from rest_framework.test import APIClient

from core.models import UserAccount


class ProfileMediaUrlNormalizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username="media_url_user",
            email="media_url_user@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

    def test_profile_me_returns_absolute_avatar_and_cover_urls(self):
        profile = self.user.profile
        profile.avatar_url = "/media/profile_photos/2026/02/avatar.jpg"
        profile.cover_url = "media/profile_photos/2026/02/cover.jpg"
        profile.save(update_fields=["avatar_url", "cover_url"])

        response = self.client.get("/api/v1/profiles/me/")

        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(
            data["avatar_url"],
            "http://testserver/media/profile_photos/2026/02/avatar.jpg",
        )
        self.assertEqual(
            data["cover_url"],
            "http://testserver/media/profile_photos/2026/02/cover.jpg",
        )
