"""
Tests for Profile API endpoints.

Tests the ProfileViewSet which provides:
- GET /profiles/me/ - Get current user's profile
- PATCH /profiles/me/ - Update current user's profile
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from core.models import (
    UserAccount, Profile, Country, Region, HobbyTag, Vehicle, Follow, Prompt
)


class ProfileMeAPITestCase(TestCase):
    """Test /profiles/me/ endpoint"""

    def setUp(self):
        self.client = APIClient()
        # Create user (profile is auto-created via signal)
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create location data for testing (use get_or_create since data migration may have seeded them)
        self.country, _ = Country.objects.get_or_create(
            code='US',
            defaults={'name': 'United States'}
        )
        self.region, _ = Region.objects.get_or_create(
            country=self.country,
            name='California'
        )
        self.region2, _ = Region.objects.get_or_create(
            country=self.country,
            name='Oregon'
        )
        
        # Create hobby tags
        self.hobby1 = HobbyTag.objects.create(name='Hiking', slug='hiking')
        self.hobby2 = HobbyTag.objects.create(name='Surfing', slug='surfing')

    def test_get_my_profile(self):
        """Test GET /profiles/me/ returns current user's profile"""
        response = self.client.get('/api/v1/profiles/me/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('data', response.data)
        
        # Verify profile data
        profile_data = response.data['data']
        self.assertEqual(profile_data['username'], 'testuser')
        self.assertEqual(profile_data['user_id'], str(self.user.id))
        
        # Verify default values
        self.assertFalse(profile_data['has_van'])
        self.assertFalse(profile_data['looking_for_dating'])
        self.assertTrue(profile_data['looking_for_friends'])

    def test_get_my_profile_unauthenticated(self):
        """Test GET /profiles/me/ requires authentication"""
        self.client.logout()
        response = self.client.get('/api/v1/profiles/me/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_my_profile_basic_fields(self):
        """Test PATCH /profiles/me/ updates basic profile fields"""
        data = {
            'display_name': 'Test User',
            'bio': 'I love van life!',
            'current_location': 'San Francisco, CA',
            'home_base': 'Los Angeles, CA'
        }
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        profile_data = response.data['data']
        self.assertEqual(profile_data['display_name'], 'Test User')
        self.assertEqual(profile_data['bio'], 'I love van life!')
        self.assertEqual(profile_data['current_location'], 'San Francisco, CA')
        self.assertEqual(profile_data['home_base'], 'Los Angeles, CA')

    def test_update_my_profile_looking_for(self):
        """Test PATCH /profiles/me/ updates looking_for fields"""
        data = {
            'looking_for_dating': True,
            'looking_for_friends': True
        }
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['data']['looking_for_dating'])
        self.assertTrue(response.data['data']['looking_for_friends'])

    def test_update_my_profile_looking_for_validation(self):
        """Test PATCH /profiles/me/ requires at least one looking_for option"""
        data = {
            'looking_for_dating': False,
            'looking_for_friends': False
        }
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('errors', response.data)

    def test_update_my_profile_lifestyle_tags(self):
        """Test PATCH /profiles/me/ updates lifestyle tags"""
        data = {
            'travel_status': 'full-time',
            'travel_companions': 'solo',
            'work_status': 'remote_worker',
            'travel_pace': 'slow'
        }
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile_data = response.data['data']
        self.assertEqual(profile_data['travel_status'], 'full-time')
        self.assertEqual(profile_data['travel_companions'], 'solo')
        self.assertEqual(profile_data['work_status'], 'remote_worker')
        self.assertEqual(profile_data['travel_pace'], 'slow')

    def test_update_my_profile_has_van(self):
        """Test PATCH /profiles/me/ updates has_van flag"""
        data = {'has_van': True}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['data']['has_van'])

    def test_update_my_profile_camping_preferences(self):
        """Test PATCH /profiles/me/ updates camping preferences"""
        data = {
            'has_van': True,
            'camping_preferences': ['boondocking', 'campgrounds']
        }
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['data']['camping_preferences'],
            ['boondocking', 'campgrounds']
        )

    def test_update_my_profile_hobbies(self):
        """Test PATCH /profiles/me/ updates hobbies"""
        data = {
            'hobby_ids': [str(self.hobby1.id), str(self.hobby2.id)]
        }
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        hobbies = response.data['data']['hobbies']
        self.assertEqual(len(hobbies), 2)
        hobby_names = [h['name'] for h in hobbies]
        self.assertIn('Hiking', hobby_names)
        self.assertIn('Surfing', hobby_names)


class ProfileLocationTimestampTestCase(TestCase):
    """Test location timestamp updates when location fields change."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create location data (use get_or_create since data migration may have seeded them)
        self.country, _ = Country.objects.get_or_create(
            code='US',
            defaults={'name': 'United States'}
        )
        self.region1, _ = Region.objects.get_or_create(
            country=self.country,
            name='California'
        )
        self.region2, _ = Region.objects.get_or_create(
            country=self.country,
            name='Oregon'
        )

    def test_update_now_in_sets_timestamp(self):
        """Test updating now_in sets now_in_updated_at timestamp"""
        # Get initial profile state
        profile = Profile.objects.get(user=self.user)
        self.assertIsNone(profile.now_in_updated_at)
        
        # Update now_in
        data = {'now_in_region_id': str(self.region1.id)}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify timestamp was set
        profile.refresh_from_db()
        self.assertIsNotNone(profile.now_in_updated_at)
        self.assertEqual(profile.now_in, self.region1)
        
        # Verify response includes location data
        now_in_data = response.data['data']['now_in']
        self.assertIsNotNone(now_in_data)
        self.assertEqual(now_in_data['region']['name'], 'California')
        self.assertEqual(now_in_data['country']['name'], 'United States')

    def test_update_next_week_in_sets_timestamp(self):
        """Test updating next_week_in sets next_week_in_updated_at timestamp"""
        profile = Profile.objects.get(user=self.user)
        self.assertIsNone(profile.next_week_in_updated_at)
        
        data = {'next_week_in_region_id': str(self.region1.id)}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        profile.refresh_from_db()
        self.assertIsNotNone(profile.next_week_in_updated_at)
        self.assertEqual(profile.next_week_in, self.region1)

    def test_update_next_month_in_sets_timestamp(self):
        """Test updating next_month_in sets next_month_in_updated_at timestamp"""
        profile = Profile.objects.get(user=self.user)
        self.assertIsNone(profile.next_month_in_updated_at)
        
        data = {'next_month_in_region_id': str(self.region1.id)}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        profile.refresh_from_db()
        self.assertIsNotNone(profile.next_month_in_updated_at)
        self.assertEqual(profile.next_month_in, self.region1)

    def test_changing_location_updates_timestamp(self):
        """Test changing location to different region updates timestamp"""
        # Set initial location
        data = {'now_in_region_id': str(self.region1.id)}
        self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        profile = Profile.objects.get(user=self.user)
        initial_timestamp = profile.now_in_updated_at
        
        # Wait a moment and change location
        import time
        time.sleep(0.01)  # Small delay to ensure timestamp difference
        
        data = {'now_in_region_id': str(self.region2.id)}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        profile.refresh_from_db()
        self.assertEqual(profile.now_in, self.region2)
        self.assertGreater(profile.now_in_updated_at, initial_timestamp)

    def test_same_location_does_not_update_timestamp(self):
        """Test setting same location does not update timestamp"""
        # Set initial location
        data = {'now_in_region_id': str(self.region1.id)}
        self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        profile = Profile.objects.get(user=self.user)
        initial_timestamp = profile.now_in_updated_at
        
        # Set same location again
        data = {'now_in_region_id': str(self.region1.id)}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        profile.refresh_from_db()
        # Timestamp should remain the same
        self.assertEqual(profile.now_in_updated_at, initial_timestamp)


class ProfileValidationTestCase(TestCase):
    """Test profile field validation"""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    def test_display_name_max_length(self):
        """Test display_name max 50 characters"""
        data = {'display_name': 'a' * 51}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('display_name', response.data['errors'])

    def test_bio_max_length(self):
        """Test bio max 500 characters"""
        data = {'bio': 'a' * 501}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('bio', response.data['errors'])

    def test_invalid_travel_status(self):
        """Test invalid travel_status value is rejected"""
        data = {'travel_status': 'invalid'}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('travel_status', response.data['errors'])

    def test_invalid_region_id(self):
        """Test invalid region ID is rejected"""
        import uuid
        data = {'now_in_region_id': str(uuid.uuid4())}
        response = self.client.patch('/api/v1/profiles/me/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('now_in_region_id', response.data['errors'])


class ProfileVehicleVisibilityTestCase(TestCase):
    """Test vehicle visibility based on has_van flag"""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    def test_vehicle_null_when_has_van_false(self):
        """Test vehicle is null when has_van is false"""
        response = self.client.get('/api/v1/profiles/me/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['data']['has_van'])
        self.assertIsNone(response.data['data']['vehicle'])

    def test_vehicle_shown_when_has_van_true(self):
        """Test vehicle is shown when has_van is true and vehicle exists"""
        # Set has_van to true
        profile = Profile.objects.get(user=self.user)
        profile.has_van = True
        profile.save()
        
        # Create vehicle
        Vehicle.objects.create(
            profile=profile,
            vehicle_type='van',
            make='Mercedes',
            model='Sprinter',
            year=2020
        )
        
        response = self.client.get('/api/v1/profiles/me/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['data']['has_van'])
        self.assertIsNotNone(response.data['data']['vehicle'])
        self.assertEqual(response.data['data']['vehicle']['type'], 'van')
        self.assertEqual(response.data['data']['vehicle']['make'], 'Mercedes')

    def test_vehicle_null_when_has_van_true_but_no_vehicle(self):
        """Test vehicle is null when has_van is true but no vehicle exists"""
        # Set has_van to true but don't create vehicle
        profile = Profile.objects.get(user=self.user)
        profile.has_van = True
        profile.save()
        
        response = self.client.get('/api/v1/profiles/me/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['data']['has_van'])
        self.assertIsNone(response.data['data']['vehicle'])


class ProfileRetrieveByIdTestCase(TestCase):
    """Test GET /profiles/{id}/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        
        # Create the main user (viewer)
        self.viewer = UserAccount.objects.create_user(
            username='viewer',
            email='viewer@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.viewer)
        
        # Create another user whose profile will be viewed
        self.profile_owner = UserAccount.objects.create_user(
            username='profileowner',
            email='owner@example.com',
            password='testpass123'
        )
        self.target_profile = Profile.objects.get(user=self.profile_owner)
        
        # Set up the target profile with some data
        self.target_profile.display_name = 'Profile Owner'
        self.target_profile.bio = 'I love van life!'
        self.target_profile.avatar_url = 'https://example.com/avatar.jpg'
        self.target_profile.save()

    def test_retrieve_public_profile(self):
        """Test retrieving a profile returns full data"""
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        # Should have full profile data
        profile_data = response.data['data']
        self.assertEqual(profile_data['display_name'], 'Profile Owner')
        self.assertEqual(profile_data['bio'], 'I love van life!')
        self.assertIn('hobbies', profile_data)
        self.assertIn('follower_count', profile_data)
        self.assertNotIn('restricted', profile_data)

    def test_retrieve_own_profile(self):
        """Test retrieving own profile returns full data"""
        viewer_profile = Profile.objects.get(user=self.viewer)
        viewer_profile.display_name = 'My Profile'
        viewer_profile.save()
        
        response = self.client.get(f'/api/v1/profiles/{viewer_profile.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        # Should have full profile data
        profile_data = response.data['data']
        self.assertEqual(profile_data['display_name'], 'My Profile')
        self.assertIn('hobbies', profile_data)
        self.assertNotIn('restricted', profile_data)

    def test_retrieve_nonexistent_profile(self):
        """Test retrieving a non-existent profile returns 404"""
        import uuid
        fake_id = uuid.uuid4()
        
        response = self.client.get(f'/api/v1/profiles/{fake_id}/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'Profile not found')

    def test_retrieve_profile_unauthenticated(self):
        """Test retrieving a profile requires authentication"""
        self.client.logout()
        
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_profile_invalid_id(self):
        """Test retrieving a profile with invalid ID returns 400"""
        response = self.client.get('/api/v1/profiles/invalid-uuid/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_profile_with_vehicle(self):
        """Test retrieving a profile with vehicle data"""
        self.target_profile.has_van = True
        self.target_profile.save()
        
        # Create vehicle for the profile
        Vehicle.objects.create(
            profile=self.target_profile,
            vehicle_type='van',
            make='Mercedes',
            model='Sprinter',
            year=2020,
            build_status='full',
            nickname='Vanessa'
        )
        
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        profile_data = response.data['data']
        self.assertTrue(profile_data['has_van'])
        self.assertIsNotNone(profile_data['vehicle'])
        self.assertEqual(profile_data['vehicle']['type'], 'van')
        self.assertEqual(profile_data['vehicle']['make'], 'Mercedes')

    def test_retrieve_profile_shows_follow_indicators(self):
        """Test retrieving a profile shows correct follow indicators"""
        from core.models import Follow
        
        viewer_profile = Profile.objects.get(user=self.viewer)
        
        # Create mutual follow relationship
        Follow.objects.create(follower=viewer_profile, following=self.target_profile)
        Follow.objects.create(follower=self.target_profile, following=viewer_profile)
        
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        profile_data = response.data['data']
        self.assertTrue(profile_data['is_following'])
        self.assertTrue(profile_data['is_followed_by'])
        self.assertEqual(profile_data['follower_count'], 1)
        self.assertEqual(profile_data['following_count'], 1)


class HobbyTagsAPITestCase(TestCase):
    """Test GET /profiles/hobbies/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create some hobby tags
        self.hobby1 = HobbyTag.objects.create(name='Climbing', slug='climbing')
        self.hobby2 = HobbyTag.objects.create(name='Hiking', slug='hiking')
        self.hobby3 = HobbyTag.objects.create(name='Surfing', slug='surfing')

    def test_get_hobbies_returns_all_tags(self):
        """Test GET /profiles/hobbies/ returns all hobby tags"""
        response = self.client.get('/api/v1/profiles/hobbies/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('data', response.data)
        
        # Verify all hobby tags are returned
        hobbies = response.data['data']
        self.assertEqual(len(hobbies), 3)
        
        # Verify hobby structure
        hobby_names = [h['name'] for h in hobbies]
        self.assertIn('Climbing', hobby_names)
        self.assertIn('Hiking', hobby_names)
        self.assertIn('Surfing', hobby_names)

    def test_get_hobbies_returns_correct_fields(self):
        """Test GET /profiles/hobbies/ returns id, name, and slug for each tag"""
        response = self.client.get('/api/v1/profiles/hobbies/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        hobbies = response.data['data']
        for hobby in hobbies:
            self.assertIn('id', hobby)
            self.assertIn('name', hobby)
            self.assertIn('slug', hobby)

    def test_get_hobbies_ordered_by_name(self):
        """Test GET /profiles/hobbies/ returns tags ordered alphabetically by name"""
        response = self.client.get('/api/v1/profiles/hobbies/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        hobbies = response.data['data']
        hobby_names = [h['name'] for h in hobbies]
        
        # Verify alphabetical order
        self.assertEqual(hobby_names, sorted(hobby_names))

    def test_get_hobbies_empty_list(self):
        """Test GET /profiles/hobbies/ returns empty list when no tags exist"""
        # Delete all hobby tags
        HobbyTag.objects.all().delete()
        
        response = self.client.get('/api/v1/profiles/hobbies/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data'], [])

    def test_get_hobbies_requires_authentication(self):
        """Test GET /profiles/hobbies/ requires authentication"""
        self.client.logout()
        
        response = self.client.get('/api/v1/profiles/hobbies/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class VehicleAPITestCase(TestCase):
    """
    Test /profiles/me/vehicle/ endpoint for vehicle CRUD operations.
    
    Endpoints:
    - GET /profiles/me/vehicle/ - Get current user's vehicle
    - PUT /profiles/me/vehicle/ - Create or update vehicle
    - DELETE /profiles/me/vehicle/ - Remove vehicle
    """

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.profile = Profile.objects.get(user=self.user)
        self.next_stop_journey = Prompt.objects.get(prompt_name='next_stop_journey')
        self.always_down_team_up = Prompt.objects.get(prompt_name='always_down_team_up')
        self.looking_for_travel_buddy = Prompt.objects.get(prompt_name='looking_for_travel_buddy')
        self.best_hidden_gem = Prompt.objects.get(prompt_name='best_hidden_gem')

    def test_get_vehicle_not_found(self):
        """Test GET /profiles/me/vehicle/ returns 404 when no vehicle exists"""
        response = self.client.get('/api/v1/profiles/me/vehicle/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('No vehicle found', response.data['message'])

    def test_get_vehicle_success(self):
        """Test GET /profiles/me/vehicle/ returns vehicle when it exists"""
        # Create a vehicle
        Vehicle.objects.create(
            profile=self.profile,
            vehicle_type='van',
            make='Mercedes',
            model='Sprinter',
            year=2020,
            build_status='full',
            nickname='Vanessa'
        )
        
        response = self.client.get('/api/v1/profiles/me/vehicle/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        vehicle_data = response.data['data']
        self.assertEqual(vehicle_data['type'], 'van')
        self.assertEqual(vehicle_data['make'], 'Mercedes')
        self.assertEqual(vehicle_data['model'], 'Sprinter')
        self.assertEqual(vehicle_data['year'], 2020)
        self.assertEqual(vehicle_data['build_status'], 'full')
        self.assertEqual(vehicle_data['nickname'], 'Vanessa')

    def test_create_vehicle_success(self):
        """Test PUT /profiles/me/vehicle/ creates a new vehicle"""
        data = {
            'vehicle_type': 'van',
            'make': 'Ford',
            'model': 'Transit',
            'year': 2019,
            'build_status': 'partial',
            'nickname': 'Fordy'
        }
        
        response = self.client.put('/api/v1/profiles/me/vehicle/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        
        vehicle_data = response.data['data']
        self.assertEqual(vehicle_data['type'], 'van')
        self.assertEqual(vehicle_data['make'], 'Ford')
        self.assertEqual(vehicle_data['model'], 'Transit')
        self.assertEqual(vehicle_data['year'], 2019)
        
        # Verify has_van is set to True
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.has_van)

    def test_create_vehicle_sets_has_van_true(self):
        """Test PUT /profiles/me/vehicle/ sets has_van=True on profile"""
        # Ensure has_van is False initially
        self.assertFalse(self.profile.has_van)
        
        data = {
            'vehicle_type': 'rv',
            'make': 'Winnebago'
        }
        
        response = self.client.put('/api/v1/profiles/me/vehicle/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify has_van is now True
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.has_van)

    def test_update_vehicle_success(self):
        """Test PUT /profiles/me/vehicle/ updates existing vehicle"""
        # Create initial vehicle
        Vehicle.objects.create(
            profile=self.profile,
            vehicle_type='van',
            make='Mercedes',
            model='Sprinter',
            year=2020
        )
        self.profile.has_van = True
        self.profile.save()
        
        # Update vehicle
        data = {
            'vehicle_type': 'van',
            'make': 'Ford',
            'model': 'Transit',
            'year': 2021,
            'build_status': 'full',
            'nickname': 'New Name'
        }
        
        response = self.client.put('/api/v1/profiles/me/vehicle/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        vehicle_data = response.data['data']
        self.assertEqual(vehicle_data['make'], 'Ford')
        self.assertEqual(vehicle_data['model'], 'Transit')
        self.assertEqual(vehicle_data['year'], 2021)
        self.assertEqual(vehicle_data['nickname'], 'New Name')
        
        # Verify only one vehicle exists
        self.assertEqual(Vehicle.objects.filter(profile=self.profile).count(), 1)

    def test_delete_vehicle_success(self):
        """Test DELETE /profiles/me/vehicle/ removes vehicle"""
        # Create a vehicle
        Vehicle.objects.create(
            profile=self.profile,
            vehicle_type='van',
            make='Mercedes'
        )
        self.profile.has_van = True
        self.profile.save()
        
        response = self.client.delete('/api/v1/profiles/me/vehicle/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('deleted successfully', response.data['message'])
        
        # Verify vehicle is deleted
        self.assertFalse(Vehicle.objects.filter(profile=self.profile).exists())
        
        # Verify has_van is set to False
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.has_van)

    def test_delete_vehicle_sets_has_van_false(self):
        """Test DELETE /profiles/me/vehicle/ sets has_van=False on profile"""
        # Create a vehicle
        Vehicle.objects.create(
            profile=self.profile,
            vehicle_type='van'
        )
        self.profile.has_van = True
        self.profile.save()
        
        response = self.client.delete('/api/v1/profiles/me/vehicle/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify has_van is now False
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.has_van)

    def test_delete_vehicle_not_found(self):
        """Test DELETE /profiles/me/vehicle/ returns 404 when no vehicle exists"""
        response = self.client.delete('/api/v1/profiles/me/vehicle/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('No vehicle found', response.data['message'])

    def test_vehicle_requires_authentication(self):
        """Test vehicle endpoints require authentication"""
        self.client.logout()
        
        # Test GET
        response = self.client.get('/api/v1/profiles/me/vehicle/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Test PUT
        response = self.client.put('/api/v1/profiles/me/vehicle/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Test DELETE
        response = self.client.delete('/api/v1/profiles/me/vehicle/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class VehicleValidationTestCase(TestCase):
    """Test vehicle field validation."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.profile = Profile.objects.get(user=self.user)

    def test_vehicle_type_required(self):
        """Test vehicle_type is required"""
        data = {'make': 'Mercedes', 'model': 'Sprinter'}
        response = self.client.put('/api/v1/profiles/me/vehicle/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('vehicle_type', response.data['errors'])

    def test_vehicle_type_invalid_choice(self):
        """Test invalid vehicle_type is rejected"""
        data = {'vehicle_type': 'invalid_type'}
        response = self.client.put('/api/v1/profiles/me/vehicle/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('vehicle_type', response.data['errors'])

    def test_all_fields_together(self):
        """Test creating vehicle with all fields"""
        data = {
            'vehicle_type': 'skoolie',
            'make': 'Blue Bird',
            'model': 'All American',
            'year': 2005,
            'build_status': 'full',
            'nickname': 'Big Yellow'
        }
        response = self.client.put('/api/v1/profiles/me/vehicle/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        vehicle_data = response.data['data']
        self.assertEqual(vehicle_data['type'], 'skoolie')
        self.assertEqual(vehicle_data['make'], 'Blue Bird')


class VehiclePhotoAPITestCase(TestCase):
    """Test vehicle photo upload and delete endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.profile = Profile.objects.get(user=self.user)
        
        # Create a vehicle for the user
        self.vehicle = Vehicle.objects.create(
            profile=self.profile,
            vehicle_type='van',
            make='Mercedes',
            model='Sprinter',
            year=2020
        )
        self.profile.has_van = True
        self.profile.save()

    def test_upload_photo_success(self):
        """Test POST /profiles/me/vehicle/photos/ uploads a photo successfully"""
        data = {'image_url': 'https://example.com/photo1.jpg'}
        response = self.client.post('/api/v1/profiles/me/vehicle/photos/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['url'], 'https://example.com/photo1.jpg')

    def test_upload_photo_max_10_limit(self):
        """Test POST /profiles/me/vehicle/photos/ enforces max 10 photos limit"""
        from core.models import VehiclePhoto
        
        # Create 10 photos
        for i in range(10):
            VehiclePhoto.objects.create(
                vehicle=self.vehicle,
                image_url=f'https://example.com/photo{i}.jpg',
                display_order=i + 1
            )
        
        # Try to upload 11th photo
        data = {'image_url': 'https://example.com/photo11.jpg'}
        response = self.client.post('/api/v1/profiles/me/vehicle/photos/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_photo_success(self):
        """Test DELETE /profiles/me/vehicle/photos/{id}/ deletes photo successfully"""
        from core.models import VehiclePhoto
        
        photo = VehiclePhoto.objects.create(
            vehicle=self.vehicle,
            image_url='https://example.com/photo1.jpg',
            display_order=1
        )
        
        response = self.client.delete(f'/api/v1/profiles/me/vehicle/photos/{photo.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(VehiclePhoto.objects.filter(id=photo.id).exists())

    def test_photos_included_in_vehicle_response(self):
        """Test photos are included in GET /profiles/me/vehicle/ response"""
        from core.models import VehiclePhoto
        
        VehiclePhoto.objects.create(
            vehicle=self.vehicle,
            image_url='https://example.com/photo1.jpg',
            display_order=1
        )
        
        response = self.client.get('/api/v1/profiles/me/vehicle/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('photos', response.data['data'])
        self.assertEqual(len(response.data['data']['photos']), 1)


class FollowUnfollowAPITestCase(TestCase):
    """
    Test follow/unfollow endpoints.
    
    POST /profiles/{id}/follow/ - Follow a user
    DELETE /profiles/{id}/follow/ - Unfollow a user
    """

    def setUp(self):
        self.client = APIClient()
        
        # Create the follower user
        self.follower_user = UserAccount.objects.create_user(
            username='follower',
            email='follower@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.follower_user)
        self.follower_profile = Profile.objects.get(user=self.follower_user)
        
        # Create the target user to be followed
        self.target_user = UserAccount.objects.create_user(
            username='target',
            email='target@example.com',
            password='testpass123'
        )
        self.target_profile = Profile.objects.get(user=self.target_user)

    def test_follow_user_success(self):
        """Test POST /profiles/{id}/follow/ creates follow relationship"""
        from core.models import Follow
        
        response = self.client.post(f'/api/v1/profiles/{self.target_profile.id}/follow/')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['message'], 'Successfully followed user')
        self.assertTrue(response.data['data']['is_following'])
        self.assertEqual(response.data['data']['follower_count'], 1)
        
        # Verify follow relationship exists in database
        self.assertTrue(
            Follow.objects.filter(
                follower=self.follower_profile,
                following=self.target_profile
            ).exists()
        )

    def test_unfollow_user_success(self):
        """Test DELETE /profiles/{id}/follow/ removes follow relationship"""
        from core.models import Follow
        
        # First create a follow relationship
        Follow.objects.create(
            follower=self.follower_profile,
            following=self.target_profile
        )
        
        response = self.client.delete(f'/api/v1/profiles/{self.target_profile.id}/follow/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['message'], 'Successfully unfollowed user')
        self.assertFalse(response.data['data']['is_following'])
        self.assertEqual(response.data['data']['follower_count'], 0)
        
        # Verify follow relationship no longer exists
        self.assertFalse(
            Follow.objects.filter(
                follower=self.follower_profile,
                following=self.target_profile
            ).exists()
        )

    def test_cannot_follow_self(self):
        """Test users cannot follow themselves"""
        response = self.client.post(f'/api/v1/profiles/{self.follower_profile.id}/follow/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'You cannot follow yourself')

    def test_duplicate_follow_is_idempotent(self):
        """Test duplicate follows are handled gracefully - idempotent"""
        from core.models import Follow
        
        # First follow
        response1 = self.client.post(f'/api/v1/profiles/{self.target_profile.id}/follow/')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Second follow (duplicate)
        response2 = self.client.post(f'/api/v1/profiles/{self.target_profile.id}/follow/')
        
        # Should return 200 OK (not error) and indicate already following
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.data['status'], 'success')
        self.assertEqual(response2.data['message'], 'Already following user')
        self.assertTrue(response2.data['data']['is_following'])
        
        # Verify only one follow relationship exists
        self.assertEqual(
            Follow.objects.filter(
                follower=self.follower_profile,
                following=self.target_profile
            ).count(),
            1
        )

    def test_unfollow_when_not_following(self):
        """Test unfollowing when not following is handled gracefully"""
        response = self.client.delete(f'/api/v1/profiles/{self.target_profile.id}/follow/')
        
        # Should return success (idempotent)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

    def test_follow_nonexistent_profile(self):
        """Test following a non-existent profile returns 404"""
        import uuid
        fake_id = uuid.uuid4()
        
        response = self.client.post(f'/api/v1/profiles/{fake_id}/follow/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_follow_requires_authentication(self):
        """Test follow endpoint requires authentication"""
        self.client.logout()
        
        response = self.client.post(f'/api/v1/profiles/{self.target_profile.id}/follow/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class FollowersListAPITestCase(TestCase):
    """
    Test GET /profiles/{id}/followers/ endpoint.
    """

    def setUp(self):
        self.client = APIClient()
        
        # Create the main user (viewer)
        self.viewer = UserAccount.objects.create_user(
            username='viewer',
            email='viewer@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.viewer)
        self.viewer_profile = Profile.objects.get(user=self.viewer)
        
        # Create a target user whose followers we'll list
        self.target_user = UserAccount.objects.create_user(
            username='target',
            email='target@example.com',
            password='testpass123'
        )
        self.target_profile = Profile.objects.get(user=self.target_user)
        self.target_profile.display_name = 'Target User'
        self.target_profile.save()

    def test_get_followers_returns_follower_profiles(self):
        """Test GET /profiles/{id}/followers/ returns list of follower profiles"""
        from core.models import Follow
        
        # Create some followers
        follower1 = UserAccount.objects.create_user(
            username='follower1',
            email='follower1@example.com',
            password='testpass123'
        )
        follower1_profile = Profile.objects.get(user=follower1)
        follower1_profile.display_name = 'Follower One'
        follower1_profile.save()
        
        # Create follow relationships
        Follow.objects.create(follower=follower1_profile, following=self.target_profile)
        
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/followers/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 1)
        
        # Verify response structure (id, display_name, avatar_url)
        follower = response.data['data'][0]
        self.assertIn('id', follower)
        self.assertIn('display_name', follower)
        self.assertIn('avatar_url', follower)

    def test_get_followers_requires_authentication(self):
        """Test GET /profiles/{id}/followers/ requires authentication"""
        self.client.logout()
        
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/followers/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class FollowingListAPITestCase(TestCase):
    """
    Test GET /profiles/{id}/following/ endpoint.
    """

    def setUp(self):
        self.client = APIClient()
        
        # Create the main user (viewer)
        self.viewer = UserAccount.objects.create_user(
            username='viewer',
            email='viewer@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.viewer)
        self.viewer_profile = Profile.objects.get(user=self.viewer)
        
        # Create a target user whose following list we'll view
        self.target_user = UserAccount.objects.create_user(
            username='target',
            email='target@example.com',
            password='testpass123'
        )
        self.target_profile = Profile.objects.get(user=self.target_user)
        self.target_profile.display_name = 'Target User'
        self.target_profile.save()

    def test_get_following_returns_followed_profiles(self):
        """Test GET /profiles/{id}/following/ returns list of followed profiles"""
        from core.models import Follow
        
        # Create some users for target to follow
        followed1 = UserAccount.objects.create_user(
            username='followed1',
            email='followed1@example.com',
            password='testpass123'
        )
        followed1_profile = Profile.objects.get(user=followed1)
        followed1_profile.display_name = 'Followed One'
        followed1_profile.save()
        
        # Create follow relationships (target follows these users)
        Follow.objects.create(follower=self.target_profile, following=followed1_profile)
        
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/following/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 1)
        
        # Verify response structure
        followed = response.data['data'][0]
        self.assertIn('id', followed)
        self.assertIn('display_name', followed)
        self.assertIn('avatar_url', followed)

    def test_get_following_requires_authentication(self):
        """Test GET /profiles/{id}/following/ requires authentication"""
        self.client.logout()
        
        response = self.client.get(f'/api/v1/profiles/{self.target_profile.id}/following/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ============================================================================
# Feed API Tests (Nearby Users Feed)
# ============================================================================

class NearbyFeedAPITestCase(TestCase):
    """
    Test GET /feed/nearby/ endpoint.
    
    Tests the FeedViewSet which provides:
    - GET /feed/nearby/ - Get nearby users based on current user's "Now In" location
    
    The feed should:
    - Return profiles grouped by timing category (here_now, here_next_week, here_next_month)
    - Exclude the current user from results
    """

    def setUp(self):
        self.client = APIClient()
        
        # Create location data (use get_or_create since data migration may have seeded them)
        self.country, _ = Country.objects.get_or_create(code='US', defaults={'name': 'United States'})
        self.region_ca, _ = Region.objects.get_or_create(country=self.country, name='California')
        self.region_or, _ = Region.objects.get_or_create(country=self.country, name='Oregon')
        self.region_wa, _ = Region.objects.get_or_create(country=self.country, name='Washington')
        
        # Create main user (profile is auto-created via signal)
        self.user = UserAccount.objects.create_user(
            username='mainuser',
            email='main@example.com',
            password='testpass123'
        )
        self.profile = Profile.objects.get(user=self.user)
        self.profile.display_name = 'Main User'
        self.profile.now_in = self.region_ca
        self.profile.save()
        
        # Refresh user from database to ensure profile relationship is up to date
        self.user.refresh_from_db()
        
        self.client.force_authenticate(user=self.user)

    def test_nearby_feed_requires_authentication(self):
        """Test GET /feed/nearby/ requires authentication"""
        self.client.logout()
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nearby_feed_returns_empty_when_no_now_in(self):
        """Test GET /feed/nearby/ returns empty lists when user has no now_in set"""
        # Remove now_in from user's profile
        self.profile.now_in = None
        self.profile.save()
        
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['here_now'], [])
        self.assertEqual(response.data['data']['here_next_week'], [])
        self.assertEqual(response.data['data']['here_next_month'], [])
        self.assertIn('message', response.data)

    def test_nearby_feed_returns_correct_structure(self):
        """Test GET /feed/nearby/ returns correct response structure"""
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('data', response.data)
        self.assertIn('here_now', response.data['data'])
        self.assertIn('here_next_week', response.data['data'])
        self.assertIn('here_next_month', response.data['data'])

    def test_nearby_feed_excludes_current_user(self):
        """Test GET /feed/nearby/ excludes the current user from results"""
        # User's now_in is California, so they should not appear in their own feed
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check all categories don't contain the current user
        all_profiles = (
            response.data['data']['here_now'] +
            response.data['data']['here_next_week'] +
            response.data['data']['here_next_month']
        )
        user_ids = [p['id'] for p in all_profiles]
        self.assertNotIn(str(self.profile.id), user_ids)

    def test_nearby_feed_includes_users_with_matching_now_in(self):
        """Test GET /feed/nearby/ includes users whose now_in matches"""
        # Create another user in California (same as main user's now_in)
        other_user = UserAccount.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        other_profile.display_name = 'Other User'
        other_profile.now_in = self.region_ca  # Same region as main user
        other_profile.save()
        
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should appear in here_now
        here_now_ids = [p['id'] for p in response.data['data']['here_now']]
        self.assertIn(str(other_profile.id), here_now_ids)
        
        # Verify timing_label
        for profile in response.data['data']['here_now']:
            if profile['id'] == str(other_profile.id):
                self.assertEqual(profile['timing_label'], 'Here Now')

    def test_nearby_feed_includes_users_with_matching_next_week_in(self):
        """Test GET /feed/nearby/ includes users whose next_week_in matches"""
        # Create user whose next_week_in is California
        other_user = UserAccount.objects.create_user(
            username='nextweekuser',
            email='nextweek@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        other_profile.display_name = 'Next Week User'
        other_profile.now_in = self.region_or  # Different region
        other_profile.next_week_in = self.region_ca  # Same as main user's now_in
        other_profile.save()
        
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should appear in here_next_week
        here_next_week_ids = [p['id'] for p in response.data['data']['here_next_week']]
        self.assertIn(str(other_profile.id), here_next_week_ids)
        
        # Verify timing_label
        for profile in response.data['data']['here_next_week']:
            if profile['id'] == str(other_profile.id):
                self.assertEqual(profile['timing_label'], 'Here Next Week')

    def test_nearby_feed_includes_users_with_matching_next_month_in(self):
        """Test GET /feed/nearby/ includes users whose next_month_in matches"""
        # Create user whose next_month_in is California
        other_user = UserAccount.objects.create_user(
            username='nextmonthuser',
            email='nextmonth@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        other_profile.display_name = 'Next Month User'
        other_profile.now_in = self.region_or  # Different region
        other_profile.next_month_in = self.region_ca  # Same as main user's now_in
        other_profile.save()
        
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should appear in here_next_month
        here_next_month_ids = [p['id'] for p in response.data['data']['here_next_month']]
        self.assertIn(str(other_profile.id), here_next_month_ids)
        
        # Verify timing_label
        for profile in response.data['data']['here_next_month']:
            if profile['id'] == str(other_profile.id):
                self.assertEqual(profile['timing_label'], 'Here Next Month')

    def test_nearby_feed_excludes_users_in_different_region(self):
        """Test GET /feed/nearby/ excludes users not in the same region"""
        # Create user in Oregon (different from main user's California)
        other_user = UserAccount.objects.create_user(
            username='oregonuser',
            email='oregon@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        other_profile.display_name = 'Oregon User'
        other_profile.now_in = self.region_or  # Different region
        other_profile.save()
        
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should NOT appear in any category
        all_profiles = (
            response.data['data']['here_now'] +
            response.data['data']['here_next_week'] +
            response.data['data']['here_next_month']
        )
        user_ids = [p['id'] for p in all_profiles]
        self.assertNotIn(str(other_profile.id), user_ids)

    def test_nearby_feed_card_has_correct_fields(self):
        """Test feed cards have id, display_name, avatar_url, timing_label"""
        # Create user in California with avatar
        other_user = UserAccount.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        other_profile.display_name = 'Other User'
        other_profile.avatar_url = 'https://example.com/avatar.jpg'
        other_profile.now_in = self.region_ca
        other_profile.save()
        
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data['data']['here_now']) > 0)
        
        # Check feed card structure
        feed_card = response.data['data']['here_now'][0]
        self.assertIn('id', feed_card)
        self.assertIn('display_name', feed_card)
        self.assertIn('avatar_url', feed_card)
        self.assertIn('timing_label', feed_card)
        
        # Verify values
        self.assertEqual(feed_card['display_name'], 'Other User')
        self.assertEqual(feed_card['avatar_url'], 'https://example.com/avatar.jpg')
        self.assertEqual(feed_card['timing_label'], 'Here Now')

    def test_nearby_feed_user_can_appear_in_multiple_categories(self):
        """Test a user can appear in multiple timing categories if they match multiple"""
        # Create user whose now_in AND next_week_in both match main user's now_in
        other_user = UserAccount.objects.create_user(
            username='multiuser',
            email='multi@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        other_profile.display_name = 'Multi User'
        other_profile.now_in = self.region_ca  # Matches main user's now_in
        other_profile.next_week_in = self.region_ca  # Also matches
        other_profile.save()
        
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should appear in both here_now and here_next_week
        here_now_ids = [p['id'] for p in response.data['data']['here_now']]
        here_next_week_ids = [p['id'] for p in response.data['data']['here_next_week']]
        
        self.assertIn(str(other_profile.id), here_now_ids)
        self.assertIn(str(other_profile.id), here_next_week_ids)

    def test_nearby_feed_empty_when_no_matching_users(self):
        """Test GET /feed/nearby/ returns empty lists when no users match"""
        # Main user is in California, no other users exist
        response = self.client.get('/api/v1/feed/nearby/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['here_now'], [])
        self.assertEqual(response.data['data']['here_next_week'], [])
        self.assertEqual(response.data['data']['here_next_month'], [])


# ============================================================================
# InTownWindow CRUD API Tests
# ============================================================================

class InTownWindowCRUDAPITestCase(TestCase):
    """
    Tests for InTownWindow CRUD endpoints.
    
    Tests the following endpoints:
    - GET /profiles/me/in-town-windows/ - List user's in-town windows
    - POST /profiles/me/in-town-windows/ - Create a new in-town window
    - DELETE /profiles/me/in-town-windows/{id}/ - Delete an in-town window
    """

    def setUp(self):
        self.client = APIClient()
        # Create user (profile is auto-created via signal)
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = Profile.objects.get(user=self.user)
        self.client.force_authenticate(user=self.user)

    # ========================================================================
    # GET /profiles/me/in-town-windows/ Tests
    # ========================================================================

    def test_list_in_town_windows_empty(self):
        """Test GET /profiles/me/in-town-windows/ returns empty list when no windows exist"""
        response = self.client.get('/api/v1/profiles/me/in-town-windows/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data'], [])

    def test_list_in_town_windows_with_data(self):
        """Test GET /profiles/me/in-town-windows/ returns user's windows"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        # Create some in-town windows
        window1 = InTownWindow.objects.create(
            profile=self.profile,
            city_area='San Francisco, CA',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7)
        )
        window2 = InTownWindow.objects.create(
            profile=self.profile,
            city_area='Los Angeles, CA',
            start_date=date.today() + timedelta(days=14),
            end_date=date.today() + timedelta(days=21)
        )
        
        response = self.client.get('/api/v1/profiles/me/in-town-windows/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 2)
        
        # Verify window data
        window_ids = [w['id'] for w in response.data['data']]
        self.assertIn(str(window1.id), window_ids)
        self.assertIn(str(window2.id), window_ids)

    def test_list_in_town_windows_ordered_by_start_date(self):
        """Test GET /profiles/me/in-town-windows/ returns windows ordered by start_date"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        # Create windows in reverse order
        window_later = InTownWindow.objects.create(
            profile=self.profile,
            city_area='Later City',
            start_date=date.today() + timedelta(days=30),
            end_date=date.today() + timedelta(days=37)
        )
        window_earlier = InTownWindow.objects.create(
            profile=self.profile,
            city_area='Earlier City',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7)
        )
        
        response = self.client.get('/api/v1/profiles/me/in-town-windows/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Earlier window should come first
        self.assertEqual(response.data['data'][0]['city_area'], 'Earlier City')
        self.assertEqual(response.data['data'][1]['city_area'], 'Later City')

    def test_list_in_town_windows_requires_authentication(self):
        """Test GET /profiles/me/in-town-windows/ requires authentication"""
        self.client.logout()
        response = self.client.get('/api/v1/profiles/me/in-town-windows/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_in_town_windows_only_returns_own_windows(self):
        """Test GET /profiles/me/in-town-windows/ only returns current user's windows"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        # Create another user with windows
        other_user = UserAccount.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        
        # Create window for other user
        InTownWindow.objects.create(
            profile=other_profile,
            city_area='Other City',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7)
        )
        
        # Create window for current user
        my_window = InTownWindow.objects.create(
            profile=self.profile,
            city_area='My City',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7)
        )
        
        response = self.client.get('/api/v1/profiles/me/in-town-windows/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['city_area'], 'My City')

    # ========================================================================
    # POST /profiles/me/in-town-windows/ Tests
    # ========================================================================

    def test_create_in_town_window_success(self):
        """Test POST /profiles/me/in-town-windows/ creates a new window"""
        from datetime import date, timedelta
        
        data = {
            'city_area': 'Portland, OR',
            'start_date': str(date.today()),
            'end_date': str(date.today() + timedelta(days=7))
        }
        
        response = self.client.post('/api/v1/profiles/me/in-town-windows/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['city_area'], 'Portland, OR')
        self.assertIn('id', response.data['data'])

    def test_create_in_town_window_requires_authentication(self):
        """Test POST /profiles/me/in-town-windows/ requires authentication"""
        from datetime import date, timedelta
        
        self.client.logout()
        data = {
            'city_area': 'Portland, OR',
            'start_date': str(date.today()),
            'end_date': str(date.today() + timedelta(days=7))
        }
        
        response = self.client.post('/api/v1/profiles/me/in-town-windows/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_in_town_window_validates_date_range(self):
        """Test POST /profiles/me/in-town-windows/ validates start_date <= end_date"""
        from datetime import date, timedelta
        
        data = {
            'city_area': 'Portland, OR',
            'start_date': str(date.today() + timedelta(days=7)),  # Start after end
            'end_date': str(date.today())
        }
        
        response = self.client.post('/api/v1/profiles/me/in-town-windows/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('errors', response.data)

    def test_create_in_town_window_validates_city_area_length(self):
        """Test POST /profiles/me/in-town-windows/ validates city_area max 100 chars"""
        from datetime import date, timedelta
        
        data = {
            'city_area': 'A' * 101,  # Exceeds 100 char limit
            'start_date': str(date.today()),
            'end_date': str(date.today() + timedelta(days=7))
        }
        
        response = self.client.post('/api/v1/profiles/me/in-town-windows/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_create_in_town_window_max_three_windows(self):
        """Test POST /profiles/me/in-town-windows/ enforces max 3 windows per profile"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        # Create 3 existing windows
        for i in range(3):
            InTownWindow.objects.create(
                profile=self.profile,
                city_area=f'City {i}',
                start_date=date.today() + timedelta(days=i*10),
                end_date=date.today() + timedelta(days=i*10 + 7)
            )
        
        # Try to create a 4th window
        data = {
            'city_area': 'Fourth City',
            'start_date': str(date.today() + timedelta(days=100)),
            'end_date': str(date.today() + timedelta(days=107))
        }
        
        response = self.client.post('/api/v1/profiles/me/in-town-windows/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_create_in_town_window_same_start_and_end_date(self):
        """Test POST /profiles/me/in-town-windows/ allows same start and end date"""
        from datetime import date
        
        data = {
            'city_area': 'One Day City',
            'start_date': str(date.today()),
            'end_date': str(date.today())  # Same as start
        }
        
        response = self.client.post('/api/v1/profiles/me/in-town-windows/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')

    # ========================================================================
    # DELETE /profiles/me/in-town-windows/{id}/ Tests
    # ========================================================================

    def test_delete_in_town_window_success(self):
        """Test DELETE /profiles/me/in-town-windows/{id}/ deletes the window"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        window = InTownWindow.objects.create(
            profile=self.profile,
            city_area='Delete Me City',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7)
        )
        
        response = self.client.delete(f'/api/v1/profiles/me/in-town-windows/{window.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify window is deleted
        self.assertFalse(InTownWindow.objects.filter(id=window.id).exists())

    def test_delete_in_town_window_requires_authentication(self):
        """Test DELETE /profiles/me/in-town-windows/{id}/ requires authentication"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        window = InTownWindow.objects.create(
            profile=self.profile,
            city_area='Delete Me City',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7)
        )
        
        self.client.logout()
        response = self.client.delete(f'/api/v1/profiles/me/in-town-windows/{window.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_in_town_window_not_found(self):
        """Test DELETE /profiles/me/in-town-windows/{id}/ returns 404 for non-existent window"""
        import uuid
        
        fake_id = uuid.uuid4()
        response = self.client.delete(f'/api/v1/profiles/me/in-town-windows/{fake_id}/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')

    def test_delete_in_town_window_invalid_id(self):
        """Test DELETE /profiles/me/in-town-windows/{id}/ returns 400 for invalid ID"""
        response = self.client.delete('/api/v1/profiles/me/in-town-windows/invalid-id/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_delete_in_town_window_cannot_delete_others_window(self):
        """Test DELETE /profiles/me/in-town-windows/{id}/ cannot delete another user's window"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        # Create another user with a window
        other_user = UserAccount.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        
        other_window = InTownWindow.objects.create(
            profile=other_profile,
            city_area='Other City',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7)
        )
        
        # Try to delete other user's window
        response = self.client.delete(f'/api/v1/profiles/me/in-town-windows/{other_window.id}/')
        
        # Should return 404 (not found for this user)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Verify window still exists
        self.assertTrue(InTownWindow.objects.filter(id=other_window.id).exists())

    def test_delete_allows_creating_new_window_after_deletion(self):
        """Test that deleting a window allows creating a new one when at max capacity"""
        from core.models import InTownWindow
        from datetime import date, timedelta
        
        # Create 3 windows (max)
        windows = []
        for i in range(3):
            window = InTownWindow.objects.create(
                profile=self.profile,
                city_area=f'City {i}',
                start_date=date.today() + timedelta(days=i*10),
                end_date=date.today() + timedelta(days=i*10 + 7)
            )
            windows.append(window)
        
        # Delete one window
        response = self.client.delete(f'/api/v1/profiles/me/in-town-windows/{windows[0].id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Now should be able to create a new window
        data = {
            'city_area': 'New City',
            'start_date': str(date.today() + timedelta(days=100)),
            'end_date': str(date.today() + timedelta(days=107))
        }
        
        response = self.client.post('/api/v1/profiles/me/in-town-windows/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')


# ============================================================================
# ProfilePrompt API Tests
# ============================================================================

class ProfilePromptAPITestCase(TestCase):
    """
    Test ProfilePrompt CRUD endpoints.
    
    Tests the following endpoints:
    - GET /profiles/me/prompts/ - List user's prompts
    - POST /profiles/me/prompts/ - Create a new prompt
    - DELETE /profiles/me/prompts/{id}/ - Delete a prompt
    - GET /profiles/prompts/available/ - List available prompt questions
    """

    def setUp(self):
        self.client = APIClient()
        self.user = UserAccount.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.profile = Profile.objects.get(user=self.user)
        # Fetch prompts seeded by migrations
        self.next_stop_journey = Prompt.objects.get(prompt_name='next_stop_journey')
        self.always_down_team_up = Prompt.objects.get(prompt_name='always_down_team_up')
        self.looking_for_travel_buddy = Prompt.objects.get(prompt_name='looking_for_travel_buddy')

    # ========================================================================
    # GET /profiles/me/prompts/ Tests
    # ========================================================================

    def test_list_prompts_empty(self):
        """Test GET /profiles/me/prompts/ returns empty list when no prompts exist"""
        response = self.client.get('/api/v1/profiles/me/prompts/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data'], [])

    def test_list_prompts_with_data(self):
        """Test GET /profiles/me/prompts/ returns user's prompts"""
        from core.models import ProfilePrompt
        
        # Create some prompts
        prompt1 = ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.next_stop_journey,
            prompt_answer='Waking up to a mountain view',
            display_order=1
        )
        prompt2 = ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.always_down_team_up,
            prompt_answer='My coffee maker',
            display_order=2
        )
        
        response = self.client.get('/api/v1/profiles/me/prompts/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 2)
        
        # Verify prompt data
        prompt_ids = [p['id'] for p in response.data['data']]
        self.assertIn(str(prompt1.id), prompt_ids)
        self.assertIn(str(prompt2.id), prompt_ids)

    def test_list_prompts_ordered_by_display_order(self):
        """Test GET /profiles/me/prompts/ returns prompts ordered by display_order"""
        from core.models import ProfilePrompt
        
        # Create prompts with specific display orders
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.next_stop_journey,
            prompt_answer='Later prompt',
            display_order=2
        )
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.always_down_team_up,
            prompt_answer='First prompt',
            display_order=1
        )
        
        response = self.client.get('/api/v1/profiles/me/prompts/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data'][0]['prompt_answer'], 'First prompt')
        self.assertEqual(response.data['data'][1]['prompt_answer'], 'Later prompt')

    def test_list_prompts_requires_authentication(self):
        """Test GET /profiles/me/prompts/ requires authentication"""
        self.client.logout()
        response = self.client.get('/api/v1/profiles/me/prompts/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_prompts_only_returns_own_prompts(self):
        """Test GET /profiles/me/prompts/ only returns current user's prompts"""
        from core.models import ProfilePrompt
        
        # Create another user with prompts
        other_user = UserAccount.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        
        ProfilePrompt.objects.create(
            profile=other_profile,
            prompt=self.next_stop_journey,
            prompt_answer='Other user prompt',
            display_order=1
        )
        
        # Create a prompt for the current user
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.always_down_team_up,
            prompt_answer='My prompt',
            display_order=1
        )
        
        response = self.client.get('/api/v1/profiles/me/prompts/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['prompt_answer'], 'My prompt')

    # ========================================================================
    # POST /profiles/me/prompts/ Tests
    # ========================================================================

    def test_create_prompt_success(self):
        """Test POST /profiles/me/prompts/ creates a new prompt"""
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': 'Waking up to a beautiful sunrise'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['prompt_name'], 'next_stop_journey')
        self.assertEqual(response.data['data']['prompt_answer'], 'Waking up to a beautiful sunrise')

    def test_create_prompt_with_display_order(self):
        """Test POST /profiles/me/prompts/ respects display_order"""
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': 'Test answer',
            'display_order': 5
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['display_order'], 5)

    def test_create_prompt_auto_display_order(self):
        """Test POST /profiles/me/prompts/ auto-assigns display_order if not provided"""
        from core.models import ProfilePrompt
        
        # Create first prompt
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.next_stop_journey,
            prompt_answer='First',
            display_order=1
        )
        
        # Create second prompt without display_order
        data = {
            'prompt_name': 'always_down_team_up',
            'prompt_answer': 'Second'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Should be assigned display_order 2 (max + 1)
        self.assertEqual(response.data['data']['display_order'], 2)

    def test_create_prompt_requires_authentication(self):
        """Test POST /profiles/me/prompts/ requires authentication"""
        self.client.logout()
        
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': 'Test answer'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_prompt_invalid_question(self):
        """Test POST /profiles/me/prompts/ rejects invalid prompt_question"""
        data = {
            'prompt_name': 'invalid_question',
            'prompt_answer': 'Test answer'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('prompt_name', response.data['errors'])

    def test_create_prompt_answer_too_long(self):
        """Test POST /profiles/me/prompts/ rejects answer over 200 characters"""
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': 'A' * 201  # 201 characters
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('prompt_answer', response.data['errors'])

    def test_create_prompt_answer_exactly_200_chars(self):
        """Test POST /profiles/me/prompts/ accepts answer of exactly 200 characters"""
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': 'A' * 200  # Exactly 200 characters
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['data']['prompt_answer']), 200)

    def test_create_prompt_empty_answer(self):
        """Test POST /profiles/me/prompts/ rejects empty answer"""
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': ''
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('prompt_answer', response.data['errors'])

    def test_create_prompt_whitespace_only_answer(self):
        """Test POST /profiles/me/prompts/ rejects whitespace-only answer"""
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': '   '
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('prompt_answer', response.data['errors'])

    def test_create_prompt_max_three_prompts(self):
        """Test POST /profiles/me/prompts/ rejects 4th prompt (max 3 allowed)"""
        from core.models import ProfilePrompt
        
        # Create 3 prompts (max)
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.next_stop_journey,
            prompt_answer='First',
            display_order=1
        )
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.always_down_team_up,
            prompt_answer='Second',
            display_order=2
        )
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.looking_for_travel_buddy,
            prompt_answer='Third',
            display_order=3
        )
        
        # Try to create 4th prompt
        data = {
            'prompt_name': 'best_hidden_gem',
            'prompt_answer': 'Fourth'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_create_prompt_duplicate_question_rejected(self):
        """Test POST /profiles/me/prompts/ rejects duplicate prompt_question"""
        from core.models import ProfilePrompt
        
        # Create a prompt
        ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.next_stop_journey,
            prompt_answer='First answer',
            display_order=1
        )
        
        # Try to create another prompt with the same question
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': 'Different answer'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('prompt_name', response.data['errors'])

    def test_create_prompt_includes_question_display(self):
        """Test POST /profiles/me/prompts/ response includes prompt_question_display"""
        data = {
            'prompt_name': 'next_stop_journey',
            'prompt_answer': 'Test answer'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('prompt_question', response.data['data'])
        self.assertEqual(
            response.data['data']['prompt_question'],
            'Next stop on my journey is...'
        )

    # ========================================================================
    # DELETE /profiles/me/prompts/{id}/ Tests
    # ========================================================================

    def test_delete_prompt_success(self):
        """Test DELETE /profiles/me/prompts/{id}/ deletes the prompt"""
        from core.models import ProfilePrompt
        
        prompt = ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.next_stop_journey,
            prompt_answer='Delete me',
            display_order=1
        )
        
        response = self.client.delete(f'/api/v1/profiles/me/prompts/{prompt.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify prompt is deleted
        self.assertFalse(ProfilePrompt.objects.filter(id=prompt.id).exists())

    def test_delete_prompt_requires_authentication(self):
        """Test DELETE /profiles/me/prompts/{id}/ requires authentication"""
        from core.models import ProfilePrompt
        
        prompt = ProfilePrompt.objects.create(
            profile=self.profile,
            prompt=self.next_stop_journey,
            prompt_answer='Delete me',
            display_order=1
        )
        
        self.client.logout()
        response = self.client.delete(f'/api/v1/profiles/me/prompts/{prompt.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_prompt_not_found(self):
        """Test DELETE /profiles/me/prompts/{id}/ returns 404 for non-existent prompt"""
        import uuid
        
        fake_id = uuid.uuid4()
        response = self.client.delete(f'/api/v1/profiles/me/prompts/{fake_id}/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')

    def test_delete_prompt_invalid_id(self):
        """Test DELETE /profiles/me/prompts/{id}/ returns 400 for invalid ID"""
        response = self.client.delete('/api/v1/profiles/me/prompts/invalid-id/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_delete_prompt_cannot_delete_others_prompt(self):
        """Test DELETE /profiles/me/prompts/{id}/ cannot delete another user's prompt"""
        from core.models import ProfilePrompt
        
        # Create another user with a prompt
        other_user = UserAccount.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_profile = Profile.objects.get(user=other_user)
        
        other_prompt = ProfilePrompt.objects.create(
            profile=other_profile,
            prompt=self.next_stop_journey,
            prompt_answer='Other user prompt',
            display_order=1
        )
        
        # Try to delete other user's prompt
        response = self.client.delete(f'/api/v1/profiles/me/prompts/{other_prompt.id}/')
        
        # Should return 404 (not found for this user)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Verify prompt still exists
        self.assertTrue(ProfilePrompt.objects.filter(id=other_prompt.id).exists())

    def test_delete_allows_creating_new_prompt_after_deletion(self):
        """Test that deleting a prompt allows creating a new one when at max capacity"""
        from core.models import ProfilePrompt
        
        # Create 3 prompts (max)
        prompts = []
        questions = [self.next_stop_journey, self.always_down_team_up, self.looking_for_travel_buddy]
        for i, question in enumerate(questions):
            prompt = ProfilePrompt.objects.create(
                profile=self.profile,
                prompt=question,
                prompt_answer=f'Answer {i}',
                display_order=i + 1
            )
            prompts.append(prompt)
        
        # Delete one prompt
        response = self.client.delete(f'/api/v1/profiles/me/prompts/{prompts[0].id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Now should be able to create a new prompt
        data = {
            'prompt_name': 'best_hidden_gem',
            'prompt_answer': 'New prompt'
        }
        
        response = self.client.post('/api/v1/profiles/me/prompts/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')

    # ========================================================================
    # GET /profiles/prompts/available/ Tests
    # ========================================================================

    def test_list_available_prompts(self):
        """Test GET /profiles/prompts/available/ returns all available prompts"""
        response = self.client.get('/api/v1/profiles/prompts/available/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify we get the expected prompts
        prompts = response.data['data']
        self.assertGreater(len(prompts), 0)
        
        # Verify structure
        for prompt in prompts:
            self.assertIn('prompt_name', prompt)
            self.assertIn('prompt_question', prompt)
            self.assertIn('prompt_placeholder', prompt)
            self.assertIn('prompt_type', prompt)

    def test_list_available_prompts_contains_expected_prompts(self):
        """Test GET /profiles/prompts/available/ contains expected prompt keys"""
        response = self.client.get('/api/v1/profiles/prompts/available/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        prompt_keys = [p['prompt_name'] for p in response.data['data']]
        
        # Verify expected prompts are present
        expected_keys = [
            'next_stop_journey',
            'always_down_team_up',
            'looking_for_travel_buddy',
            'best_hidden_gem',
            'perfect_vanlife_meetup',
            'best_part_meeting_vanlifers'
        ]
        
        for key in expected_keys:
            self.assertIn(key, prompt_keys)

    def test_list_available_prompts_requires_authentication(self):
        """Test GET /profiles/prompts/available/ requires authentication"""
        self.client.logout()
        response = self.client.get('/api/v1/profiles/prompts/available/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_available_prompts_has_correct_text(self):
        """Test GET /profiles/prompts/available/ returns correct prompt text"""
        response = self.client.get('/api/v1/profiles/prompts/available/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Find the next_stop_journey prompt and verify its text
        prompts = {p['prompt_name']: p['prompt_question'] for p in response.data['data']}
        
        self.assertEqual(
            prompts.get('next_stop_journey'),
            'Next stop on my journey is...'
        )
        self.assertEqual(
            prompts.get('always_down_team_up'),
            'Always down to team up for ____ when I’m on the road.'
        )
