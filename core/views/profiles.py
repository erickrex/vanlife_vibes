"""Profile ViewSets for profiles, vehicles, locations, feed, and discovery."""

from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from core.models import (
    Profile, Country, HobbyTag, Vehicle, VehiclePhoto,
    InTownWindow, City, Prompt, ProfilePrompt, PersonSwipe,
    AnalyticsEvent, ProfilePhoto
)
from core.services.swipe_limit import SwipeLimitService
from core.serializers import (
    ProfileSerializer,
    ProfileUpdateSerializer,
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
    PersonSwipeSerializer,
    AnalyticsEventCreateSerializer,
    AnalyticsEventSerializer,
    ProfilePhotoSerializer,
    ProfilePhotoUploadSerializer,
)
from core.services.photo_upload import (
    validate_photo_file,
    handle_photo_upload,
    handle_photo_delete,
)
from core.services.feed_filters import FeedFilterService
from core.services.relevance import RelevanceScorer


# ============================================================================
# Analytics ViewSet
# ============================================================================

class AnalyticsViewSet(viewsets.GenericViewSet):
    """Lightweight analytics event ingestion."""

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='events')
    def events(self, request):
        """Track an analytics event for the authenticated user."""
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
    """Profile CRUD operations."""
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
            'in_town_windows',
        )
    
    @action(detail=False, methods=['get', 'patch'], url_path='me')
    def me(self, request):
        """GET or PATCH the current user's profile."""
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
        """Get profile by ID."""
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

    @action(detail=False, methods=['get'], url_path='hobbies')
    def hobbies(self, request):
        """GET /api/v1/profiles/hobbies/ — List all available hobby tags."""
        hobby_tags = HobbyTag.objects.all().order_by('name')
        serializer = HobbyTagSerializer(hobby_tags, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'post'], url_path='me/in-town-windows')
    def in_town_windows(self, request):
        """GET: List in-town windows. POST: Create one (max 3)."""
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
        """DELETE /api/v1/profiles/me/in-town-windows/{id}/"""
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
        """GET: List profile prompts. POST: Create one (max 3)."""
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
        """DELETE /api/v1/profiles/me/prompts/{id}/"""
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
        """GET /api/v1/profiles/prompts/available/ — List predefined prompt questions."""
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

    @action(detail=False, methods=['get', 'post'], url_path='me/photos')
    def photos(self, request):
        """GET: List profile photos. POST: Upload a new photo (multipart/form-data)."""
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'GET':
            photos = ProfilePhoto.objects.filter(profile=profile)
            serializer = ProfilePhotoSerializer(
                photos, many=True, context={'request': request}
            )
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        elif request.method == 'POST':
            upload_serializer = ProfilePhotoUploadSerializer(data=request.data)
            if not upload_serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid upload data',
                    'errors': upload_serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            image_file = upload_serializer.validated_data['image']
            photo_type = upload_serializer.validated_data['photo_type']

            # Validate the photo file (size, content type, image integrity)
            try:
                validate_photo_file(image_file)
            except Exception as e:
                message = e.detail if hasattr(e, 'detail') else str(e)
                if isinstance(message, list):
                    message = str(message[0])
                return Response({
                    'status': 'error',
                    'message': str(message)
                }, status=status.HTTP_400_BAD_REQUEST)

            # Handle the upload (enforce limits, create record, sync URLs)
            try:
                photo = handle_photo_upload(
                    profile=profile,
                    image_file=image_file,
                    photo_type=photo_type,
                )
            except Exception as e:
                message = e.detail if hasattr(e, 'detail') else str(e)
                if isinstance(message, list):
                    message = str(message[0])
                return Response({
                    'status': 'error',
                    'message': str(message)
                }, status=status.HTTP_400_BAD_REQUEST)

            response_serializer = ProfilePhotoSerializer(
                photo, context={'request': request}
            )
            return Response({
                'status': 'success',
                'data': response_serializer.data,
                'message': 'Photo uploaded successfully'
            }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['delete'], url_path='me/photos/(?P<photo_id>[^/.]+)')
    def delete_photo(self, request, photo_id=None):
        """Delete a profile photo by ID."""
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            photo = ProfilePhoto.objects.get(id=photo_id)
        except ProfilePhoto.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Photo not found.'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid photo ID'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check ownership
        if photo.profile_id != profile.id:
            return Response({
                'status': 'error',
                'message': 'You do not have permission to perform this action.'
            }, status=status.HTTP_403_FORBIDDEN)

        handle_photo_delete(profile, photo)

        return Response({
            'status': 'success',
            'message': 'Photo deleted successfully'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['patch'], url_path='me/photos/(?P<photo_id>[^/.]+)/update')
    def update_photo(self, request, photo_id=None):
        """Update a profile photo's display_order."""
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            photo = ProfilePhoto.objects.get(id=photo_id)
        except ProfilePhoto.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Photo not found.'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({
                'status': 'error',
                'message': 'Invalid photo ID'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check ownership
        if photo.profile_id != profile.id:
            return Response({
                'status': 'error',
                'message': 'You do not have permission to perform this action.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Update display_order if provided
        display_order = request.data.get('display_order')
        if display_order is not None:
            try:
                display_order = int(display_order)
                if display_order < 0:
                    raise ValueError()
            except (ValueError, TypeError):
                return Response({
                    'status': 'error',
                    'message': 'display_order must be a non-negative integer'
                }, status=status.HTTP_400_BAD_REQUEST)
            photo.display_order = display_order
            photo.save(update_fields=['display_order'])

        serializer = ProfilePhotoSerializer(
            photo, context={'request': request}
        )
        return Response({
            'status': 'success',
            'data': serializer.data,
            'message': 'Photo updated successfully'
        }, status=status.HTTP_200_OK)


# ============================================================================
# Vehicle ViewSet
# ============================================================================

class VehicleViewSet(viewsets.GenericViewSet):
    """Vehicle CRUD operations for the current user."""
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
        """Get, create/update, or delete the current user's vehicle."""
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
        """Upload a photo for the current user's vehicle."""
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
        """Delete a photo from the current user's vehicle."""
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
    """Location data (countries and cities)."""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='countries')
    def countries(self, request):
        """List all countries."""
        countries = Country.objects.all().order_by('name')
        serializer = CountrySerializer(countries, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='cities')
    def cities(self, request):
        """List cities for autocomplete."""
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
    """Nearby users feed."""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='nearby')
    def nearby(self, request):
        """Get nearby users grouped by timing (here_now, here_next_week, here_next_month)."""
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

# Combined score weights for dating discovery ranking
W_LOCATION = 2.0
W_RELEVANCE = 1.0
W_COMPLETENESS = 0.5


class DiscoveryViewSet(viewsets.GenericViewSet):
    """Discovery and swiping for dating/friends modes."""
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
        """Calculate overlap days between two sets of in-town windows."""
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

    def _filter_rankable_windows(self, windows, allow_future):
        """Filter windows used for ranking, gating future windows by premium."""
        today = timezone.now().date()
        if allow_future:
            # Ignore stale windows to avoid boosting based on past travel history.
            return [window for window in windows if window.end_date >= today]
        # Free users only get ranking value from current location overlap.
        return [window for window in windows if window.start_date <= today <= window.end_date]
    def _find_overlap_windows(self, user_windows, profile_windows):
        """Return list of overlapping window details between two users."""
        overlaps = []
        if not user_windows or not profile_windows:
            return overlaps

        for user_window in user_windows:
            for profile_window in profile_windows:
                if user_window.city_area.lower() == profile_window.city_area.lower():
                    overlap_start = max(user_window.start_date, profile_window.start_date)
                    overlap_end = min(user_window.end_date, profile_window.end_date)
                    if overlap_start <= overlap_end:
                        overlaps.append({
                            'city_area': profile_window.city_area,
                            'start_date': overlap_start.isoformat(),
                            'end_date': overlap_end.isoformat(),
                            'overlap_days': (overlap_end - overlap_start).days + 1,
                        })
        return overlaps

    
    def _apply_filters(self, queryset, request, user_profile):
        """Apply discovery filters (travel_pace, profile_type, pet_compatible)."""
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

    def _apply_gender_filters(self, queryset, user_profile):
        """Apply bidirectional gender preference filtering."""
        # Forward: filter by current user's preferences
        gender_q = Q()
        if user_profile.interested_in_men:
            gender_q |= Q(gender='man')
        if user_profile.interested_in_women:
            gender_q |= Q(gender='woman')
        if user_profile.interested_in_nonbinary:
            gender_q |= Q(gender='non_binary')
        # Always include profiles with no gender set
        gender_q |= Q(gender__isnull=True) | Q(gender='')

        if not (user_profile.interested_in_men or user_profile.interested_in_women or user_profile.interested_in_nonbinary):
            return queryset.none()

        queryset = queryset.filter(gender_q)

        # Reverse: exclude profiles whose preferences don't include current user
        user_gender = user_profile.gender
        if user_gender == 'man':
            queryset = queryset.filter(Q(interested_in_men=True) | Q(gender__isnull=True) | Q(gender=''))
        elif user_gender == 'woman':
            queryset = queryset.filter(Q(interested_in_women=True) | Q(gender__isnull=True) | Q(gender=''))
        elif user_gender == 'non_binary':
            queryset = queryset.filter(Q(interested_in_nonbinary=True) | Q(gender__isnull=True) | Q(gender=''))
        # If current user has no gender set, don't apply reverse filter

        return queryset

    
    def _get_discovery_profiles(self, request, mode):
        """Get filtered and sorted profiles for discovery by mode."""
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
            # Apply bidirectional gender preference filtering
            queryset = self._apply_gender_filters(queryset, user_profile)
        else:  # friends mode
            # Only show profiles where looking_for_friends is true
            queryset = queryset.filter(looking_for_friends=True)
        
        # Apply additional filters
        queryset = self._apply_filters(queryset, request, user_profile)
        
        # Get user's in-town windows for overlap calculation
        user_is_premium = SwipeLimitService.is_premium(user_profile)
        user_windows = self._filter_rankable_windows(
            list(user_profile.in_town_windows.all()),
            allow_future=user_is_premium,
        )
        
        # Calculate overlap scores and find overlapping windows
        profiles_with_scores = []
        for profile in queryset:
            candidate_is_premium = SwipeLimitService.is_premium(profile)
            profile_windows = self._filter_rankable_windows(
                list(profile.in_town_windows.all()),
                allow_future=candidate_is_premium,
            )
            overlap_score = self._calculate_overlap_score(user_windows, profile_windows)
            profile.overlap_windows = self._find_overlap_windows(user_windows, profile_windows)
            profiles_with_scores.append((profile, overlap_score))
        
        # Sort by overlap score (descending)
        profiles_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Apply combined score ranking with RelevanceScorer for both modes.
        # Friends mode intentionally skips gender filtering above, but should
        # still benefit from most shared relevance signals used in dating mode.
        top_candidates = profiles_with_scores[:50]
        scorer = RelevanceScorer()
        ranked = []
        for profile, overlap in top_candidates:
            relevance = scorer.calculate_score(user_profile, profile)
            completeness = scorer.calculate_completeness_score(profile)
            final_score = (overlap * W_LOCATION) + (relevance * W_RELEVANCE) + (completeness * W_COMPLETENESS)
            profile.relevance_score = relevance
            ranked.append((profile, final_score))
        ranked.sort(key=lambda x: x[1], reverse=True)
        sorted_profiles = [p[0] for p in ranked]
        
        return sorted_profiles, None

    
    @action(detail=False, methods=['get'])
    def dating(self, request):
        """Get profiles for dating mode discovery."""
        profiles, error_response = self._get_discovery_profiles(request, 'dating')

        if error_response:
            return error_response

        user_profile = self._get_user_profile(request)
        serializer = ProfileSerializer(profiles, many=True)

        return Response({
            'status': 'success',
            'data': {
                'profiles': serializer.data,
                'remaining_swipes': SwipeLimitService.get_remaining_swipes(user_profile),
                'is_premium': SwipeLimitService.is_premium(user_profile),
            }
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def friends(self, request):
        """Get profiles for friends mode discovery."""
        profiles, error_response = self._get_discovery_profiles(request, 'friends')

        if error_response:
            return error_response

        user_profile = self._get_user_profile(request)
        serializer = ProfileSerializer(profiles, many=True)

        return Response({
            'status': 'success',
            'data': {
                'profiles': serializer.data,
                'remaining_swipes': SwipeLimitService.get_remaining_swipes(user_profile),
                'is_premium': SwipeLimitService.is_premium(user_profile),
            }
        }, status=status.HTTP_200_OK)

    
    @action(detail=False, methods=['post'], url_path='swipe')
    def swipe(self, request):
        """Record a swipe (like/pass) on a profile."""
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check swipe limit before creating swipe
        if not SwipeLimitService.can_swipe(user_profile):
            return Response({
                'status': 'error',
                'message': 'Daily swipe limit reached. Upgrade to Premium for unlimited swipes.',
                'data': {
                    'swipe_limit_reached': True,
                    'remaining_swipes': 0,
                    'is_premium': False
                }
            }, status=status.HTTP_403_FORBIDDEN)
        
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
        
        # Include subscription metadata in response
        response_data['remaining_swipes'] = SwipeLimitService.get_remaining_swipes(user_profile)
        response_data['is_premium'] = SwipeLimitService.is_premium(user_profile)
        
        return Response({
            'status': 'success',
            'data': response_data
        }, status=status.HTTP_201_CREATED)
