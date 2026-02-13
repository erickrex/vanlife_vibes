"""Profile ViewSets for profiles, vehicles, locations, and analytics."""

from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.models import (
    Profile, Country, HobbyTag, Vehicle, VehiclePhoto,
    InTownWindow, City, Prompt, ProfilePrompt,
    AnalyticsEvent, ProfilePhoto
)
from core.serializers import (
    ProfileSerializer,
    ProfileUpdateSerializer,
    HobbyTagSerializer,
    VehicleSerializer,
    VehicleUpdateSerializer,
    VehiclePhotoSerializer,
    VehiclePhotoCreateSerializer,
    CountrySerializer,
    InTownWindowSerializer,
    CitySerializer,
    ProfilePromptSerializer,
    PromptListSerializer,
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

