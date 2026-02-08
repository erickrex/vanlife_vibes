# core/views/plans.py
"""
ViewSets for plan management and messaging.

This module contains the PlanViewSet which handles:
- Creating, listing, and retrieving plans
- Joining, leaving, and confirming attendance
- Plan messaging via MessageMixin

Requirements: 2.1 (Backend File Organization)
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from core.models import (
    Profile,
    Plan,
    PlanAttendee,
    PlanMessage,
)
from core.serializers import (
    PlanSerializer,
    PlanCreateSerializer,
    PlanUpdateSerializer,
    PlanAttendeeSerializer,
    PlanMessageSerializer,
    PlanMessageCreateSerializer,
)
from .mixins import MessageMixin


class PlanViewSet(MessageMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing lightweight meetup plans.
    
    Provides endpoints for:
    - GET /plans/ - List available plans
    - POST /plans/ - Create a new plan
    - GET /plans/{id}/ - Get plan details
    - PATCH /plans/{id}/ - Update plan (creator only)
    - DELETE /plans/{id}/ - Cancel plan (creator only)
    - POST /plans/{id}/join/ - Join a plan
    - POST /plans/{id}/leave/ - Leave a plan
    - POST /plans/{id}/confirm/ - Confirm attendance
    - GET /plans/{id}/messages/ - List messages in plan chat
    - POST /plans/{id}/messages/ - Send a message to plan chat
    
    Uses MessageMixin for the messages endpoint (Requirements 1.1, 1.9).
    """
    permission_classes = [IsAuthenticated]
    
    # MessageMixin configuration
    message_model = PlanMessage
    message_serializer_class = PlanMessageSerializer
    message_create_serializer_class = PlanMessageCreateSerializer
    
    def get_queryset(self):
        """
        Return plans that are open or full (not cancelled/completed).
        Optionally filter by status, plan_type, or meetup_area.
        """
        queryset = Plan.objects.all()
        
        # Filter by status (default: show open and full plans)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        else:
            # By default, exclude cancelled and completed plans
            queryset = queryset.exclude(status__in=['cancelled', 'completed'])
        
        # Filter by plan_type
        plan_type = self.request.query_params.get('plan_type')
        if plan_type:
            queryset = queryset.filter(plan_type=plan_type)
        
        # Filter by meetup_area (partial match)
        meetup_area = self.request.query_params.get('meetup_area')
        if meetup_area:
            queryset = queryset.filter(meetup_area__icontains=meetup_area)
        
        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(plan_date__gte=from_date)
        
        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(plan_date__lte=to_date)
        
        return queryset.order_by('plan_date', 'time_window')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return PlanCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PlanUpdateSerializer
        return PlanSerializer
    
    def _get_user_profile(self, request):
        """Get the current user's profile"""
        try:
            return request.user.profile
        except Profile.DoesNotExist:
            return None
    
    # -------------------------------------------------------------------------
    # MessageMixin hook implementations
    # -------------------------------------------------------------------------
    
    def get_message_parent(self, pk):
        """
        Look up the Plan by ID.
        
        Returns (plan, None) on success or (None, error_response) on failure.
        Requirement 1.2: Customizable parent object lookup
        """
        try:
            plan = Plan.objects.get(pk=pk)
            return plan, None
        except Plan.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def get_message_queryset(self, parent):
        """
        Return messages for this plan, ordered by created_at ascending.
        
        Requirement 1.5: Messages ordered by created_at ascending
        """
        return PlanMessage.objects.filter(plan=parent).order_by('created_at')
    
    def check_message_access(self, parent, profile):
        """
        Verify the user is an attendee of the plan (not declined).
        
        Returns (True, None) if allowed, (False, error_response) if not.
        Requirement 1.3: Customizable authorization check
        """
        attendee = PlanAttendee.objects.filter(
            plan=parent,
            user=profile
        ).exclude(status='declined').first()
        
        if not attendee:
            return False, Response({
                'status': 'error',
                'message': 'Only plan attendees can access the group chat'
            }, status=status.HTTP_403_FORBIDDEN)
        return True, None
    
    def check_can_send_message(self, parent):
        """
        Verify the plan is not cancelled or completed before allowing message sending.
        
        Returns (True, None) if allowed, (False, error_response) if not.
        """
        if parent.status == 'cancelled':
            return False, Response({
                'status': 'error',
                'message': 'Cannot send messages to a cancelled plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if parent.status == 'completed':
            return False, Response({
                'status': 'error',
                'message': 'Cannot send messages to a completed plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return True, None
    
    def create_message(self, parent, profile, validated_data):
        """
        Create a PlanMessage for this plan.
        
        Args:
            parent: The Plan instance
            profile: The sender's profile
            validated_data: Validated data from the serializer
        
        Returns:
            The created PlanMessage instance
        """
        return PlanMessage.objects.create(
            plan=parent,
            sender=profile,
            content=validated_data['content']
        )
    
    # -------------------------------------------------------------------------
    # ViewSet actions
    # -------------------------------------------------------------------------
    
    def list(self, request):
        """
        List available plans.
        
        GET /plans/
        
        Query parameters:
        - status: Filter by plan status (open, full, cancelled, completed)
        - plan_type: Filter by plan type (coffee, sunrise_hike, etc.)
        - meetup_area: Filter by meetup area (partial match)
        - from_date: Filter plans on or after this date (YYYY-MM-DD)
        - to_date: Filter plans on or before this date (YYYY-MM-DD)
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        queryset = self.get_queryset()
        
        serializer = PlanSerializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def retrieve(self, request, pk=None):
        """
        Get plan details.
        
        GET /plans/{id}/
        
        Returns plan details including attendees.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = PlanSerializer(plan)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def create(self, request):
        """
        Create a new plan.
        
        POST /plans/
        
        Request body:
        {
            "title": "Morning Coffee",
            "plan_type": "coffee",
            "plan_date": "2024-02-15",
            "time_window": "morning",
            "meetup_area": "Austin, TX",
            "description": "Optional description",
            "max_attendees": 6
        }
        
        The creator is automatically added as an attendee with 'confirmed' status.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = PlanCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid plan data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the plan
        plan = Plan.objects.create(
            created_by=user_profile,
            **serializer.validated_data
        )
        
        # Add creator as confirmed attendee
        PlanAttendee.objects.create(
            plan=plan,
            user=user_profile,
            status='confirmed',
            confirmed_at=timezone.now()
        )
        
        response_serializer = PlanSerializer(plan)
        
        return Response({
            'status': 'success',
            'message': 'Plan created successfully',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, pk=None):
        """
        Update a plan (full update).
        
        PUT /plans/{id}/
        
        Only the plan creator can update the plan.
        """
        return self._update_plan(request, pk, partial=False)
    
    def partial_update(self, request, pk=None):
        """
        Partially update a plan.
        
        PATCH /plans/{id}/
        
        Only the plan creator can update the plan.
        Updatable fields: title, time_window, meetup_area, description, max_attendees
        """
        return self._update_plan(request, pk, partial=True)
    
    def _update_plan(self, request, pk, partial=False):
        """Helper method for updating plans"""
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Only creator can update
        if plan.created_by != user_profile:
            return Response({
                'status': 'error',
                'message': 'Only the plan creator can update this plan'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Cannot update cancelled or completed plans
        if plan.status in ['cancelled', 'completed']:
            return Response({
                'status': 'error',
                'message': f'Cannot update a {plan.status} plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = PlanUpdateSerializer(plan, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid plan data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        response_serializer = PlanSerializer(plan)
        
        return Response({
            'status': 'success',
            'message': 'Plan updated successfully',
            'data': response_serializer.data
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, pk=None):
        """
        Cancel a plan.
        
        DELETE /plans/{id}/
        
        Only the plan creator can cancel the plan.
        Sets status to 'cancelled' rather than deleting the record.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Only creator can cancel
        if plan.created_by != user_profile:
            return Response({
                'status': 'error',
                'message': 'Only the plan creator can cancel this plan'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Cannot cancel already cancelled or completed plans
        if plan.status == 'cancelled':
            return Response({
                'status': 'error',
                'message': 'Plan is already cancelled'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if plan.status == 'completed':
            return Response({
                'status': 'error',
                'message': 'Cannot cancel a completed plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Cancel the plan
        plan.status = 'cancelled'
        plan.save()
        
        return Response({
            'status': 'success',
            'message': 'Plan cancelled successfully'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='join')
    def join(self, request, pk=None):
        """
        Join a plan.
        
        POST /plans/{id}/join/
        
        Adds the current user as an attendee with 'joined' status.
        
        Validations:
        - Plan must be open (not full, cancelled, or completed)
        - User cannot already be an attendee
        - Plan cannot be at max capacity
        
        When joining causes the plan to reach max capacity, status changes to 'full'.
        Property 12: Plan Capacity Enforcement
        When the number of attendees reaches max_attendees, the plan status
        changes to 'full' and additional join requests are rejected.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check plan status
        if plan.status == 'cancelled':
            return Response({
                'status': 'error',
                'message': 'Cannot join a cancelled plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if plan.status == 'completed':
            return Response({
                'status': 'error',
                'message': 'Cannot join a completed plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if plan.status == 'full':
            return Response({
                'status': 'error',
                'message': 'Plan is full'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is already an attendee
        existing_attendee = PlanAttendee.objects.filter(
            plan=plan,
            user=user_profile
        ).first()
        
        if existing_attendee:
            if existing_attendee.status == 'declined':
                # Re-join if previously declined
                existing_attendee.status = 'joined'
                existing_attendee.save()
            else:
                return Response({
                    'status': 'error',
                    'message': 'You have already joined this plan'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Check capacity before adding
            current_count = plan.attendees.exclude(status='declined').count()
            if current_count >= plan.max_attendees:
                # Update plan status to full
                plan.status = 'full'
                plan.save()
                return Response({
                    'status': 'error',
                    'message': 'Plan is full'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create new attendee
            existing_attendee = PlanAttendee.objects.create(
                plan=plan,
                user=user_profile,
                status='joined'
            )
        
        # Check if plan is now full after joining
        current_count = plan.attendees.exclude(status='declined').count()
        if current_count >= plan.max_attendees and plan.status == 'open':
            plan.status = 'full'
            plan.save()
        
        serializer = PlanAttendeeSerializer(existing_attendee)
        
        return Response({
            'status': 'success',
            'message': 'Successfully joined the plan',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='leave')
    def leave(self, request, pk=None):
        """
        Leave a plan.
        
        POST /plans/{id}/leave/
        
        Sets the attendee status to 'declined'.
        The plan creator cannot leave their own plan.
        
        If leaving causes the plan to go below max capacity, status changes back to 'open'.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Creator cannot leave their own plan
        if plan.created_by == user_profile:
            return Response({
                'status': 'error',
                'message': 'Plan creator cannot leave their own plan. Cancel the plan instead.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is an attendee
        try:
            attendee = PlanAttendee.objects.get(
                plan=plan,
                user=user_profile
            )
        except PlanAttendee.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'You are not an attendee of this plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already declined
        if attendee.status == 'declined':
            return Response({
                'status': 'error',
                'message': 'You have already left this plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set status to declined
        attendee.status = 'declined'
        attendee.save()
        
        # If plan was full, check if it should be reopened
        if plan.status == 'full':
            current_count = plan.attendees.exclude(status='declined').count()
            if current_count < plan.max_attendees:
                plan.status = 'open'
                plan.save()
        
        return Response({
            'status': 'success',
            'message': 'Successfully left the plan'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        """
        Confirm attendance for a plan.
        
        POST /plans/{id}/confirm/
        
        Changes attendee status from 'joined' to 'confirmed'.
        Only attendees who have joined can confirm.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check plan status
        if plan.status == 'cancelled':
            return Response({
                'status': 'error',
                'message': 'Cannot confirm attendance for a cancelled plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if plan.status == 'completed':
            return Response({
                'status': 'error',
                'message': 'Cannot confirm attendance for a completed plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is an attendee
        try:
            attendee = PlanAttendee.objects.get(
                plan=plan,
                user=user_profile
            )
        except PlanAttendee.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'You must join the plan before confirming attendance'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check current status
        if attendee.status == 'declined':
            return Response({
                'status': 'error',
                'message': 'You have left this plan. Join again before confirming.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if attendee.status == 'confirmed':
            return Response({
                'status': 'error',
                'message': 'You have already confirmed attendance'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Confirm attendance
        attendee.status = 'confirmed'
        attendee.confirmed_at = timezone.now()
        attendee.save()
        
        serializer = PlanAttendeeSerializer(attendee)
        
        return Response({
            'status': 'success',
            'message': 'Attendance confirmed',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
