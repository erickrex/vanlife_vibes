"""
Authentication ViewSet for user registration, login, logout, and current user retrieval.

This module contains the AuthViewSet which handles all authentication-related
API endpoints.

Requirements: 2.1 (Backend File Organization)
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate

from core.throttles import LoginRateThrottle
from core.serializers import (
    UserAccountSerializer,
    UserRegistrationSerializer,
    UserLoginSerializer,
)


class AuthViewSet(viewsets.GenericViewSet):
    """ViewSet for authentication operations"""
    permission_classes = [AllowAny]
    serializer_class = UserAccountSerializer
    
    @action(detail=False, methods=['post'], url_path='signup')
    def signup(self, request):
        """
        Create new user account
        POST /api/v1/auth/signup
        """
        serializer = UserRegistrationSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.save()
            
            # Create authentication token
            token, created = Token.objects.get_or_create(user=user)
            
            # Return user data and token
            user_serializer = UserAccountSerializer(user)
            
            return Response({
                'status': 'success',
                'data': {
                    'user': user_serializer.data,
                    'token': token.key
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'status': 'error',
            'message': 'Registration failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='login')
    @throttle_classes([LoginRateThrottle])
    def login(self, request):
        """
        Authenticate user and return token
        POST /api/v1/auth/login
        Rate limited to 5 attempts per 15 minutes
        """
        serializer = UserLoginSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid credentials',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        # Authenticate user
        user = authenticate(username=username, password=password)
        
        if user is not None:
            # Get or create token
            token, created = Token.objects.get_or_create(user=user)
            
            # Return user data and token
            user_serializer = UserAccountSerializer(user)
            
            return Response({
                'status': 'success',
                'data': {
                    'user': user_serializer.data,
                    'token': token.key
                }
            }, status=status.HTTP_200_OK)
        
        # Return generic error to prevent user enumeration
        return Response({
            'status': 'error',
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    @action(detail=False, methods=['get'], url_path='me', permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        Get current authenticated user
        GET /api/v1/auth/me
        """
        serializer = UserAccountSerializer(request.user)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='logout', permission_classes=[IsAuthenticated])
    def logout(self, request):
        """
        Invalidate user token
        POST /api/v1/auth/logout
        """
        try:
            # Delete the user's token
            request.user.auth_token.delete()
            
            return Response({
                'status': 'success',
                'message': 'Successfully logged out'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': 'Logout failed'
            }, status=status.HTTP_400_BAD_REQUEST)
