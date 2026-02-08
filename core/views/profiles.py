"""
Profile-related ViewSets for user profiles, vehicles, locations, feed, and discovery.

This module contains ViewSets for:
- AnalyticsViewSet: Analytics event ingestion
- ProfileViewSet: Profile CRUD operations
- VehicleViewSet: Vehicle CRUD operations
- LocationViewSet: Location data (countries and regions)
- FeedViewSet: Nearby users feed
- DiscoveryViewSet: Discovery and swiping functionality

Requirements: 2.1 (Backend File Organization)
"""

from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.utils import timezone

from core.models import (
    Profile, Country, Follow, HobbyTag, Vehicle, VehiclePhoto,
    InTownWindow, City, Prompt, ProfilePrompt, PersonSwipe, PersonMatch, DirectMessage,
    AnalyticsEvent, FriendRequest, Friendship
)
from core.serializers import (
    ProfileSerializer,
    ProfileUpdateSerializer,
    ProfileSummarySerializer,
    HobbyTagSerializer,
    VehicleSerializer,
    VehicleUpdateSerializer,
    VehiclePhotoSerializer,
    VehiclePhotoCreateSerializer,
    CountrySerializer,
    FeedCardSerializer,
    InTownWindowSerializer,
    CitySerializer,
    ProfilePromptSerializer,
    PromptListSerializer,
    DirectMessageCreateSerializer,
    DirectMessageSerializer,
    PersonMatchSerializer,
    PersonSwipeSerializer,
    AnalyticsEventCreateSerializer,
    AnalyticsEventSerializer,
)
from core.services.feed_filters import FeedFilterService
from core.services.relevance import RelevanceScorer


# ============================================================================
# Analytics ViewSet
# ============================================================================

class AnalyticsViewSet(viewsets.GenericViewSet):
    """
    ViewSet for lightweight analytics event ingestion.

    Provides endpoint:
    - POST /api/v1/analytics/events/ - Track an analytics event
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='events')
    def events(self, request):
        """
        Track an analytics event for the authenticated user.

        Request body:
        {
            "event_name": "welcome_viewed",
            "metadata": { ... optional JSON object ... }
        }
        """
        serializer = AnalyticsEventCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid analytics event payload',
                'errors': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            profile = None

        analytics_event = AnalyticsEvent.objects.create(
            user=request.user,
            profile=profile,
            event_name=serializer.validated_data['event_name'],
            metadata=serializer.validated_data.get('metadata', {}),
        )

        return Response({
            'status': 'success',
            'data': AnalyticsEventSerializer(analytics_event).data,
        }, status=status.HTTP_201_CREATED)


# ============================================================================
# Profile ViewSet
# ============================================================================

class ProfileViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    ViewSet for profile operations.
    
    Provides endpoints for:
    - GET /profiles/me/ - Get current user's profile
    - PATCH /profiles/me/ - Update current user's profile
    - GET /profiles/{id}/ - Get profile by ID
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'me' and self.request.method == 'PATCH':
            return ProfileUpdateSerializer
        return ProfileSerializer
    
    def get_queryset(self):
        """Return profiles queryset"""
        return Profile.objects.select_related(
            'user',
        ).prefetch_related(
            'hobbies',
            'follower_set',
            'following_set',
            'in_town_windows',
        )
    
    @action(detail=False, methods=['get', 'patch'], url_path='me')
    def me(self, request):
        """
        Get or update current user's profile.
        
        GET /api/v1/profiles/me/
        Returns the current authenticated user's full profile.
        
        PATCH /api/v1/profiles/me/
        Updates the current authenticated user's profile.
        Automatically updates location timestamps when location fields change.
        """
        try:
            profile = self.get_queryset().get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            # Return full profile data
            serializer = ProfileSerializer(profile, context={'request': request})
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'PATCH':
            # Update profile
            serializer = ProfileUpdateSerializer(
                profile,
                data=request.data,
                partial=True,
                context={'request': request}
            )
            
            if serializer.is_valid():
                updated_profile = serializer.save()
                
                # Return updated profile using ProfileSerializer for full response
                response_serializer = ProfileSerializer(
                    updated_profile,
                    context={'request': request}
                )
                
                return Response({
                    'status': 'success',
                    'data': response_serializer.data
                }, status=status.HTTP_200_OK)
            
            return Response({
                'status': 'error',
                'message': 'Profile update failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    
    def retrieve(self, request, pk=None):
        """
        Get profile by ID.
        
        GET /api/v1/profiles/{id}/
        """
        try:
            profile = self.get_queryset().get(pk=pk)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid profile ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ProfileSerializer(profile, context={'request': request})
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='chat')
    def chat(self, request, pk=None):
        """
        Start a direct chat with a profile by sending an initial message.

        POST /api/v1/profiles/{id}/chat/

        Body:
        - content: required message content
        - message_type: optional (text, mini_card, icebreaker)
        - mini_card_data: optional for mini_card messages

        Creates a match if one does not already exist, then sends the message.
        """
        # Get the target profile
        try:
            target_profile = Profile.objects.get(pk=pk)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid profile ID'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get the sender profile
        try:
            sender_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Your profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)

        if sender_profile.id == target_profile.id:
            return Response({
                'status': 'error',
                'message': 'You cannot message yourself'
            }, status=status.HTTP_400_BAD_REQUEST)

        message_serializer = None
        if request.data.get('content'):
            message_serializer = DirectMessageCreateSerializer(data=request.data)
            if not message_serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid message data',
                    'errors': message_serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

        user1 = sender_profile
        user2 = target_profile
        if str(user1.id) > str(user2.id):
            user1, user2 = user2, user1

        created_match = False
        match = PersonMatch.objects.filter(
            user1=user1,
            user2=user2,
            mode='friends'
        ).first()

        if match:
            if not match.is_active:
                match.is_active = True
                match.save(update_fields=['is_active'])
        else:
            try:
                with transaction.atomic():
                    match = PersonMatch.objects.create(
                        user1=user1,
                        user2=user2,
                        mode='friends',
                        is_active=True
                    )
                    created_match = True
            except IntegrityError:
                match = PersonMatch.objects.get(
                    user1=user1,
                    user2=user2,
                    mode='friends'
                )

        message = None
        if message_serializer:
            message = DirectMessage.objects.create(
                match=match,
                sender=sender_profile,
                content=message_serializer.validated_data['content'],
                message_type=message_serializer.validated_data.get('message_type', 'text'),
                mini_card_data=message_serializer.validated_data.get('mini_card_data'),
            )

        return Response({
            'status': 'success',
            'data': {
                'match': PersonMatchSerializer(match, context={'request': request}).data,
                'message': DirectMessageSerializer(message).data if message else None,
                'match_created': created_match
            }
        }, status=status.HTTP_201_CREATED)


    @action(detail=False, methods=['get'], url_path='hobbies')
    def hobbies(self, request):
        """
        List all available hobby tags.
        
        GET /api/v1/profiles/hobbies/
        
        Returns all HobbyTag records for users to select from when
        setting up their profile hobbies.
        """
        hobby_tags = HobbyTag.objects.all().order_by('name')
        serializer = HobbyTagSerializer(hobby_tags, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'delete'], url_path='follow')
    def follow(self, request, pk=None):
        """
        Follow or unfollow a user.
        
        POST /api/v1/profiles/{id}/follow/
        Creates a follow relationship where the current user follows the target profile.
        
        DELETE /api/v1/profiles/{id}/follow/
        Removes the follow relationship.
        """
        # Get the target profile
        try:
            target_profile = Profile.objects.get(pk=pk)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid profile ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the current user's profile
        try:
            follower_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Your profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent self-follows
        if follower_profile.id == target_profile.id:
            return Response({
                'status': 'error',
                'message': 'You cannot follow yourself'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if request.method == 'POST':
            # Follow user - handle duplicate follows gracefully (idempotent)
            follow_obj, created = Follow.objects.get_or_create(
                follower=follower_profile,
                following=target_profile
            )
            
            # Get updated counts
            follower_count = target_profile.follower_set.count()
            following_count = target_profile.following_set.count()
            
            return Response({
                'status': 'success',
                'message': 'Successfully followed user' if created else 'Already following user',
                'data': {
                    'is_following': True,
                    'follower_count': follower_count,
                    'following_count': following_count
                }
            }, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)
        
        elif request.method == 'DELETE':
            # Unfollow user
            try:
                follow_obj = Follow.objects.get(
                    follower=follower_profile,
                    following=target_profile
                )
                follow_obj.delete()
                
                # Get updated counts
                follower_count = target_profile.follower_set.count()
                following_count = target_profile.following_set.count()
                
                return Response({
                    'status': 'success',
                    'message': 'Successfully unfollowed user',
                    'data': {
                        'is_following': False,
                        'follower_count': follower_count,
                        'following_count': following_count
                    }
                }, status=status.HTTP_200_OK)
            except Follow.DoesNotExist:
                # Not following - return success anyway (idempotent)
                follower_count = target_profile.follower_set.count()
                following_count = target_profile.following_set.count()
                
                return Response({
                    'status': 'success',
                    'message': 'Not following this user',
                    'data': {
                        'is_following': False,
                        'follower_count': follower_count,
                        'following_count': following_count
                    }
                }, status=status.HTTP_200_OK)


    @action(detail=True, methods=['get'], url_path='followers')
    def followers(self, request, pk=None):
        """
        List followers of a profile.
        
        GET /api/v1/profiles/{id}/followers/
        
        Returns a list of profile summaries for all users who follow the specified profile.
        """
        # Get the target profile
        try:
            target_profile = Profile.objects.get(pk=pk)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid profile ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all followers
        follower_profiles = Profile.objects.filter(
            following_set__following=target_profile
        ).order_by('display_name')
        
        serializer = ProfileSummarySerializer(follower_profiles, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='following')
    def following(self, request, pk=None):
        """
        List profiles that a user is following.
        
        GET /api/v1/profiles/{id}/following/
        
        Returns a list of profile summaries for all profiles that the specified user follows.
        """
        # Get the target profile
        try:
            target_profile = Profile.objects.get(pk=pk)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid profile ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all profiles this user is following
        following_profiles = Profile.objects.filter(
            follower_set__follower=target_profile
        ).order_by('display_name')
        
        serializer = ProfileSummarySerializer(following_profiles, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get', 'post'], url_path='me/in-town-windows')
    def in_town_windows(self, request):
        """
        List or create in-town windows for the current user.
        
        GET /api/v1/profiles/me/in-town-windows/
        Returns all in-town windows for the current user's profile.
        
        POST /api/v1/profiles/me/in-town-windows/
        Creates a new in-town window for the current user's profile.
        Maximum of 3 windows per profile.
        """
        # Get the current user's profile
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            # List all in-town windows for the user's profile
            windows = InTownWindow.objects.filter(profile=profile).order_by('start_date')
            serializer = InTownWindowSerializer(windows, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Create a new in-town window
            serializer = InTownWindowSerializer(
                data=request.data,
                context={'profile': profile, 'request': request}
            )
            
            if serializer.is_valid():
                window = serializer.save()
                
                return Response({
                    'status': 'success',
                    'data': InTownWindowSerializer(window).data
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'status': 'error',
                'message': 'Failed to create in-town window',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['delete'], url_path='me/in-town-windows/(?P<window_id>[^/.]+)')
    def delete_in_town_window(self, request, window_id=None):
        """
        Delete an in-town window by ID.
        
        DELETE /api/v1/profiles/me/in-town-windows/{id}/
        Deletes the specified in-town window if it belongs to the current user.
        """
        # Get the current user's profile
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the in-town window
        try:
            window = InTownWindow.objects.get(id=window_id, profile=profile)
        except InTownWindow.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'In-town window not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid in-town window ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete the window
        window.delete()
        
        return Response({
            'status': 'success',
            'message': 'In-town window deleted successfully'
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get', 'post'], url_path='me/prompts')
    def prompts(self, request):
        """
        List or create profile prompts for the current user.
        
        GET /api/v1/profiles/me/prompts/
        Returns all prompts for the current user's profile.
        
        POST /api/v1/profiles/me/prompts/
        Creates a new prompt for the current user's profile.
        Maximum of 3 prompts per profile.
        """
        # Get the current user's profile
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            # List all prompts for the user's profile
            prompts = ProfilePrompt.objects.filter(profile=profile).order_by('display_order')
            serializer = ProfilePromptSerializer(prompts, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Create a new prompt
            serializer = ProfilePromptSerializer(
                data=request.data,
                context={'profile': profile, 'request': request}
            )
            
            if serializer.is_valid():
                prompt = serializer.save()
                
                return Response({
                    'status': 'success',
                    'data': ProfilePromptSerializer(prompt).data
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'status': 'error',
                'message': 'Failed to create prompt',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['delete'], url_path='me/prompts/(?P<prompt_id>[^/.]+)')
    def delete_prompt(self, request, prompt_id=None):
        """
        Delete a profile prompt by ID.
        
        DELETE /api/v1/profiles/me/prompts/{id}/
        Deletes the specified prompt if it belongs to the current user.
        """
        # Get the current user's profile
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the prompt
        try:
            prompt = ProfilePrompt.objects.get(id=prompt_id, profile=profile)
        except ProfilePrompt.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Prompt not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid prompt ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete the prompt
        prompt.delete()
        
        return Response({
            'status': 'success',
            'message': 'Prompt deleted successfully'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='prompts/available')
    def available_prompts(self, request):
        """
        List all available prompt questions.
        
        GET /api/v1/profiles/prompts/available/
        Returns the list of predefined nomad-themed prompts that users can select
        and answer for their profile.
        """
        prompt_type = request.query_params.get('type')
        queryset = Prompt.objects.all()
        if prompt_type:
            queryset = queryset.filter(prompt_type=prompt_type)
        queryset = queryset.order_by('prompt_name')
        serializer = PromptListSerializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


# ============================================================================
# Vehicle ViewSet
# ============================================================================

class VehicleViewSet(viewsets.GenericViewSet):
    """
    ViewSet for vehicle CRUD operations.
    
    Provides endpoints for managing the current user's vehicle:
    - GET /profiles/me/vehicle/ - Get current user's vehicle
    - PUT /profiles/me/vehicle/ - Create or update vehicle
    - DELETE /profiles/me/vehicle/ - Remove vehicle
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action in ['create_or_update']:
            return VehicleUpdateSerializer
        return VehicleSerializer
    
    def _get_user_profile(self, request):
        """Get the current user's profile"""
        try:
            return Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return None
    
    @action(detail=False, methods=['get', 'put', 'delete'], url_path='me/vehicle')
    def vehicle(self, request):
        """
        Get, create/update, or delete the current user's vehicle.
        
        GET /api/v1/profiles/me/vehicle/
        Returns the current user's vehicle if it exists.
        
        PUT /api/v1/profiles/me/vehicle/
        Creates a new vehicle or updates the existing one.
        
        DELETE /api/v1/profiles/me/vehicle/
        Removes the current user's vehicle.
        """
        profile = self._get_user_profile(request)
        if not profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            return self._get_vehicle(profile)
        elif request.method == 'PUT':
            return self._create_or_update_vehicle(request, profile)
        elif request.method == 'DELETE':
            return self._delete_vehicle(profile)
    
    def _get_vehicle(self, profile):
        """Get the current user's vehicle."""
        try:
            vehicle = profile.vehicle
            serializer = VehicleSerializer(vehicle)
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Vehicle.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'No vehicle found. Create one using PUT /profiles/me/vehicle/'
            }, status=status.HTTP_404_NOT_FOUND)

    
    def _create_or_update_vehicle(self, request, profile):
        """Create a new vehicle or update the existing one."""
        try:
            # Try to get existing vehicle
            vehicle = profile.vehicle
            # Update existing vehicle
            serializer = VehicleUpdateSerializer(
                vehicle,
                data=request.data,
                partial=False,
                context={'request': request}
            )
            
            if serializer.is_valid():
                updated_vehicle = serializer.save()
                
                # Ensure has_van is True
                if not profile.has_van:
                    profile.has_van = True
                    profile.save()
                
                response_serializer = VehicleSerializer(updated_vehicle)
                return Response({
                    'status': 'success',
                    'data': response_serializer.data
                }, status=status.HTTP_200_OK)
            
            return Response({
                'status': 'error',
                'message': 'Vehicle update failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Vehicle.DoesNotExist:
            # Create new vehicle
            serializer = VehicleUpdateSerializer(
                data=request.data,
                context={'request': request}
            )
            
            if serializer.is_valid():
                # Create vehicle linked to profile
                vehicle = Vehicle.objects.create(
                    profile=profile,
                    **serializer.validated_data
                )
                
                # Set has_van to True
                profile.has_van = True
                profile.save()
                
                response_serializer = VehicleSerializer(vehicle)
                return Response({
                    'status': 'success',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'status': 'error',
                'message': 'Vehicle creation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _delete_vehicle(self, profile):
        """Delete the current user's vehicle."""
        try:
            vehicle = profile.vehicle
            vehicle.delete()
            
            # Set has_van to False
            profile.has_van = False
            profile.save()
            
            return Response({
                'status': 'success',
                'message': 'Vehicle deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Vehicle.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'No vehicle found to delete'
            }, status=status.HTTP_404_NOT_FOUND)


    @action(detail=False, methods=['post'], url_path='me/vehicle/photos')
    def upload_photo(self, request):
        """
        Upload a photo for the current user's vehicle.
        
        POST /api/v1/profiles/me/vehicle/photos/
        
        Request body:
        {
            "image_url": "https://example.com/photo.jpg",
            "display_order": 1  (optional)
        }
        
        Enforces max 10 photos per vehicle.
        """
        profile = self._get_user_profile(request)
        if not profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if vehicle exists
        try:
            vehicle = profile.vehicle
        except Vehicle.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'No vehicle found. Create a vehicle first using PUT /profiles/me/vehicle/'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Use VehiclePhotoCreateSerializer with vehicle context
        serializer = VehiclePhotoCreateSerializer(
            data=request.data,
            context={'request': request, 'vehicle': vehicle}
        )
        
        if serializer.is_valid():
            photo = serializer.save()
            response_serializer = VehiclePhotoSerializer(photo)
            return Response({
                'status': 'success',
                'data': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'status': 'error',
            'message': 'Photo upload failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['delete'], url_path='me/vehicle/photos/(?P<photo_id>[^/.]+)')
    def delete_photo(self, request, photo_id=None):
        """
        Delete a photo from the current user's vehicle.
        
        DELETE /api/v1/profiles/me/vehicle/photos/{id}/
        
        Only allows users to delete their own vehicle photos.
        """
        profile = self._get_user_profile(request)
        if not profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if vehicle exists
        try:
            vehicle = profile.vehicle
        except Vehicle.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'No vehicle found.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Find the photo
        try:
            photo = vehicle.photos.get(id=photo_id)
        except VehiclePhoto.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Photo not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid photo ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete the photo
        photo.delete()
        
        return Response({
            'status': 'success',
            'message': 'Photo deleted successfully'
        }, status=status.HTTP_200_OK)


# ============================================================================
# Location ViewSet
# ============================================================================

class LocationViewSet(viewsets.GenericViewSet):
    """
    ViewSet for location data.
    
    Provides endpoints for:
    - GET /locations/countries/ - List all countries
    - GET /locations/cities/ - List cities for autocomplete
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='countries')
    def countries(self, request):
        """
        List all countries.
        
        GET /api/v1/locations/countries/
        
        Returns all Country records ordered alphabetically by name.
        """
        countries = Country.objects.all().order_by('name')
        serializer = CountrySerializer(countries, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='cities')
    def cities(self, request):
        """
        List cities for autocomplete.

        GET /api/v1/locations/cities/?q={query}
        """
        query = request.query_params.get('q', '').strip()
        queryset = City.objects.all()
        if query:
            queryset = queryset.filter(display_name__icontains=query)
        queryset = queryset.order_by('display_name')[:10]
        serializer = CitySerializer(queryset, many=True)

        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


# ============================================================================
# Feed ViewSet
# ============================================================================

class FeedViewSet(viewsets.GenericViewSet):
    """
    ViewSet for the nearby users feed.
    
    Provides endpoints for:
    - GET /feed/nearby/ - Get nearby users based on current user's "Now In" location
    """
    permission_classes = [IsAuthenticated]
    
    def _get_friend_status(self, user_profile, target_profile):
        """
        Compute the friend status between the current user and a target profile.
        
        Returns one of: 'none', 'request_sent', 'request_received', 'friends'.
        """
        # Check if they are friends
        friendship_exists = Friendship.objects.filter(
            Q(user1=user_profile, user2=target_profile) |
            Q(user1=target_profile, user2=user_profile)
        ).exists()
        
        if friendship_exists:
            return 'friends'
        
        # Check for pending friend request from current user to target
        request_sent = FriendRequest.objects.filter(
            from_user=user_profile,
            to_user=target_profile,
            status='pending'
        ).exists()
        
        if request_sent:
            return 'request_sent'
        
        # Check for pending friend request from target to current user
        request_received = FriendRequest.objects.filter(
            from_user=target_profile,
            to_user=user_profile,
            status='pending'
        ).exists()
        
        if request_received:
            return 'request_received'
        
        return 'none'
    
    def _add_friend_status_to_profiles(self, user_profile, profiles):
        """
        Add friend_status to a list of profiles efficiently by batching queries.
        """
        if not profiles:
            return profiles
        
        profile_ids = [p.id for p in profiles]
        
        # Get all friendships involving the current user and any of these profiles
        friendships = Friendship.objects.filter(
            Q(user1=user_profile, user2__in=profile_ids) |
            Q(user1__in=profile_ids, user2=user_profile)
        )
        
        # Build a set of friend profile IDs
        friend_ids = set()
        for friendship in friendships:
            if friendship.user1_id == user_profile.id:
                friend_ids.add(friendship.user2_id)
            else:
                friend_ids.add(friendship.user1_id)
        
        # Get pending requests sent by current user to these profiles
        sent_requests = FriendRequest.objects.filter(
            from_user=user_profile,
            to_user__in=profile_ids,
            status='pending'
        ).values_list('to_user_id', flat=True)
        sent_request_ids = set(sent_requests)
        
        # Get pending requests received by current user from these profiles
        received_requests = FriendRequest.objects.filter(
            from_user__in=profile_ids,
            to_user=user_profile,
            status='pending'
        ).values_list('from_user_id', flat=True)
        received_request_ids = set(received_requests)
        
        # Add friend_status to each profile
        for profile in profiles:
            if profile.id in friend_ids:
                profile.friend_status = 'friends'
            elif profile.id in sent_request_ids:
                profile.friend_status = 'request_sent'
            elif profile.id in received_request_ids:
                profile.friend_status = 'request_received'
            else:
                profile.friend_status = 'none'
        
        return profiles

    
    @action(detail=False, methods=['get'], url_path='nearby')
    def nearby(self, request):
        """
        Get nearby users feed based on current user's "Now In" location.
        
        GET /api/v1/feed/nearby/
        
        Returns profiles grouped by timing category based on InTownWindow overlap:
        - here_now: Users with an InTownWindow overlapping today in the same city
        - here_next_week: Users with an InTownWindow starting in the next 7-13 days in the same city
        - here_next_month: Users with an InTownWindow starting in the next 14-44 days in the same city
        """
        from datetime import timedelta
        
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get user's current location from InTownWindow (window containing today)
        today = timezone.now().date()
        user_current_window = user_profile.in_town_windows.filter(
            start_date__lte=today,
            end_date__gte=today
        ).first()
        
        if not user_current_window:
            return Response({
                'status': 'success',
                'data': {
                    'here_now': [],
                    'here_next_week': [],
                    'here_next_month': []
                },
                'message': 'Set your "Now In" location to see nearby travelers.'
            }, status=status.HTTP_200_OK)
        
        user_city = user_current_window.city_area
        
        # Query profiles for each timing category
        # Exclude current user from all queries
        # Filter by looking_for_friends=True before location queries
        base_queryset = Profile.objects.exclude(id=user_profile.id).filter(looking_for_friends=True)
        
        # Apply pet-friendly filter if user requires pet-friendly matches
        if user_profile.pet_friendly_only:
            base_queryset = base_queryset.filter(has_pets=True)
        
        # Apply relationship status filter based on user's looking_for_friend_type
        if user_profile.looking_for_friend_type == 'singles_only':
            base_queryset = base_queryset.filter(relationship_status='single')
        elif user_profile.looking_for_friend_type == 'couples_only':
            base_queryset = base_queryset.filter(relationship_status__in=['in_relationship', 'married'])
        
        # Validate and apply query parameter filters
        feed_filter_service = FeedFilterService()
        
        # Validate filter parameters - return 400 if invalid
        validation_errors = feed_filter_service.validate_filter_params(request)
        if validation_errors:
            return Response({
                'status': 'error',
                'message': 'Invalid filter parameters',
                'errors': validation_errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Apply all query parameter filters to base queryset
        base_queryset = feed_filter_service.apply_filters(base_queryset, request, user_profile)

        # Define time ranges
        next_week_start = today + timedelta(days=7)
        next_week_end = today + timedelta(days=13)
        next_month_start = today + timedelta(days=14)
        next_month_end = today + timedelta(days=44)
        
        # Here Now: profiles with an InTownWindow containing today in the same city
        here_now_profile_ids = InTownWindow.objects.filter(
            start_date__lte=today,
            end_date__gte=today,
            city_area__iexact=user_city
        ).exclude(
            profile=user_profile
        ).values_list('profile_id', flat=True)
        here_now_profiles = base_queryset.filter(id__in=here_now_profile_ids)
        
        # Here Next Week: profiles with an InTownWindow starting in next 7-13 days in the same city
        here_next_week_profile_ids = InTownWindow.objects.filter(
            start_date__gte=next_week_start,
            start_date__lte=next_week_end,
            city_area__iexact=user_city
        ).exclude(
            profile=user_profile
        ).values_list('profile_id', flat=True)
        here_next_week_profiles = base_queryset.filter(id__in=here_next_week_profile_ids)
        
        # Here Next Month: profiles with an InTownWindow starting in next 14-44 days in the same city
        here_next_month_profile_ids = InTownWindow.objects.filter(
            start_date__gte=next_month_start,
            start_date__lte=next_month_end,
            city_area__iexact=user_city
        ).exclude(
            profile=user_profile
        ).values_list('profile_id', flat=True)
        here_next_month_profiles = base_queryset.filter(id__in=here_next_month_profile_ids)
        
        # Create RelevanceScorer instance for sorting profiles
        relevance_scorer = RelevanceScorer()
        
        # Convert querysets to lists and sort by relevance within each timing category
        here_now_list = list(here_now_profiles)
        here_next_week_list = list(here_next_week_profiles)
        here_next_month_list = list(here_next_month_profiles)
        
        # Sort each category by relevance score (descending), with created_at as tiebreaker
        here_now_sorted = relevance_scorer.sort_by_relevance(user_profile, here_now_list)
        here_next_week_sorted = relevance_scorer.sort_by_relevance(user_profile, here_next_week_list)
        here_next_month_sorted = relevance_scorer.sort_by_relevance(user_profile, here_next_month_list)
        
        # Add timing labels and serialize each category
        here_now_data = []
        for profile in here_now_sorted:
            profile.timing_label = "Here Now"
            here_now_data.append(profile)
        
        here_next_week_data = []
        for profile in here_next_week_sorted:
            profile.timing_label = "Here Next Week"
            here_next_week_data.append(profile)
        
        here_next_month_data = []
        for profile in here_next_month_sorted:
            profile.timing_label = "Here Next Month"
            here_next_month_data.append(profile)
        
        # Add friend_status to each profile
        self._add_friend_status_to_profiles(user_profile, here_now_data)
        self._add_friend_status_to_profiles(user_profile, here_next_week_data)
        self._add_friend_status_to_profiles(user_profile, here_next_month_data)
        
        # Serialize the data
        here_now_serialized = FeedCardSerializer(here_now_data, many=True).data
        here_next_week_serialized = FeedCardSerializer(here_next_week_data, many=True).data
        here_next_month_serialized = FeedCardSerializer(here_next_month_data, many=True).data
        
        return Response({
            'status': 'success',
            'data': {
                'here_now': here_now_serialized,
                'here_next_week': here_next_week_serialized,
                'here_next_month': here_next_month_serialized
            }
        }, status=status.HTTP_200_OK)


# ============================================================================
# Discovery ViewSet
# ============================================================================

class DiscoveryViewSet(viewsets.GenericViewSet):
    """
    ViewSet for discovery and swiping functionality.
    
    Provides endpoints for:
    - GET /discovery/dating/ - Get profiles with dating intent
    - GET /discovery/friends/ - Get profiles with friends intent
    - POST /discovery/swipe/ - Record a swipe (like/pass)
    """
    permission_classes = [IsAuthenticated]
    
    def _get_user_profile(self, request):
        """Get the current user's profile"""
        try:
            return request.user.profile
        except Profile.DoesNotExist:
            return None
    
    def _get_swiped_profile_ids(self, user_profile, mode):
        """Get IDs of profiles the user has already swiped on in this mode"""
        return PersonSwipe.objects.filter(
            swiper=user_profile,
            mode=mode
        ).values_list('swiped_on_id', flat=True)
    
    def _calculate_overlap_score(self, user_windows, profile_windows):
        """
        Calculate overlap score between two sets of in-town windows.
        Higher score = more overlap = should appear earlier in results.
        """
        if not user_windows or not profile_windows:
            return 0
        
        total_overlap_days = 0
        
        for user_window in user_windows:
            for profile_window in profile_windows:
                # Check if windows overlap (same city/area and overlapping dates)
                if user_window.city_area.lower() == profile_window.city_area.lower():
                    # Calculate date overlap
                    overlap_start = max(user_window.start_date, profile_window.start_date)
                    overlap_end = min(user_window.end_date, profile_window.end_date)
                    
                    if overlap_start <= overlap_end:
                        overlap_days = (overlap_end - overlap_start).days + 1
                        total_overlap_days += overlap_days
        
        return total_overlap_days

    
    def _apply_filters(self, queryset, request, user_profile):
        """
        Apply discovery filters to the queryset.
        
        Filters:
        - travel_pace: Filter by travel pace (slow, mixed, fast)
        - profile_type: Filter by profile type (solo, couple, group)
        - pet_compatible: Filter by pet compatibility
        """
        # Filter by travel_pace
        travel_pace = request.query_params.get('travel_pace')
        if travel_pace:
            queryset = queryset.filter(travel_pace=travel_pace)
        
        # Filter by profile_type
        profile_type = request.query_params.get('profile_type')
        if profile_type:
            queryset = queryset.filter(profile_type=profile_type)
        
        # Filter by pet_compatible
        pet_compatible = request.query_params.get('pet_compatible')
        if pet_compatible is not None:
            pet_compatible_bool = pet_compatible.lower() in ('true', '1', 'yes')
            if pet_compatible_bool:
                # If user wants pet-compatible profiles, exclude those who require pet-friendly only
                # but don't have pets themselves
                if user_profile.has_pets:
                    # User has pets - show profiles that are pet-friendly
                    queryset = queryset.filter(
                        Q(pet_friendly_only=False) | Q(has_pets=True)
                    )
                else:
                    # User doesn't have pets - exclude profiles that require pet-friendly only
                    queryset = queryset.filter(pet_friendly_only=False)
        
        return queryset
    
    def _get_discovery_profiles(self, request, mode):
        """
        Get profiles for discovery based on mode (dating/friends).
        
        - Filters by intent (looking_for_dating or looking_for_friends)
        - Excludes already-swiped profiles
        - Excludes current user
        - Applies additional filters
        - Boosts profiles with overlapping in-town windows
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return None, Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get IDs of already-swiped profiles
        swiped_ids = self._get_swiped_profile_ids(user_profile, mode)
        
        # Base queryset - exclude current user and already-swiped profiles
        queryset = Profile.objects.exclude(
            id=user_profile.id
        ).exclude(
            id__in=swiped_ids
        )
        
        # Filter by intent based on mode
        if mode == 'dating':
            # Only show profiles where looking_for_dating is true
            queryset = queryset.filter(looking_for_dating=True)
        else:  # friends mode
            # Only show profiles where looking_for_friends is true
            queryset = queryset.filter(looking_for_friends=True)
        
        # Apply additional filters
        queryset = self._apply_filters(queryset, request, user_profile)
        
        # Get user's in-town windows for overlap calculation
        user_windows = list(user_profile.in_town_windows.all())
        
        # Calculate overlap scores and sort
        profiles_with_scores = []
        for profile in queryset:
            profile_windows = list(profile.in_town_windows.all())
            overlap_score = self._calculate_overlap_score(user_windows, profile_windows)
            profiles_with_scores.append((profile, overlap_score))
        
        # Sort by overlap score (descending)
        profiles_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Extract sorted profiles
        sorted_profiles = [p[0] for p in profiles_with_scores]
        
        return sorted_profiles, None

    
    @action(detail=False, methods=['get'], url_path='dating')
    def dating(self, request):
        """
        Get profiles for dating mode discovery.
        
        GET /discovery/dating/
        
        Query Parameters:
        - travel_pace: Filter by travel pace (slow, mixed, fast)
        - profile_type: Filter by profile type (solo, couple, group)
        - pet_compatible: Filter by pet compatibility (true/false)
        
        Returns profiles with looking_for_dating=True, excluding already-swiped
        profiles and the current user. Results are boosted by in-town window overlap.
        """
        profiles, error_response = self._get_discovery_profiles(request, 'dating')
        
        if error_response:
            return error_response
        
        # Serialize profiles
        serializer = ProfileSerializer(profiles, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='friends')
    def friends(self, request):
        """
        Get profiles for friends mode discovery.
        
        GET /discovery/friends/
        
        Query Parameters:
        - travel_pace: Filter by travel pace (slow, mixed, fast)
        - profile_type: Filter by profile type (solo, couple, group)
        - pet_compatible: Filter by pet compatibility (true/false)
        
        Returns profiles with looking_for_friends=True, excluding already-swiped
        profiles and the current user. Results are boosted by in-town window overlap.
        """
        profiles, error_response = self._get_discovery_profiles(request, 'friends')
        
        if error_response:
            return error_response
        
        # Serialize profiles
        serializer = ProfileSerializer(profiles, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    
    @action(detail=False, methods=['post'], url_path='swipe')
    def swipe(self, request):
        """
        Record a swipe (like/pass) on a profile.
        
        POST /discovery/swipe/
        
        Request Body:
        {
            "swiped_on": "<profile_id>",
            "is_like": true/false,
            "mode": "dating" or "friends"
        }
        
        Returns:
        - Success response with swipe data
        - If mutual match, includes match notification
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Add swiper to the data
        data = request.data.copy()
        data['swiper'] = user_profile.id
        
        serializer = PersonSwipeSerializer(data=data, context={'swiper': user_profile})
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid swipe data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        swipe = serializer.save()
        
        # Check if a match was created
        match_created = serializer.get_match_created(swipe)
        match = serializer._match if match_created else None
        
        response_data = {
            'swipe': {
                'id': str(swipe.id),
                'swiped_on': str(swipe.swiped_on.id),
                'is_like': swipe.is_like,
                'mode': swipe.mode,
                'swiped_at': swipe.swiped_at.isoformat()
            }
        }
        
        if match_created and match:
            # Include match notification
            response_data['match'] = {
                'id': str(match.id),
                'matched_with': {
                    'id': str(match.get_other_user(user_profile).id),
                    'display_name': match.get_other_user(user_profile).display_name,
                    'avatar_url': match.get_other_user(user_profile).avatar_url
                },
                'mode': match.mode,
                'matched_at': match.matched_at.isoformat()
            }
            response_data['is_match'] = True
        else:
            response_data['is_match'] = False
        
        return Response({
            'status': 'success',
            'data': response_data
        }, status=status.HTTP_201_CREATED)
