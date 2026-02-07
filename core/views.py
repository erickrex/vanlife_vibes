from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db import transaction, IntegrityError
from django.db.models import Q
from core.throttles import LoginRateThrottle
from core.services.feed_filters import FeedFilterService
from core.services.relevance import RelevanceScorer
from core.models import (
    UserAccount, Group, GroupMembership, Session, Taxonomy, Term,
    Candidate, CandidateTerm, Swipe, Match, MatchMessage,
    Question, AnswerOption, UserAnswer,
    Profile, Region, Country, Follow, HobbyTag, Vehicle, VehiclePhoto,
    InTownWindow, City, Prompt, ProfilePrompt, PersonSwipe, PersonMatch, DirectMessage,
    UserReport, Plan, PlanAttendee, PlanMessage,
    Activity, ActivitySwipe, ActivityMatch, ActivityMessage,
    FriendRequest, Friendship, FriendMessage
)
from core.serializers import (
    UserAccountSerializer,
    UserRegistrationSerializer,
    UserLoginSerializer,
    GroupSerializer,
    GroupDetailSerializer,
    GroupMembershipSerializer,
    InviteUserSerializer,
    MembershipActionSerializer,
    SessionSerializer,
    SessionCreateSerializer,
    SessionUpdateSerializer,
    TaxonomySerializer,
    TaxonomyDetailSerializer,
    TermSerializer,
    CandidateSerializer,
    CandidateCreateSerializer,
    CandidateUpdateSerializer,
    SwipeSerializer,
    SwipeSummarySerializer,
    MatchSerializer,
    MatchMessageSerializer,
    QuestionSerializer,
    UserAnswerSerializer,
    UserAnswerCreateSerializer,
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
    RegionSerializer,
    InTownWindowSerializer,
    CitySerializer,
    ProfilePromptSerializer,
    AvailablePromptSerializer,
    PromptListSerializer,
    DirectMessageCreateSerializer,
    DirectMessageSerializer,
    PersonMatchSerializer,
    ActivitySerializer,
    ActivityCreateSerializer,
    ActivitySwipeSerializer,
    ActivityMatchSerializer,
    ActivityMessageSerializer,
    FriendRequestSerializer,
    FriendshipSerializer,
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
    
    @action(detail=False, methods=['get'], url_path='me', permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        Get current user profile
        GET /api/v1/auth/me
        """
        serializer = UserAccountSerializer(request.user)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)



class GroupViewSet(viewsets.ModelViewSet):
    """ViewSet for group CRUD operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = GroupSerializer
    
    def get_queryset(self):
        """Return groups where user is a confirmed member"""
        return Group.objects.filter(
            memberships__user=self.request.user,
            memberships__status='confirmed',
            memberships__is_confirmed=True
        ).distinct()
    
    def get_serializer_class(self):
        """Use detailed serializer for retrieve action"""
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer
    
    def create(self, request):
        """
        Create a new group
        POST /api/v1/groups
        """
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            group = serializer.save()
            
            return Response({
                'status': 'success',
                'data': GroupDetailSerializer(group).data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'status': 'error',
            'message': 'Group creation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def retrieve(self, request, pk=None):
        """
        Get group details
        GET /api/v1/groups/:id
        """
        try:
            group = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(group)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def list(self, request):
        """
        List user's groups
        GET /api/v1/groups
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get', 'post'], url_path='members')
    def members(self, request, pk=None):
        """
        List group members (GET) or invite user to group (POST)
        GET /api/v1/groups/:id/members
        POST /api/v1/groups/:id/members
        """
        if request.method == 'GET':
            # List members
            try:
                group = self.get_queryset().get(pk=pk)
                memberships = group.memberships.all()
                serializer = GroupMembershipSerializer(memberships, many=True)
                
                return Response({
                    'status': 'success',
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
            except Group.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'Group not found or access denied'
                }, status=status.HTTP_404_NOT_FOUND)
        
        # POST - Invite member
        try:
            group = self.get_queryset().get(pk=pk)
            
            # Check if user is admin
            membership = group.memberships.get(user=request.user, status='confirmed', is_confirmed=True)
            if membership.role != 'admin':
                return Response({
                    'status': 'error',
                    'message': 'Only admins can invite members'
                }, status=status.HTTP_403_FORBIDDEN)
            
            serializer = InviteUserSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid invitation data',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find the user to invite
            user_to_invite = None
            if serializer.validated_data.get('user_id'):
                try:
                    user_to_invite = UserAccount.objects.get(id=serializer.validated_data['user_id'])
                except UserAccount.DoesNotExist:
                    pass
            elif serializer.validated_data.get('username'):
                try:
                    user_to_invite = UserAccount.objects.get(username=serializer.validated_data['username'])
                except UserAccount.DoesNotExist:
                    pass
            elif serializer.validated_data.get('email'):
                try:
                    user_to_invite = UserAccount.objects.get(email=serializer.validated_data['email'])
                except UserAccount.DoesNotExist:
                    pass
            
            if not user_to_invite:
                return Response({
                    'status': 'error',
                    'message': 'User not found. Please ensure the user is registered.'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if user is already a member
            existing_membership = GroupMembership.objects.filter(
                group=group,
                user=user_to_invite
            ).first()
            
            if existing_membership:
                if existing_membership.is_confirmed:
                    return Response({
                        'status': 'error',
                        'message': 'User is already a member of this group'
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({
                        'status': 'error',
                        'message': 'User already has a pending invitation'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create invitation
            new_membership = GroupMembership.objects.create(
                group=group,
                user=user_to_invite,
                role=serializer.validated_data.get('role', 'member'),
                membership_type='invitation',
                status='pending',
                is_confirmed=False
            )
            
            membership_serializer = GroupMembershipSerializer(new_membership)
            
            return Response({
                'status': 'success',
                'data': membership_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
        except GroupMembership.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'You are not a member of this group'
            }, status=status.HTTP_403_FORBIDDEN)
    
    @action(detail=True, methods=['patch', 'delete'], url_path='members/(?P<user_id>[^/.]+)')
    def manage_member(self, request, pk=None, user_id=None):
        """
        Manage group membership
        PATCH /api/v1/groups/:id/members/:userId - Accept or decline invitation
        DELETE /api/v1/groups/:id/members/:userId - Remove member from group
        """
        try:
            group = Group.objects.get(pk=pk)
            
            # Get the membership
            membership = GroupMembership.objects.filter(
                group=group,
                user__id=user_id
            ).first()
            
            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'Membership not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            if request.method == 'PATCH':
                # Accept or decline invitation
                serializer = MembershipActionSerializer(data=request.data)
                if not serializer.is_valid():
                    return Response({
                        'status': 'error',
                        'message': 'Invalid action',
                        'errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                action_type = serializer.validated_data['action']
                
                # Only the invited user can accept/decline their own invitation
                if str(request.user.id) != str(user_id):
                    return Response({
                        'status': 'error',
                        'message': 'You can only manage your own invitations'
                    }, status=status.HTTP_403_FORBIDDEN)
                
                if membership.is_confirmed:
                    return Response({
                        'status': 'error',
                        'message': 'Invitation already accepted'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if action_type == 'accept':
                    # Accept invitation
                    membership.is_confirmed = True
                    membership.confirmed_at = timezone.now()
                    membership.save()
                    
                    membership_serializer = GroupMembershipSerializer(membership)
                    
                    return Response({
                        'status': 'success',
                        'data': membership_serializer.data
                    }, status=status.HTTP_200_OK)
                
                elif action_type == 'decline':
                    # Decline invitation - delete membership
                    membership.delete()
                    
                    return Response({
                        'status': 'success',
                        'message': 'Invitation declined'
                    }, status=status.HTTP_200_OK)
            
            elif request.method == 'DELETE':
                # Remove member from group
                # Check if requester is a confirmed member
                try:
                    requester_membership = group.memberships.get(user=request.user, status='confirmed', is_confirmed=True)
                except GroupMembership.DoesNotExist:
                    return Response({
                        'status': 'error',
                        'message': 'You are not a member of this group'
                    }, status=status.HTTP_403_FORBIDDEN)
                
                # Check if requester is admin
                if requester_membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can remove members'
                    }, status=status.HTTP_403_FORBIDDEN)
                
                # Prevent removing the group creator if they're the last admin
                if membership.user == group.created_by:
                    admin_count = group.memberships.filter(role='admin', status='confirmed', is_confirmed=True).count()
                    if admin_count <= 1:
                        return Response({
                            'status': 'error',
                            'message': 'Cannot remove the last admin from the group'
                        }, status=status.HTTP_400_BAD_REQUEST)
                
                membership.delete()
                
                return Response({
                    'status': 'success',
                    'message': 'Member removed successfully'
                }, status=status.HTTP_200_OK)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], url_path='sessions')
    def list_sessions(self, request, pk=None):
        """
        List group sessions
        GET /api/v1/groups/:id/sessions
        """
        try:
            group = self.get_queryset().get(pk=pk)
            sessions = Session.objects.filter(group=group)
            
            from core.serializers import SessionSerializer
            serializer = SessionSerializer(sessions, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['post'], url_path='join-request')
    def join_request(self, request):
        """
        Create a join request for a group
        POST /api/v1/groups/join-request/
        
        Body:
        {
            "group_name": "string"
        }
        """
        from core.serializers import JoinRequestSerializer
        
        serializer = JoinRequestSerializer(data=request.data, context={'request': request})
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Join request failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the group from the serializer (it was validated and stored there)
        group = serializer.group
        
        # Create the join request
        membership = GroupMembership.objects.create(
            group=group,
            user=request.user,
            role='member',
            membership_type='request',
            status='pending',
            is_confirmed=False
        )
        
        membership_serializer = GroupMembershipSerializer(membership)
        
        return Response({
            'status': 'success',
            'message': 'Join request sent successfully',
            'data': membership_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='my-requests')
    def my_requests(self, request):
        """
        List current user's join requests
        GET /api/v1/groups/my-requests/
        
        Returns pending and rejected requests, sorted by status (pending first) then date
        """
        # Get all join requests for the current user
        requests = GroupMembership.objects.filter(
            user=request.user,
            membership_type='request'
        ).filter(
            Q(status='pending') | Q(status='rejected')
        ).select_related('group').order_by(
            # Sort by status (pending first), then by date descending
            '-status',  # 'pending' comes after 'rejected' alphabetically, so we reverse
            '-invited_at'
        )
        
        # Custom sort to ensure pending comes first
        pending_requests = requests.filter(status='pending').order_by('-invited_at')
        rejected_requests = requests.filter(status='rejected').order_by('-invited_at')
        
        # Combine the querysets
        all_requests = list(pending_requests) + list(rejected_requests)
        
        serializer = GroupMembershipSerializer(all_requests, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['patch'], url_path='my-requests/(?P<request_id>[^/.]+)')
    def manage_my_request(self, request, request_id=None):
        """
        Manage own join request (resend or delete)
        PATCH /api/v1/groups/my-requests/:id/
        
        Body:
        {
            "action": "resend" | "delete"
        }
        """
        try:
            # Get the membership
            membership = GroupMembership.objects.get(
                id=request_id,
                user=request.user,
                membership_type='request'
            )
            
            # Validate action
            serializer = MembershipActionSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid action',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            action = serializer.validated_data['action']
            
            if action == 'resend':
                # Can only resend rejected requests
                if membership.status != 'rejected':
                    return Response({
                        'status': 'error',
                        'message': 'Can only resend rejected requests'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update status to pending
                membership.status = 'pending'
                membership.invited_at = timezone.now()
                membership.rejected_at = None
                membership.save()
                
                membership_serializer = GroupMembershipSerializer(membership)
                
                return Response({
                    'status': 'success',
                    'message': 'Request resent',
                    'data': membership_serializer.data
                }, status=status.HTTP_200_OK)
            
            elif action == 'delete':
                # Can only delete rejected requests
                if membership.status != 'rejected':
                    return Response({
                        'status': 'error',
                        'message': 'Can only delete rejected requests'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Delete the membership
                membership.delete()
                
                return Response({
                    'status': 'success',
                    'message': 'Record deleted successfully'
                }, status=status.HTTP_200_OK)
            
            else:
                return Response({
                    'status': 'error',
                    'message': f'Invalid action: {action}. Use "resend" or "delete"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except GroupMembership.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Request not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'], url_path='my-invitations')
    def my_invitations(self, request):
        """
        List current user's invitations
        GET /api/v1/groups/my-invitations/
        
        Returns pending and rejected invitations
        """
        # Get all invitations for the current user
        invitations = GroupMembership.objects.filter(
            user=request.user,
            membership_type='invitation'
        ).filter(
            Q(status='pending') | Q(status='rejected')
        ).select_related('group').order_by(
            '-invited_at'
        )
        
        # Custom sort to ensure pending comes first
        pending_invitations = invitations.filter(status='pending').order_by('-invited_at')
        rejected_invitations = invitations.filter(status='rejected').order_by('-invited_at')
        
        # Combine the querysets
        all_invitations = list(pending_invitations) + list(rejected_invitations)
        
        serializer = GroupMembershipSerializer(all_invitations, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['patch'], url_path='my-invitations/(?P<invitation_id>[^/.]+)')
    def manage_my_invitation(self, request, invitation_id=None):
        """
        Manage received invitation (accept or reject)
        PATCH /api/v1/groups/my-invitations/:id/
        
        Body:
        {
            "action": "accept" | "reject"
        }
        """
        try:
            # Get the membership
            membership = GroupMembership.objects.get(
                id=invitation_id,
                user=request.user,
                membership_type='invitation'
            )
            
            # Validate action
            serializer = MembershipActionSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid action',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            action = serializer.validated_data['action']
            
            if action == 'accept':
                # Can only accept pending invitations
                if membership.status != 'pending':
                    return Response({
                        'status': 'error',
                        'message': 'Can only accept pending invitations'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update status to confirmed
                membership.status = 'confirmed'
                membership.is_confirmed = True
                membership.confirmed_at = timezone.now()
                membership.save()
                
                membership_serializer = GroupMembershipSerializer(membership)
                
                return Response({
                    'status': 'success',
                    'message': 'Invitation accepted',
                    'data': membership_serializer.data
                }, status=status.HTTP_200_OK)
            
            elif action == 'reject':
                # Can only reject pending invitations
                if membership.status != 'pending':
                    return Response({
                        'status': 'error',
                        'message': 'Can only reject pending invitations'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update status to rejected
                membership.status = 'rejected'
                membership.rejected_at = timezone.now()
                membership.save()
                
                membership_serializer = GroupMembershipSerializer(membership)
                
                return Response({
                    'status': 'success',
                    'message': 'Invitation declined',
                    'data': membership_serializer.data
                }, status=status.HTTP_200_OK)
            
            else:
                return Response({
                    'status': 'error',
                    'message': f'Invalid action: {action}. Use "accept" or "reject"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except GroupMembership.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Invitation not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], url_path='join-requests')
    def list_join_requests(self, request, pk=None):
        """
        List pending join requests for a group (admin only)
        GET /api/v1/groups/:id/join-requests/
        
        Returns pending join requests with count
        """
        try:
            # Get the group
            group = Group.objects.get(pk=pk)
            
            # Check if user is an admin of this group
            try:
                membership = GroupMembership.objects.get(
                    group=group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can view join requests'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get all pending join requests for this group
            join_requests = GroupMembership.objects.filter(
                group=group,
                membership_type='request',
                status='pending'
            ).select_related('user').order_by('-invited_at')
            
            serializer = GroupMembershipSerializer(join_requests, many=True)
            
            return Response({
                'status': 'success',
                'data': {
                    'results': serializer.data,
                    'count': join_requests.count()
                }
            }, status=status.HTTP_200_OK)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['patch'], url_path='join-requests/(?P<request_id>[^/.]+)')
    def manage_join_request(self, request, pk=None, request_id=None):
        """
        Manage a join request (approve or reject) - admin only
        PATCH /api/v1/groups/:id/join-requests/:requestId/
        
        Body:
        {
            "action": "approve" | "reject"
        }
        """
        try:
            # Get the group
            group = Group.objects.get(pk=pk)
            
            # Check if user is an admin of this group
            try:
                admin_membership = GroupMembership.objects.get(
                    group=group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if admin_membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can manage join requests'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get the join request
            try:
                join_request = GroupMembership.objects.get(
                    id=request_id,
                    group=group,
                    membership_type='request'
                )
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'Join request not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Validate action
            serializer = MembershipActionSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid action',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            action = serializer.validated_data['action']
            
            if action == 'approve':
                # Can only approve pending requests
                if join_request.status != 'pending':
                    return Response({
                        'status': 'error',
                        'message': 'Can only approve pending requests'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update status to confirmed
                join_request.status = 'confirmed'
                join_request.is_confirmed = True
                join_request.confirmed_at = timezone.now()
                join_request.save()
                
                membership_serializer = GroupMembershipSerializer(join_request)
                
                return Response({
                    'status': 'success',
                    'message': 'Request approved',
                    'data': membership_serializer.data
                }, status=status.HTTP_200_OK)
            
            elif action == 'reject':
                # Can only reject pending requests
                if join_request.status != 'pending':
                    return Response({
                        'status': 'error',
                        'message': 'Can only reject pending requests'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update status to rejected
                join_request.status = 'rejected'
                join_request.rejected_at = timezone.now()
                join_request.save()
                
                membership_serializer = GroupMembershipSerializer(join_request)
                
                return Response({
                    'status': 'success',
                    'message': 'Request rejected',
                    'data': membership_serializer.data
                }, status=status.HTTP_200_OK)
            
            else:
                return Response({
                    'status': 'error',
                    'message': f'Invalid action: {action}. Use "approve" or "reject"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], url_path='rejected-invitations')
    def list_rejected_invitations(self, request, pk=None):
        """
        List rejected invitations for a group (admin only)
        GET /api/v1/groups/:id/rejected-invitations/
        
        Returns rejected invitations
        """
        try:
            # Get the group
            group = Group.objects.get(pk=pk)
            
            # Check if user is an admin of this group
            try:
                membership = GroupMembership.objects.get(
                    group=group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can view rejected invitations'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get all rejected invitations for this group
            rejected_invitations = GroupMembership.objects.filter(
                group=group,
                membership_type='invitation',
                status='rejected'
            ).select_related('user').order_by('-rejected_at')
            
            serializer = GroupMembershipSerializer(rejected_invitations, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['patch'], url_path='rejected-invitations/(?P<invitation_id>[^/.]+)')
    def manage_rejected_invitation(self, request, pk=None, invitation_id=None):
        """
        Manage a rejected invitation (resend or delete) - admin only
        PATCH /api/v1/groups/:id/rejected-invitations/:id/
        
        Body:
        {
            "action": "resend" | "delete"
        }
        """
        try:
            # Get the group
            group = Group.objects.get(pk=pk)
            
            # Check if user is an admin of this group
            try:
                admin_membership = GroupMembership.objects.get(
                    group=group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if admin_membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can manage rejected invitations'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get the rejected invitation
            try:
                invitation = GroupMembership.objects.get(
                    id=invitation_id,
                    group=group,
                    membership_type='invitation'
                )
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'Invitation not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Validate action
            serializer = MembershipActionSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid action',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            action = serializer.validated_data['action']
            
            if action == 'resend':
                # Can only resend rejected invitations
                if invitation.status != 'rejected':
                    return Response({
                        'status': 'error',
                        'message': 'Can only resend rejected invitations'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update status to pending
                invitation.status = 'pending'
                invitation.invited_at = timezone.now()
                invitation.rejected_at = None
                invitation.save()
                
                membership_serializer = GroupMembershipSerializer(invitation)
                
                return Response({
                    'status': 'success',
                    'message': 'Invitation resent',
                    'data': membership_serializer.data
                }, status=status.HTTP_200_OK)
            
            elif action == 'delete':
                # Can only delete rejected invitations
                if invitation.status != 'rejected':
                    return Response({
                        'status': 'error',
                        'message': 'Can only delete rejected invitations'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Delete the invitation
                invitation.delete()
                
                return Response({
                    'status': 'success',
                    'message': 'Record deleted successfully'
                }, status=status.HTTP_200_OK)
            
            else:
                return Response({
                    'status': 'error',
                    'message': f'Invalid action: {action}. Use "resend" or "delete"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], url_path='rejected-requests')
    def list_rejected_requests(self, request, pk=None):
        """
        List rejected join requests for a group (admin only)
        GET /api/v1/groups/:id/rejected-requests/
        
        Returns rejected join requests
        """
        try:
            # Get the group
            group = Group.objects.get(pk=pk)
            
            # Check if user is an admin of this group
            try:
                membership = GroupMembership.objects.get(
                    group=group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can view rejected requests'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get all rejected join requests for this group
            rejected_requests = GroupMembership.objects.filter(
                group=group,
                membership_type='request',
                status='rejected'
            ).select_related('user').order_by('-rejected_at')
            
            serializer = GroupMembershipSerializer(rejected_requests, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['patch'], url_path='rejected-requests/(?P<request_id>[^/.]+)')
    def manage_rejected_request(self, request, pk=None, request_id=None):
        """
        Manage a rejected join request (delete only) - admin only
        PATCH /api/v1/groups/:id/rejected-requests/:id/
        
        Body:
        {
            "action": "delete"
        }
        """
        try:
            # Get the group
            group = Group.objects.get(pk=pk)
            
            # Check if user is an admin of this group
            try:
                admin_membership = GroupMembership.objects.get(
                    group=group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if admin_membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can manage rejected requests'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get the rejected request
            try:
                rejected_request = GroupMembership.objects.get(
                    id=request_id,
                    group=group,
                    membership_type='request'
                )
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'Request not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Validate action
            serializer = MembershipActionSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid action',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            action = serializer.validated_data['action']
            
            if action == 'delete':
                # Can only delete rejected requests
                if rejected_request.status != 'rejected':
                    return Response({
                        'status': 'error',
                        'message': 'Can only delete rejected requests'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Delete the request
                rejected_request.delete()
                
                return Response({
                    'status': 'success',
                    'message': 'Record deleted successfully'
                }, status=status.HTTP_200_OK)
            
            else:
                return Response({
                    'status': 'error',
                    'message': f'Invalid action: {action}. Only "delete" is allowed for rejected requests'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Group.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Group not found'
            }, status=status.HTTP_404_NOT_FOUND)



class SessionViewSet(viewsets.ModelViewSet):
    """ViewSet for session CRUD operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = SessionSerializer
    
    def get_queryset(self):
        """Return sessions where user is a confirmed member of the owning group or a shared group"""
        from core.models import SessionSharedGroup
        
        # Get sessions from groups user is a confirmed member of
        owned_sessions = Q(
            group__memberships__user=self.request.user,
            group__memberships__status='confirmed',
            group__memberships__is_confirmed=True
        )
        
        # Get sessions shared with groups user is a confirmed member of
        shared_sessions = Q(
            shared_groups__group__memberships__user=self.request.user,
            shared_groups__group__memberships__status='confirmed',
            shared_groups__group__memberships__is_confirmed=True
        )
        
        return Session.objects.filter(owned_sessions | shared_sessions).distinct()
    
    def get_serializer_class(self):
        """Use appropriate serializer based on action"""
        if self.action == 'create':
            return SessionCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return SessionUpdateSerializer
        return SessionSerializer
    
    def create(self, request):
        """
        Create a new session
        POST /api/v1/sessions
        """
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Session creation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify user is a confirmed member of the group
        group_id = serializer.validated_data['group'].id
        try:
            membership = GroupMembership.objects.get(
                group_id=group_id,
                user=request.user,
                status='confirmed', is_confirmed=True
            )
        except GroupMembership.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'You must be a confirmed member of the group to create sessions'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Create the session
        session = serializer.save()
        
        # Return with full serializer
        response_serializer = SessionSerializer(session)
        
        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    def retrieve(self, request, pk=None):
        """
        Get session details
        GET /api/v1/sessions/:id
        """
        try:
            session = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(session)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Session.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Session not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def update(self, request, pk=None):
        """
        Update session
        PATCH /api/v1/sessions/:id
        """
        try:
            session = self.get_queryset().get(pk=pk)
            
            # Check if user is admin
            try:
                membership = GroupMembership.objects.get(
                    group=session.group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can update sessions'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(session, data=request.data, partial=True)
            
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Session update failed',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer.save()
            
            # Return with full serializer
            response_serializer = SessionSerializer(session)
            
            return Response({
                'status': 'success',
                'data': response_serializer.data
            }, status=status.HTTP_200_OK)
            
        except Session.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Session not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def partial_update(self, request, pk=None):
        """
        Partial update session
        PATCH /api/v1/sessions/:id
        """
        return self.update(request, pk)
    
    def list(self, request):
        """
        List user's sessions (all sessions from groups they're in)
        GET /api/v1/sessions
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='share-group')
    def share_group(self, request, pk=None):
        """
        Share session with another group
        POST /api/v1/sessions/:id/share-group
        """
        try:
            session = self.get_queryset().get(pk=pk)
            
            # Check if user is admin of the owning group
            try:
                membership = GroupMembership.objects.get(
                    group=session.group,
                    user=request.user,
                    status='confirmed', is_confirmed=True
                )
                if membership.role != 'admin':
                    return Response({
                        'status': 'error',
                        'message': 'Only admins can share sessions'
                    }, status=status.HTTP_403_FORBIDDEN)
            except GroupMembership.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'You are not a member of this group'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get the target group ID
            target_group_id = request.data.get('group_id')
            if not target_group_id:
                return Response({
                    'status': 'error',
                    'message': 'group_id is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify target group exists
            try:
                target_group = Group.objects.get(id=target_group_id)
            except Group.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'Target group not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if already shared
            from core.models import SessionSharedGroup
            if SessionSharedGroup.objects.filter(session=session, group=target_group).exists():
                return Response({
                    'status': 'error',
                    'message': 'Session is already shared with this group'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create the share
            shared = SessionSharedGroup.objects.create(
                session=session,
                group=target_group
            )
            
            from core.serializers import SessionSharedGroupSerializer
            serializer = SessionSharedGroupSerializer(shared)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Session.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Session not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], url_path='matches')
    def list_matches(self, request, pk=None):
        """
        List matches (candidates that met approval rules) for a session
        GET /api/v1/sessions/:id/matches
        """
        try:
            session = self.get_queryset().get(pk=pk)
            
            # Get all matches for this session
            matches = Match.objects.filter(
                session=session
            ).select_related('candidate', 'session').prefetch_related('candidate__candidate_terms__term__taxonomy')
            
            serializer = MatchSerializer(matches, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Session.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Session not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get', 'post'], url_path='candidates')
    def candidates(self, request, pk=None):
        """
        List or create candidates for a session
        GET /api/v1/sessions/:id/candidates/
        POST /api/v1/sessions/:id/candidates/
        """
        try:
            session = self.get_queryset().get(pk=pk)
        except Session.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Session not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            # List candidates for this session
            candidates = Candidate.objects.filter(session=session).select_related(
                'session', 'created_by'
            ).prefetch_related('candidate_terms__term__taxonomy')
            
            # Apply tag filters
            tag_ids = request.query_params.getlist('tag')
            if tag_ids:
                for tag_id in tag_ids:
                    candidates = candidates.filter(candidate_terms__term_id=tag_id)
            
            # Apply JSONB attribute filters
            known_params = {'tag', 'page', 'page_size'}
            attribute_filters = {
                key: value 
                for key, value in request.query_params.items() 
                if key not in known_params
            }
            
            for attr_key, attr_value in attribute_filters.items():
                try:
                    attr_value = int(attr_value)
                except ValueError:
                    try:
                        attr_value = float(attr_value)
                    except ValueError:
                        if attr_value.lower() in ('true', 'false'):
                            attr_value = attr_value.lower() == 'true'
                
                candidates = candidates.filter(attributes__contains={attr_key: attr_value})
            
            # Get pagination parameters
            try:
                page = int(request.query_params.get('page', 1))
                page_size = int(request.query_params.get('page_size', 20))
                page_size = min(page_size, 100)
                if page < 1:
                    page = 1
                if page_size < 1:
                    page_size = 20
            except ValueError:
                return Response({
                    'status': 'error',
                    'message': 'Invalid page or page_size parameter'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get total count
            total_count = candidates.count()
            
            # Calculate pagination
            start_index = (page - 1) * page_size
            end_index = start_index + page_size
            
            # Get paginated items
            paginated_items = candidates[start_index:end_index]
            
            # Serialize
            serializer = CandidateSerializer(paginated_items, many=True)
            
            # Calculate pagination metadata
            total_pages = (total_count + page_size - 1) // page_size
            has_next = page < total_pages
            has_previous = page > 1
            
            return Response({
                'status': 'success',
                'data': {
                    'results': serializer.data,
                    'count': total_count,
                    'page': page,
                    'page_size': page_size,
                    'total_pages': total_pages,
                    'has_next': has_next,
                    'has_previous': has_previous
                }
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Create candidate for this session
            # Check if user is a confirmed member
            membership = GroupMembership.objects.filter(
                group=session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()
            
            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to add candidates to this session'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Add session to the data
            data = request.data.copy()
            data['session'] = str(session.id)
            
            serializer = CandidateCreateSerializer(data=data)
            
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Candidate creation failed',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            candidate = serializer.save(created_by=request.user)
            
            return Response({
                'status': 'success',
                'data': CandidateSerializer(candidate).data
            }, status=status.HTTP_201_CREATED)
    



class TaxonomyViewSet(viewsets.ModelViewSet):
    """ViewSet for taxonomy CRUD operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = TaxonomySerializer
    queryset = Taxonomy.objects.all()
    
    def get_serializer_class(self):
        """Use detailed serializer for retrieve action"""
        if self.action == 'retrieve':
            return TaxonomyDetailSerializer
        return TaxonomySerializer
    
    def list(self, request):
        """
        List all taxonomies
        GET /api/v1/taxonomies
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def create(self, request):
        """
        Create a new taxonomy
        POST /api/v1/taxonomies
        """
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Taxonomy creation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        taxonomy = serializer.save()
        
        return Response({
            'status': 'success',
            'data': TaxonomyDetailSerializer(taxonomy).data
        }, status=status.HTTP_201_CREATED)
    
    def retrieve(self, request, pk=None):
        """
        Get taxonomy details with terms
        GET /api/v1/taxonomies/:id
        """
        try:
            taxonomy = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(taxonomy)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Taxonomy.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Taxonomy not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get', 'post'], url_path='terms')
    def terms(self, request, pk=None):
        """
        List all terms in a taxonomy (GET) or add a term (POST)
        GET /api/v1/taxonomies/:id/terms
        POST /api/v1/taxonomies/:id/terms
        """
        try:
            taxonomy = self.get_queryset().get(pk=pk)
            
            if request.method == 'GET':
                # List terms
                terms = taxonomy.terms.all()
                serializer = TermSerializer(terms, many=True)
                
                return Response({
                    'status': 'success',
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
            
            elif request.method == 'POST':
                # Add a term
                # Add taxonomy to the request data
                data = request.data.copy()
                data['taxonomy'] = taxonomy.id
                
                serializer = TermSerializer(data=data)
                
                if not serializer.is_valid():
                    return Response({
                        'status': 'error',
                        'message': 'Term creation failed',
                        'errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                term = serializer.save()
                
                return Response({
                    'status': 'success',
                    'data': TermSerializer(term).data
                }, status=status.HTTP_201_CREATED)
            
        except Taxonomy.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Taxonomy not found'
            }, status=status.HTTP_404_NOT_FOUND)



class CandidateViewSet(viewsets.ModelViewSet):
    """ViewSet for candidate CRUD operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = CandidateSerializer
    queryset = Candidate.objects.all()
    
    def get_serializer_class(self):
        """Use appropriate serializer based on action"""
        if self.action == 'create':
            return CandidateCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CandidateUpdateSerializer
        return CandidateSerializer
    
    def get_queryset(self):
        """Filter candidates based on user's group membership"""
        user = self.request.user
        
        # Get all groups where user is a confirmed member
        user_groups = Group.objects.filter(
            memberships__user=user,
            memberships__status='confirmed',
            memberships__is_confirmed=True
        )
        
        # Return candidates from sessions in those groups
        return Candidate.objects.filter(
            session__group__in=user_groups
        ).select_related('session', 'created_by').prefetch_related('candidate_terms__term__taxonomy')
    
    def list(self, request):
        """
        List candidates for a session with filtering and pagination
        GET /api/v1/sessions/:session_id/candidates
        
        Query parameters:
        - session_id: Required. The session to list candidates for
        - tag: Optional. Filter by term ID (can be repeated for multiple tags)
        - page: Optional. Page number (default: 1)
        - page_size: Optional. Candidates per page (default: 20, max: 100)
        - Any JSONB attribute key: Optional. Filter by attribute value
        """
        session_id = request.query_params.get('session_id')
        
        if not session_id:
            return Response({
                'status': 'error',
                'message': 'session_id query parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify user has access to this session
        try:
            session = Session.objects.get(pk=session_id)
            
            # Check if user is a confirmed member of the session's group
            is_member = GroupMembership.objects.filter(
                group=session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).exists()
            
            if not is_member:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to access this session'
                }, status=status.HTTP_403_FORBIDDEN)
            
        except Session.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Session not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Start with candidates for this session
        candidates = self.get_queryset().filter(session_id=session_id)
        
        # Apply tag filters
        tag_ids = request.query_params.getlist('tag')
        if tag_ids:
            # Filter items that have ALL specified tags
            for tag_id in tag_ids:
                candidates = candidates.filter(candidate_terms__term_id=tag_id)
        
        # Apply JSONB attribute filters
        # Get all query params except known ones
        known_params = {'session_id', 'tag', 'page', 'page_size'}
        attribute_filters = {
            key: value 
            for key, value in request.query_params.items() 
            if key not in known_params
        }
        
        # Apply each attribute filter
        for attr_key, attr_value in attribute_filters.items():
            # Try to convert value to appropriate type
            try:
                # Try integer
                attr_value = int(attr_value)
            except ValueError:
                try:
                    # Try float
                    attr_value = float(attr_value)
                except ValueError:
                    # Try boolean
                    if attr_value.lower() in ('true', 'false'):
                        attr_value = attr_value.lower() == 'true'
                    # Otherwise keep as string
            
            # Filter using JSONB containment
            candidates = candidates.filter(attributes__contains={attr_key: attr_value})
        
        # Get pagination parameters
        try:
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 20))
            
            # Limit page_size to max 100
            page_size = min(page_size, 100)
            
            if page < 1:
                page = 1
            if page_size < 1:
                page_size = 20
                
        except ValueError:
            return Response({
                'status': 'error',
                'message': 'Invalid page or page_size parameter'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get total count
        total_count = candidates.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get paginated items
        paginated_items = candidates[start_index:end_index]
        
        # Serialize
        serializer = self.get_serializer(paginated_items, many=True)
        
        # Calculate pagination metadata
        total_pages = (total_count + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        return Response({
            'status': 'success',
            'data': {
                'results': serializer.data,
                'count': total_count,
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
                'has_next': has_next,
                'has_previous': has_previous
            }
        }, status=status.HTTP_200_OK)
    
    def create(self, request):
        """
        Add candidate to a session
        POST /api/v1/sessions/:session_id/candidates
        """
        session_id = request.data.get('session')
        
        if not session_id:
            return Response({
                'status': 'error',
                'message': 'session field is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify user has access to this session
        try:
            session = Session.objects.get(pk=session_id)
            
            # Check if user is a confirmed member of the session's group
            membership = GroupMembership.objects.filter(
                group=session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()
            
            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to add candidates to this session'
                }, status=status.HTTP_403_FORBIDDEN)
            
        except Session.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Session not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Create the candidate
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Candidate creation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        candidate = serializer.save(created_by=request.user)
        
        return Response({
            'status': 'success',
            'data': CandidateSerializer(candidate).data
        }, status=status.HTTP_201_CREATED)
    
    def retrieve(self, request, pk=None):
        """
        Get candidate details
        GET /api/v1/candidates/:id
        """
        try:
            candidate = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(candidate)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def update(self, request, pk=None):
        """
        Update candidate
        PATCH /api/v1/candidates/:id
        """
        try:
            candidate = self.get_queryset().get(pk=pk)
            
            # Check if user is a confirmed member of the session's group
            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()
            
            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to update this candidate'
                }, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(candidate, data=request.data, partial=True)
            
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Candidate update failed',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            candidate = serializer.save()
            
            return Response({
                'status': 'success',
                'data': CandidateSerializer(candidate).data
            }, status=status.HTTP_200_OK)
            
        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def partial_update(self, request, pk=None):
        """
        Partial update candidate
        PATCH /api/v1/candidates/:id
        """
        return self.update(request, pk)
    
    def destroy(self, request, pk=None):
        """
        Delete candidate
        DELETE /api/v1/candidates/:id
        
        Only group admins can delete candidates.
        """
        try:
            candidate = self.get_queryset().get(pk=pk)
            
            # Check if user is an admin of the session's group
            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed', is_confirmed=True,
                role='admin'
            ).first()
            
            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'Only group admins can delete candidates'
                }, status=status.HTTP_403_FORBIDDEN)
            
            candidate.delete()
            
            return Response({
                'status': 'success',
                'message': 'Candidate deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'], url_path='terms/(?P<term_id>[^/.]+)')
    def tag_candidate(self, request, pk=None, term_id=None):
        """
        Tag a candidate with a term
        POST /api/v1/candidates/:id/terms/:termId
        """
        try:
            candidate = self.get_queryset().get(pk=pk)
            
            # Check if user is a confirmed member of the session's group
            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()
            
            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to tag this candidate'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get the term
            try:
                term = Term.objects.get(pk=term_id)
            except Term.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'Term not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Create the tag (or get if already exists)
            item_term, created = CandidateTerm.objects.get_or_create(
                candidate=candidate,
                term=term
            )
            
            if created:
                message = 'Candidate tagged successfully'
            else:
                message = 'Candidate already has this tag'
            
            return Response({
                'status': 'success',
                'message': message,
                'data': {
                    'candidate_id': str(candidate.id),
                    'term_id': str(term.id),
                    'term_value': term.value,
                    'taxonomy_name': term.taxonomy.name
                }
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['delete'], url_path='terms/(?P<term_id>[^/.]+)')
    def untag_candidate(self, request, pk=None, term_id=None):
        """
        Remove a tag from a candidate
        DELETE /api/v1/candidates/:id/terms/:termId
        """
        try:
            candidate = self.get_queryset().get(pk=pk)
            
            # Check if user is a confirmed member of the session's group
            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()
            
            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to untag this candidate'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get the term
            try:
                term = Term.objects.get(pk=term_id)
            except Term.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': 'Term not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Delete the tag
            deleted_count, _ = CandidateTerm.objects.filter(
                candidate=candidate,
                term=term
            ).delete()
            
            if deleted_count > 0:
                message = 'Tag removed successfully'
            else:
                message = 'Candidate does not have this tag'
            
            return Response({
                'status': 'success',
                'message': message
            }, status=status.HTTP_200_OK)
            
        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)



class SwipeViewSet(viewsets.GenericViewSet):
    """ViewSet for swipe operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = SwipeSerializer

    def get_queryset(self):
        """Filter swipes based on user's group membership"""
        user = self.request.user

        # Get all groups where user is a confirmed member
        user_groups = Group.objects.filter(
            memberships__user=user,
            memberships__status='confirmed',
            memberships__is_confirmed=True
        )

        # Return swipes from candidates in sessions in those groups
        return Swipe.objects.filter(
            candidate__session__group__in=user_groups
        ).select_related('candidate', 'user')

    @action(detail=False, methods=['post'], url_path='candidates/(?P<candidate_id>[^/.]+)/swipes')
    def cast_swipe(self, request, candidate_id=None):
        """
        Cast or update a swipe on a candidate
        POST /api/v1/candidates/:id/swipes
        """
        try:
            candidate = Candidate.objects.get(pk=candidate_id)

            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()

            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to swipe on this candidate'
                }, status=status.HTTP_403_FORBIDDEN)

            if candidate.session.status == 'closed':
                return Response({
                    'status': 'error',
                    'message': 'Cannot swipe on candidates in a closed session'
                }, status=status.HTTP_400_BAD_REQUEST)

            existing_swipe = Swipe.objects.filter(
                candidate=candidate,
                user=request.user
            ).first()

            if existing_swipe:
                serializer = self.get_serializer(existing_swipe, data=request.data, partial=True)

                if not serializer.is_valid():
                    return Response({
                        'status': 'error',
                        'message': 'Swipe update failed',
                        'errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)

                swipe = serializer.save()

                return Response({
                    'status': 'success',
                    'data': SwipeSerializer(swipe).data
                }, status=status.HTTP_200_OK)

            data = request.data.copy()
            data['candidate'] = candidate.id

            serializer = self.get_serializer(data=data)

            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Swipe creation failed',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            swipe = serializer.save(user=request.user)

            return Response({
                'status': 'success',
                'data': SwipeSerializer(swipe).data
            }, status=status.HTTP_201_CREATED)

        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)


class MatchMessageViewSet(viewsets.GenericViewSet):
    """ViewSet for match-level chat messages"""
    permission_classes = [IsAuthenticated]
    serializer_class = MatchMessageSerializer

    def get_queryset(self):
        """Only include messages from groups the user is in"""
        user = self.request.user
        user_groups = Group.objects.filter(
            memberships__user=user,
            memberships__status='confirmed',
            memberships__is_confirmed=True
        )

        accessible_sessions = Session.objects.filter(
            Q(group__in=user_groups) |
            Q(shared_groups__group__in=user_groups)
        ).distinct()

        return MatchMessage.objects.filter(
            match__session__in=accessible_sessions
        ).select_related('match', 'user', 'match__candidate')

    def _has_match_access(self, match, user):
        shared_group_ids = list(match.session.shared_groups.values_list('group_id', flat=True))
        group_ids = shared_group_ids + [match.session.group_id]
        return GroupMembership.objects.filter(
            group_id__in=group_ids,
            user=user,
            status='confirmed', is_confirmed=True
        ).exists()

    def list(self, request):
        """
        List messages for a match
        GET /api/v1/match-messages?match_id=<match_id>
        """
        match_id = request.query_params.get('match_id')
        if not match_id:
            return Response({
                'status': 'error',
                'message': 'match_id query parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            match = Match.objects.select_related('session__group').prefetch_related('session__shared_groups').get(pk=match_id)
        except Match.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Match not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if not self._has_match_access(match, request.user):
            return Response({
                'status': 'error',
                'message': 'You do not have permission to view this match'
            }, status=status.HTTP_403_FORBIDDEN)

        messages = self.get_queryset().filter(match=match)
        serializer = self.get_serializer(messages, many=True)

        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def create(self, request):
        """
        Post a new message on a match
        POST /api/v1/match-messages
        """
        match_id = request.data.get('match')
        if not match_id:
            return Response({
                'status': 'error',
                'message': 'match field is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            match = Match.objects.select_related('session__group').prefetch_related('session__shared_groups').get(pk=match_id)
        except Match.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Match not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if not self._has_match_access(match, request.user):
            return Response({
                'status': 'error',
                'message': 'You do not have permission to comment on this match'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Message creation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.save(user=request.user)

        return Response({
            'status': 'success',
            'data': MatchMessageSerializer(message).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='candidates/(?P<candidate_id>[^/.]+)/swipes/me')
    def get_my_swipe(self, request, candidate_id=None):
        """
        Get current user's swipe on a candidate
        GET /api/v1/candidates/:id/swipes/me
        """
        try:
            candidate = Candidate.objects.get(pk=candidate_id)

            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()

            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to access this candidate'
                }, status=status.HTTP_403_FORBIDDEN)

            swipe = Swipe.objects.filter(
                candidate=candidate,
                user=request.user
            ).first()

            if swipe:
                serializer = self.get_serializer(swipe)
                return Response({
                    'status': 'success',
                    'data': serializer.data
                }, status=status.HTTP_200_OK)

            return Response({
                'status': 'success',
                'data': None,
                'message': 'No swipe found'
            }, status=status.HTTP_200_OK)

        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='candidates/(?P<candidate_id>[^/.]+)/swipes/summary')
    def get_swipe_summary(self, request, candidate_id=None):
        """
        Get aggregate swipe statistics for a candidate
        GET /api/v1/candidates/:id/swipes/summary
        """
        try:
            candidate = Candidate.objects.select_related('session__group').get(pk=candidate_id)

            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed',
                is_confirmed=True
            ).first()

            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to access this candidate'
                }, status=status.HTTP_403_FORBIDDEN)

            swipes = Swipe.objects.filter(candidate=candidate)

            total_swipes = swipes.count()
            likes = swipes.filter(is_like=True).count()
            dislikes = swipes.filter(is_like=False).count()
            like_ratio = likes / total_swipes if total_swipes > 0 else 0

            summary_data = {
                'total_swipes': total_swipes,
                'likes': likes,
                'dislikes': dislikes,
                'like_ratio': like_ratio
            }

            serializer = SwipeSummarySerializer(summary_data)

            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['delete'], url_path='candidates/(?P<candidate_id>[^/.]+)/swipes')
    def delete_swipe(self, request, candidate_id=None):
        """
        Delete current user's swipe on a candidate (undo functionality)
        DELETE /api/v1/candidates/:id/swipes
        """
        try:
            candidate = Candidate.objects.get(pk=candidate_id)

            membership = GroupMembership.objects.filter(
                group=candidate.session.group,
                user=request.user,
                status='confirmed', is_confirmed=True
            ).first()

            if not membership:
                return Response({
                    'status': 'error',
                    'message': 'You do not have permission to access this candidate'
                }, status=status.HTTP_403_FORBIDDEN)

            if candidate.session.status == 'closed':
                return Response({
                    'status': 'error',
                    'message': 'Cannot modify swipes in a closed session'
                }, status=status.HTTP_400_BAD_REQUEST)

            deleted_count, _ = Swipe.objects.filter(
                candidate=candidate,
                user=request.user
            ).delete()

            if deleted_count > 0:
                return Response({
                    'status': 'success',
                    'message': 'Swipe deleted successfully'
                }, status=status.HTTP_200_OK)

            return Response({
                'status': 'error',
                'message': 'No swipe found to delete'
            }, status=status.HTTP_404_NOT_FOUND)

        except Candidate.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Candidate not found'
            }, status=status.HTTP_404_NOT_FOUND)


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for question operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = QuestionSerializer
    queryset = Question.objects.all()
    
    def list(self, request):
        """
        List questions with optional scope filtering
        GET /api/v1/questions?scope=global&candidate_type=car&session_id=uuid&group_id=uuid
        """
        queryset = Question.objects.all()
        
        # Filter by scope
        scope = request.query_params.get('scope', None)
        if scope:
            queryset = queryset.filter(scope=scope)
        
        # Filter by candidate_type (for candidate_type scoped questions)
        candidate_type = request.query_params.get('candidate_type', None)
        if candidate_type:
            queryset = queryset.filter(candidate_type=candidate_type)
        
        # For session-scoped questions, we just filter by scope
        # The frontend will need to know which questions to show based on the session context
        
        # Order by created_at
        queryset = queryset.order_by('created_at')
        
        serializer = QuestionSerializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


class UserAnswerViewSet(viewsets.GenericViewSet):
    """ViewSet for user answer operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = UserAnswerSerializer
    
    @action(detail=False, methods=['post'], url_path='submit')
    def submit_answer(self, request):
        """
        Submit an answer to a question
        POST /api/v1/answers/submit
        
        Body:
        {
            "question": "uuid",
            "session": "uuid" (optional),
            "answer_option": "uuid" (optional),
            "answer_value": {} (optional)
        }
        """
        serializer = UserAnswerCreateSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        question_id = serializer.validated_data['question'].id
        session_id = serializer.validated_data.get('session')
        session_id = session_id.id if session_id else None
        
        # Check if answer already exists (update instead of create)
        existing_answer = UserAnswer.objects.filter(
            user=request.user,
            question_id=question_id,
            session_id=session_id
        ).first()
        
        if existing_answer:
            # Update existing answer
            update_serializer = UserAnswerSerializer(
                existing_answer,
                data=request.data,
                partial=True
            )
            
            if update_serializer.is_valid():
                update_serializer.save()
                
                return Response({
                    'status': 'success',
                    'data': update_serializer.data
                }, status=status.HTTP_200_OK)
            
            return Response({
                'status': 'error',
                'message': 'Invalid data',
                'errors': update_serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create new answer
        answer = UserAnswer.objects.create(
            user=request.user,
            **serializer.validated_data
        )
        
        response_serializer = UserAnswerSerializer(answer)
        
        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='my-answers')
    def my_answers(self, request):
        """
        Get current user's answers
        GET /api/v1/answers/my-answers?question=uuid&session=uuid
        """
        queryset = UserAnswer.objects.filter(user=request.user)
        
        # Filter by question
        question_id = request.query_params.get('question', None)
        if question_id:
            queryset = queryset.filter(question_id=question_id)
        
        # Filter by session
        session_id = request.query_params.get('session', None)
        if session_id:
            queryset = queryset.filter(session_id=session_id)
        
        serializer = UserAnswerSerializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)



# ============================================================================
# Profile ViewSet (Van Lifer Profiles Feature)
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
            'now_in__country',
            'next_week_in__country',
            'next_month_in__country',
        ).prefetch_related(
            'hobbies',
            'follower_set',
            'following_set',
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
        
        Response format:
        {
            "status": "success",
            "data": [
                {"id": "uuid", "name": "string", "slug": "string"},
                ...
            ]
        }
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
        
        Rules:
        - Users cannot follow themselves (returns 400 error)
        - Duplicate follows are handled gracefully (idempotent - no error, no duplicate)
        - Returns 404 if target profile doesn't exist
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
        
        # Prevent self-follows (Requirement 9.7)
        if follower_profile.id == target_profile.id:
            return Response({
                'status': 'error',
                'message': 'You cannot follow yourself'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if request.method == 'POST':
            # Follow user (Requirement 9.1)
            # Handle duplicate follows gracefully - idempotent (Requirement 9.8)
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
            # Unfollow user (Requirement 9.2)
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
        
        Returns a list of profile summaries (id, display_name, avatar_url) for
        all users who follow the specified profile.
        
        Returns 404 if the profile doesn't exist.
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
        
        # Get all followers (profiles that follow this profile)
        # Follow model: follower follows following
        # So we need profiles where they are the "follower" and target is "following"
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
        
        Returns a list of profile summaries (id, display_name, avatar_url) for
        all profiles that the specified user follows.
        
        Returns 404 if the profile doesn't exist.
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
        # Follow model: follower follows following
        # So we need profiles where target is the "follower" and they are "following"
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
        
        Request body for POST:
        {
            "city_area": "string (max 100 chars)",
            "start_date": "YYYY-MM-DD",
            "end_date": "YYYY-MM-DD"
        }
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
        
        Request body for POST:
        {
            "prompt_name": "string (prompt identifier)",
            "prompt_answer": "string (max 200 chars)",
            "display_order": integer (optional)
        }
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
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "prompt_name": "next_stop_journey",
                    "prompt_question": "Next stop on my journey is...",
                    "prompt_placeholder": "Update this with your upcoming destination or region (e.g., “the Rockies,” “Route 66,” “southern Utah”). It signals where you’ll be and invites nearby travelers to link up.",
                    "prompt_type": "travel"
                },
                ...
            ]
        }
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


class VehicleViewSet(viewsets.GenericViewSet):
    """
    ViewSet for vehicle CRUD operations.
    
    Provides endpoints for managing the current user's vehicle:
    - GET /profiles/me/vehicle/ - Get current user's vehicle
    - PUT /profiles/me/vehicle/ - Create or update vehicle
    - DELETE /profiles/me/vehicle/ - Remove vehicle
    
    The VehicleViewSet:
    1. Uses VehicleSerializer for GET responses
    2. Uses VehicleUpdateSerializer for PUT requests
    3. Requires authentication
    4. Only allows users to manage their own vehicle
    5. Automatically sets has_van=True when creating a vehicle
    6. Automatically sets has_van=False when deleting a vehicle
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
        Returns 404 if no vehicle exists.
        
        PUT /api/v1/profiles/me/vehicle/
        Creates a new vehicle or updates the existing one.
        Automatically sets has_van=True on the profile.
        
        DELETE /api/v1/profiles/me/vehicle/
        Removes the current user's vehicle.
        Automatically sets has_van=False on the profile.
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
        """
        Get the current user's vehicle.
        
        Returns 404 if no vehicle exists.
        """
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
        """
        Create a new vehicle or update the existing one.
        
        Automatically sets has_van=True on the profile.
        """
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
        """
        Delete the current user's vehicle.
        
        Automatically sets has_van=False on the profile.
        """
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
        
        Enforces max 10 photos per vehicle (Property 4: Vehicle Photo Count Limit).
        Returns 404 if no vehicle exists.
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
        Returns 404 if no vehicle exists or photo not found.
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
# Location ViewSet (Van Lifer Profiles Feature)
# ============================================================================

class LocationViewSet(viewsets.GenericViewSet):
    """
    ViewSet for location data (countries and regions).
    
    Provides endpoints for:
    - GET /locations/countries/ - List all countries
    - GET /locations/regions/ - List regions (optionally filtered by country)
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='countries')
    def countries(self, request):
        """
        List all countries.
        
        GET /api/v1/locations/countries/
        
        Returns all Country records ordered alphabetically by name.
        
        Response format:
        {
            "status": "success",
            "data": [
                {"id": "uuid", "name": "string", "code": "string"},
                ...
            ]
        }
        """
        countries = Country.objects.all().order_by('name')
        serializer = CountrySerializer(countries, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='regions')
    def regions(self, request):
        """
        List regions, optionally filtered by country.
        
        GET /api/v1/locations/regions/
        GET /api/v1/locations/regions/?country={country_id}
        
        Returns Region records ordered alphabetically by name.
        If country query parameter is provided, filters to only regions
        in that country.
        
        Query Parameters:
        - country (optional): UUID of country to filter by
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "name": "string",
                    "country": {
                        "id": "uuid",
                        "name": "string",
                        "code": "string"
                    }
                },
                ...
            ]
        }
        """
        queryset = Region.objects.select_related('country').order_by('name')
        
        # Filter by country if provided
        country_id = request.query_params.get('country')
        if country_id:
            try:
                # Validate UUID format
                import uuid
                uuid.UUID(country_id)
                queryset = queryset.filter(country_id=country_id)
            except (ValueError, TypeError):
                return Response({
                    'status': 'error',
                    'message': 'Invalid country ID format'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = RegionSerializer(queryset, many=True)
        
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
# Feed ViewSet (Van Lifer Profiles Feature)
# ============================================================================

class FeedViewSet(viewsets.GenericViewSet):
    """
    ViewSet for the nearby users feed.
    
    Provides endpoints for:
    - GET /feed/nearby/ - Get nearby users based on current user's "Now In" location
    
    The FeedViewSet:
    1. Uses FeedCardSerializer for feed card responses
    2. Requires authentication
    3. Queries profiles where now_in, next_week_in, or next_month_in matches
       the current user's now_in region
    4. Excludes the current user from results
    5. Groups results by timing category (here_now, here_next_week, here_next_month)
    6. Includes friend_status for each profile (none, request_sent, request_received, friends)
    """
    permission_classes = [IsAuthenticated]
    
    def _get_friend_status(self, user_profile, target_profile):
        """
        Compute the friend status between the current user and a target profile.
        
        Returns one of: 'none', 'request_sent', 'request_received', 'friends'.
        """
        # Check if they are friends
        # Friendship enforces user1.id < user2.id, so we need to check both orderings
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
        
        Returns profiles grouped by timing category:
        - here_now: Users whose "Now In" matches the current user's "Now In" region
        - here_next_week: Users whose "Next Week In" matches the current user's "Now In" region
        - here_next_month: Users whose "Next Month In" matches the current user's "Now In" region
        
        Rules:
        - Excludes the current user from results (Requirement 8.8)
        - Groups results by timing category (Requirement 8.10)
        
        Response format:
        {
            "status": "success",
            "data": {
                "here_now": [
                    {"id": "uuid", "display_name": "string", "avatar_url": "string|null", "timing_label": "Here Now"}
                ],
                "here_next_week": [...],
                "here_next_month": [...]
            }
        }
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if user has a "Now In" location set (either region-based or city-based)
        user_region = user_profile.now_in
        user_city = user_profile.now_in_city
        
        if not user_region and not user_city:
            return Response({
                'status': 'success',
                'data': {
                    'here_now': [],
                    'here_next_week': [],
                    'here_next_month': []
                },
                'message': 'Set your "Now In" location to see nearby travelers.'
            }, status=status.HTTP_200_OK)
        
        # Query profiles for each timing category
        # Exclude current user from all queries (Requirement 8.8)
        # Filter by looking_for_friends=True before location queries (Requirements 1.1, 1.2, 1.3)
        base_queryset = Profile.objects.exclude(id=user_profile.id).filter(looking_for_friends=True)
        
        # Apply pet-friendly filter if user requires pet-friendly matches (Requirement 2.4)
        if user_profile.pet_friendly_only:
            base_queryset = base_queryset.filter(has_pets=True)
        
        # Apply relationship status filter based on user's looking_for_friend_type (Requirements 6.3, 6.4)
        if user_profile.looking_for_friend_type == 'singles_only':
            # Only show profiles where relationship_status is 'single'
            base_queryset = base_queryset.filter(relationship_status='single')
        elif user_profile.looking_for_friend_type == 'couples_only':
            # Only show profiles where relationship_status is 'in_relationship' or 'married'
            base_queryset = base_queryset.filter(relationship_status__in=['in_relationship', 'married'])
        
        # Validate and apply query parameter filters (Requirements 7.1, 7.2, 7.3, 7.4, 7.5)
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
        
        # Build location filters - support both region-based and city-based matching
        from django.db.models import Q
        
        # Here Now: profiles whose now_in region OR now_in_city matches user's location
        here_now_q = Q()
        if user_region:
            here_now_q |= Q(now_in=user_region)
        if user_city:
            here_now_q |= Q(now_in_city__iexact=user_city)
        here_now_profiles = base_queryset.filter(here_now_q) if here_now_q else base_queryset.none()
        
        # Here Next Week: profiles whose next_week_in region OR next_week_in_city matches user's location
        here_next_week_q = Q()
        if user_region:
            here_next_week_q |= Q(next_week_in=user_region)
        if user_city:
            here_next_week_q |= Q(next_week_in_city__iexact=user_city)
        here_next_week_profiles = base_queryset.filter(here_next_week_q) if here_next_week_q else base_queryset.none()
        
        # Here Next Month: profiles whose next_month_in region OR next_month_in_city matches user's location
        here_next_month_q = Q()
        if user_region:
            here_next_month_q |= Q(next_month_in=user_region)
        if user_city:
            here_next_month_q |= Q(next_month_in_city__iexact=user_city)
        here_next_month_profiles = base_queryset.filter(here_next_month_q) if here_next_month_q else base_queryset.none()
        
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
        
        # Add friend_status to each profile (Requirement 3.7)
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
# Discovery API (Nomad Logistics Feature)
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
        - distance: Filter by distance (requires location - not implemented yet)
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
        
        # Distance filter would require geolocation - placeholder for future implementation
        # distance = request.query_params.get('distance')
        # if distance:
        #     # Implement distance-based filtering when location data is available
        #     pass
        
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
            # Property 5: Discovery Intent Filtering
            # Only show profiles where looking_for_dating is true
            queryset = queryset.filter(looking_for_dating=True)
        else:  # friends mode
            # Property 5: Discovery Intent Filtering
            # Only show profiles where looking_for_friends is true
            queryset = queryset.filter(looking_for_friends=True)
        
        # Apply additional filters (Property 6: Discovery Filter Application)
        queryset = self._apply_filters(queryset, request, user_profile)
        
        # Get user's in-town windows for overlap calculation
        user_windows = list(user_profile.in_town_windows.all())
        
        # Calculate overlap scores and sort
        profiles_with_scores = []
        for profile in queryset:
            profile_windows = list(profile.in_town_windows.all())
            overlap_score = self._calculate_overlap_score(user_windows, profile_windows)
            profiles_with_scores.append((profile, overlap_score))
        
        # Sort by overlap score (descending) - Property 8: In-Town Window Overlap Boost
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
        
        # Use PersonSwipeSerializer for validation and creation
        from core.serializers import PersonSwipeSerializer
        
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


# ============================================================================
# PersonMatch ViewSet - Match and Chat API
# ============================================================================

class PersonMatchViewSet(viewsets.GenericViewSet):
    """
    ViewSet for managing matches and chat between matched users.
    
    Provides endpoints for:
    - GET /matches/ - List user's matches
    - GET /matches/{id}/ - Get match details
    - DELETE /matches/{id}/ - Unmatch (set is_active=False)
    - GET /matches/{id}/messages/ - List messages in match
    - POST /matches/{id}/messages/ - Send a text message
    - POST /matches/{id}/messages/mini-card/ - Share a mini-card
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Return matches where the current user is either user1 or user2.
        Only returns active matches by default.
        """
        try:
            user_profile = self.request.user.profile
        except Profile.DoesNotExist:
            return PersonMatch.objects.none()
        
        return PersonMatch.objects.filter(
            Q(user1=user_profile) | Q(user2=user_profile),
            is_active=True
        ).order_by('-matched_at')
    
    def _get_user_profile(self, request):
        """Get the current user's profile"""
        try:
            return request.user.profile
        except Profile.DoesNotExist:
            return None
    
    def _get_match_or_404(self, pk, user_profile):
        """
        Get a match by ID, ensuring the user is part of the match.
        Returns (match, None) on success or (None, error_response) on failure.
        """
        try:
            match = PersonMatch.objects.get(
                Q(user1=user_profile) | Q(user2=user_profile),
                pk=pk
            )
            return match, None
        except PersonMatch.DoesNotExist:
            return None, Response({
                'status': 'error',
                'message': 'Match not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def list(self, request):
        """
        List all matches for the authenticated user.
        
        GET /matches/
        
        Returns active matches where the user is either user1 or user2,
        ordered by most recent match first.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        queryset = self.get_queryset()
        
        # Import serializer
        from core.serializers import PersonMatchSerializer
        
        serializer = PersonMatchSerializer(
            queryset, 
            many=True, 
            context={'request': request}
        )
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def retrieve(self, request, pk=None):
        """
        Get details of a specific match.
        
        GET /matches/{id}/
        
        Returns match details including both user profiles.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        # Import serializer
        from core.serializers import PersonMatchSerializer
        
        serializer = PersonMatchSerializer(match, context={'request': request})
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, pk=None):
        """
        Unmatch - deactivate a match.
        
        DELETE /matches/{id}/
        
        Sets is_active=False on the match, preventing further messages.
        Does not delete the match record.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        # Check if already inactive
        if not match.is_active:
            return Response({
                'status': 'error',
                'message': 'Match is already inactive'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Deactivate the match
        match.is_active = False
        match.save()
        
        return Response({
            'status': 'success',
            'message': 'Successfully unmatched'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        """
        List messages (GET) or send a message (POST) in a match.
        
        GET /matches/{id}/messages/
        - Returns all messages in the match, ordered by creation time
        
        POST /matches/{id}/messages/
        - Send a new text message
        - Request body: { "content": "message text" }
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        if request.method == 'GET':
            return self._list_messages(match)
        else:  # POST
            return self._send_message(request, match, user_profile)
    
    def _list_messages(self, match):
        """
        List all messages in a match.
        
        Returns messages ordered by creation time (oldest first).
        """
        from core.serializers import DirectMessageSerializer
        
        messages = DirectMessage.objects.filter(match=match).order_by('created_at')
        serializer = DirectMessageSerializer(messages, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def _send_message(self, request, match, user_profile):
        """
        Send a text message in a match.
        
        Validates:
        - Match is active
        - Content is provided and not empty
        - Content length <= 1000 characters
        
        Property 10: Chat Access Control
        Sender must be one of the two users in the match.
        
        """
        # Check if match is active
        if not match.is_active:
            return Response({
                'status': 'error',
                'message': 'Cannot send messages to an inactive match'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from core.serializers import DirectMessageCreateSerializer, DirectMessageSerializer
        
        # Validate input
        serializer = DirectMessageCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid message data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the message
        message = DirectMessage.objects.create(
            match=match,
            sender=user_profile,
            content=serializer.validated_data['content'],
            message_type=serializer.validated_data.get('message_type', 'text'),
            mini_card_data=serializer.validated_data.get('mini_card_data')
        )
        
        # Return the created message
        response_serializer = DirectMessageSerializer(message)
        
        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='messages/mini-card')
    def send_mini_card(self, request, pk=None):
        """
        Share a mini-card in a match.
        
        POST /matches/{id}/messages/mini-card/
        
        Request body:
        {
            "current_location": "Austin, TX",  // optional
            "in_town_until": "2024-02-15",     // optional, YYYY-MM-DD format
            "meet_preference": "Coffee or hike"  // optional
        }
        
        At least one of the fields must be provided.
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        # Check if match is active
        if not match.is_active:
            return Response({
                'status': 'error',
                'message': 'Cannot send messages to an inactive match'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from core.serializers import DirectMessageSerializer
        
        # Validate mini_card_data
        mini_card_data = request.data
        
        if not mini_card_data:
            return Response({
                'status': 'error',
                'message': 'Mini-card data is required',
                'errors': {
                    'mini_card_data': ['At least one of current_location, in_town_until, or meet_preference is required.']
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate using DirectMessageSerializer's validation
        temp_serializer = DirectMessageSerializer()
        try:
            validated_mini_card = temp_serializer.validate_mini_card_data(mini_card_data)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': 'Invalid mini-card data',
                'errors': {'mini_card_data': [str(e)]}
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Ensure at least one field is provided
        if not any(validated_mini_card.get(field) for field in ['current_location', 'in_town_until', 'meet_preference']):
            return Response({
                'status': 'error',
                'message': 'Invalid mini-card data',
                'errors': {
                    'mini_card_data': ['At least one of current_location, in_town_until, or meet_preference is required.']
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Build content summary for the mini-card message
        content_parts = []
        if validated_mini_card.get('current_location'):
            content_parts.append(f"📍 {validated_mini_card['current_location']}")
        if validated_mini_card.get('in_town_until'):
            content_parts.append(f"📅 Until {validated_mini_card['in_town_until']}")
        if validated_mini_card.get('meet_preference'):
            content_parts.append(f"☕ {validated_mini_card['meet_preference']}")
        
        content = " | ".join(content_parts) if content_parts else "Mini-card shared"
        
        # Create the mini-card message
        message = DirectMessage.objects.create(
            match=match,
            sender=user_profile,
            content=content,
            message_type='mini_card',
            mini_card_data=validated_mini_card
        )
        
        # Return the created message
        response_serializer = DirectMessageSerializer(message)
        
        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='report')
    def report(self, request, pk=None):
        """
        Report the other user in a match for policy violations.
        
        POST /matches/{id}/report/
        
        Request body:
        {
            "reason": "harassment|spam|inappropriate_content|fake_profile|scam|other",
            "description": "Optional description of the issue (max 500 chars)"
        }
        """
        user_profile = self._get_user_profile(request)
        if not user_profile:
            return Response({
                'status': 'error',
                'message': 'Profile not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        match, error_response = self._get_match_or_404(pk, user_profile)
        if error_response:
            return error_response
        
        # Get the other user in the match
        other_user = match.get_other_user(user_profile)
        
        from core.serializers import UserReportCreateSerializer, UserReportSerializer
        
        # Validate input
        serializer = UserReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid report data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the report
        report = UserReport.objects.create(
            reporter=user_profile,
            reported=other_user,
            reason=serializer.validated_data['reason'],
            description=serializer.validated_data.get('description', '')
        )
        
        response_serializer = UserReportSerializer(report)
        
        return Response({
            'status': 'success',
            'message': 'Report submitted successfully',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)


# ============================================================================
# Plan ViewSet - Lightweight Meetup Plans
# ============================================================================

class PlanViewSet(viewsets.ModelViewSet):
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
    """
    permission_classes = [IsAuthenticated]
    
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
        from core.serializers import (
            PlanSerializer, PlanCreateSerializer, PlanUpdateSerializer
        )
        
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
        
        from core.serializers import PlanSerializer
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
        
        from core.serializers import PlanSerializer
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
        
        from core.serializers import PlanCreateSerializer, PlanSerializer
        
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
        
        from core.serializers import PlanUpdateSerializer, PlanSerializer
        
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
        
        from core.serializers import PlanAttendeeSerializer
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
        
        from core.serializers import PlanAttendeeSerializer
        serializer = PlanAttendeeSerializer(attendee)
        
        return Response({
            'status': 'success',
            'message': 'Attendance confirmed',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        """
        List messages (GET) or send a message (POST) in a plan's group chat.
        
        GET /plans/{id}/messages/
        - Returns all messages in the plan's group chat, ordered by creation time
        - Only plan attendees (not declined) can view messages
        
        POST /plans/{id}/messages/
        - Send a new message to the plan's group chat
        - Request body: { "content": "message text" }
        - Only plan attendees (not declined) can send messages
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
        
        # Check if user is an attendee (not declined)
        attendee = PlanAttendee.objects.filter(
            plan=plan,
            user=user_profile
        ).exclude(status='declined').first()
        
        if not attendee:
            return Response({
                'status': 'error',
                'message': 'Only plan attendees can access the group chat'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if request.method == 'GET':
            return self._list_plan_messages(plan)
        else:  # POST
            return self._send_plan_message(request, plan, user_profile)
    
    def _list_plan_messages(self, plan):
        """
        List all messages in a plan's group chat.
        
        Returns messages ordered by creation time (oldest first).
        """
        from core.serializers import PlanMessageSerializer
        
        messages = PlanMessage.objects.filter(plan=plan).order_by('created_at')
        serializer = PlanMessageSerializer(messages, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def _send_plan_message(self, request, plan, user_profile):
        """
        Send a message to a plan's group chat.
        
        Validates:
        - Plan is not cancelled or completed
        - Content is provided and not empty
        - Content length <= 500 characters
        """
        # Check plan status
        if plan.status == 'cancelled':
            return Response({
                'status': 'error',
                'message': 'Cannot send messages to a cancelled plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if plan.status == 'completed':
            return Response({
                'status': 'error',
                'message': 'Cannot send messages to a completed plan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from core.serializers import PlanMessageCreateSerializer, PlanMessageSerializer
        
        # Validate input
        serializer = PlanMessageCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid message data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the message
        message = PlanMessage.objects.create(
            plan=plan,
            sender=user_profile,
            content=serializer.validated_data['content']
        )
        
        # Return the created message
        response_serializer = PlanMessageSerializer(message)
        
        return Response({
            'status': 'success',
            'data': response_serializer.data
        }, status=status.HTTP_201_CREATED)


# ============================================================================
# Activity API (Three-Tab Restructure Feature)
# ============================================================================

class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Activity CRUD operations and discovery.
    
    Provides endpoints for:
    - GET /api/v1/activities/ - List nearby open activities for swiping
    - POST /api/v1/activities/ - Create a new activity
    - GET /api/v1/activities/{id}/ - Get activity details
    
    The list action filters activities to show only:
    - status='open' (not matched or cancelled)
    - activity_date >= today (future activities only)
    - Not already swiped by the current user
    
    Results are ordered by activity_date, time_window.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ActivitySerializer
    
    def get_queryset(self):
        """
        Return activities filtered for the current user.
        
        For list action:
        - Only open activities (status='open')
        - Only future activities (activity_date >= today)
        - Exclude activities the user has already swiped on
        - Exclude activities created by the current user (can't swipe on own activity)
        
        For retrieve action:
        - Return all activities (no filtering)
        """
        from datetime import date
        
        # Get the current user's profile
        try:
            user_profile = self.request.user.profile
        except Profile.DoesNotExist:
            return Activity.objects.none()
        
        # For retrieve action, return all activities
        if self.action == 'retrieve':
            return Activity.objects.all()
        
        # For list action, apply filters
        today = date.today()
        
        # Get IDs of activities the user has already swiped on
        swiped_activity_ids = ActivitySwipe.objects.filter(
            user=user_profile
        ).values_list('activity_id', flat=True)
        
        # Filter activities:
        # - status='open' (Requirement 9.4)
        # - activity_date >= today (Requirement 9.5)
        # - Not already swiped by user (Requirement 9.6)
        # - Not created by the current user (can't swipe on own activity)
        queryset = Activity.objects.filter(
            status='open',
            activity_date__gte=today
        ).exclude(
            id__in=swiped_activity_ids
        ).exclude(
            created_by=user_profile
        ).order_by('activity_date', 'time_window')
        
        return queryset
    
    def get_serializer_class(self):
        """
        Return appropriate serializer class based on action.
        
        - create: ActivityCreateSerializer (with validation)
        - list/retrieve: ActivitySerializer (with computed fields)
        """
        if self.action == 'create':
            return ActivityCreateSerializer
        return ActivitySerializer
    
    def list(self, request):
        """
        List nearby open activities for swiping.
        
        GET /api/v1/activities/
        
        Returns activities filtered by:
        - status='open' (not matched or cancelled)
        - activity_date >= today (future activities only)
        - Not already swiped by the current user
        - Not created by the current user
        
        Ordered by activity_date, time_window.
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "title": "string",
                    "activity_type": "string",
                    "description": "string",
                    "image_url": "string|null",
                    "spots": int,
                    "spots_remaining": int,
                    "activity_date": "YYYY-MM-DD",
                    "time_window": "string",
                    "location": "string",
                    "status": "open",
                    "created_by": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "created_at": "ISO datetime"
                }
            ]
        }
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def create(self, request):
        """
        Create a new activity.
        
        POST /api/v1/activities/
        
        Request body:
        {
            "title": "string (required, max 100 chars)",
            "activity_type": "string (required, valid choice)",
            "description": "string (optional, max 500 chars)",
            "image_url": "string (optional, valid URL)",
            "spots": int (required, 1-20),
            "activity_date": "YYYY-MM-DD (required, today or future)",
            "time_window": "string (required, valid choice)",
            "location": "string (required, max 100 chars)"
        }
        
        The created_by field is automatically set to the current user's profile.
        The status field is automatically set to 'open'.
        
        Response format:
        {
            "status": "success",
            "data": { ... activity object ... }
        }
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate and create the activity
        serializer = ActivityCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            # The serializer's create method sets created_by from request context
            activity = serializer.save()
            
            # Return the created activity using the full serializer
            response_serializer = ActivitySerializer(activity)
            
            return Response({
                'status': 'success',
                'data': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'status': 'error',
            'message': 'Activity creation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def retrieve(self, request, pk=None):
        """
        Get activity details.
        
        GET /api/v1/activities/{id}/
        
        Returns the full activity object including:
        - All activity fields
        - Computed spots_remaining
        - Nested created_by profile data
        
        Response format:
        {
            "status": "success",
            "data": { ... activity object ... }
        }
        """
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Activity not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ActivitySerializer(activity)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='swipe')
    def swipe(self, request, pk=None):
        """
        Swipe on an activity (like or pass).
        
        POST /api/v1/activities/{id}/swipe/
        
        Request body:
        {
            "is_like": boolean (true = like/right swipe, false = pass/left swipe)
        }
        
        Matching Logic:
        - When the number of users who swiped right (liked) equals (spots - 1),
          an ActivityMatch is created
        - The creator automatically occupies 1 spot, so we need (spots - 1) likes
        - When match is created:
          - Activity status changes from 'open' to 'matched'
          - ActivityMatch is created with all attendees (creator + all likers)
          - Additional swipes are prevented
        
        Response format (no match):
        {
            "status": "success",
            "data": {
                "swipe": { ... swipe object ... },
                "match": null
            }
        }
        
        Response format (match created):
        {
            "status": "success",
            "data": {
                "swipe": { ... swipe object ... },
                "match": { ... match object with attendees ... }
            }
        }
        
        Error responses:
        - 404: Activity not found
        - 400: Activity is no longer accepting swipes (already matched)
        - 400: You have already swiped on this activity
        - 400: You cannot swipe on your own activity
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the activity
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Activity not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if activity is still open (Requirement 7.5)
        if activity.status != 'open':
            return Response({
                'status': 'error',
                'message': 'Activity is no longer accepting swipes'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is trying to swipe on their own activity
        if activity.created_by == user_profile:
            return Response({
                'status': 'error',
                'message': 'You cannot swipe on your own activity'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user has already swiped on this activity
        if ActivitySwipe.objects.filter(activity=activity, user=user_profile).exists():
            return Response({
                'status': 'error',
                'message': 'You have already swiped on this activity'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate the request data
        serializer = ActivitySwipeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid swipe data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        is_like = serializer.validated_data['is_like']
        
        # Use transaction to ensure atomicity of swipe + potential match creation
        with transaction.atomic():
            # Create the ActivitySwipe record
            swipe_record = ActivitySwipe.objects.create(
                activity=activity,
                user=user_profile,
                is_like=is_like
            )
            
            match_data = None
            
            # Check if match threshold is reached (only for likes)
            # Requirement 7.1: Match when likes count equals (spots - 1)
            # Creator is auto-attendee, so we need (spots - 1) additional likes
            if is_like:
                likes_count = ActivitySwipe.objects.filter(
                    activity=activity,
                    is_like=True
                ).count()
                
                # spots - 1 because creator occupies one spot
                required_likes = activity.spots - 1
                
                if likes_count >= required_likes:
                    # Create ActivityMatch (Requirement 7.2)
                    activity_match = ActivityMatch.objects.create(
                        activity=activity
                    )
                    
                    # Add attendees: creator + all likers (Requirements 7.3, 7.6)
                    # First add the creator
                    activity_match.attendees.add(activity.created_by)
                    
                    # Then add all users who liked the activity
                    likers = ActivitySwipe.objects.filter(
                        activity=activity,
                        is_like=True
                    ).values_list('user', flat=True)
                    
                    for liker_id in likers:
                        activity_match.attendees.add(liker_id)
                    
                    # Update activity status to 'matched' (Requirement 7.2)
                    activity.status = 'matched'
                    activity.save()
                    
                    # Serialize the match for response
                    match_data = ActivityMatchSerializer(activity_match).data
        
        # Serialize the swipe for response
        swipe_data = ActivitySwipeSerializer(swipe_record).data
        
        return Response({
            'status': 'success',
            'data': {
                'swipe': swipe_data,
                'match': match_data
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-activities')
    def my_activities(self, request):
        """
        List activities created by the current user.
        
        GET /api/v1/activities/my-activities/
        
        Returns all activities where created_by is the current user's profile,
        ordered by created_at descending (newest first).
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "title": "string",
                    "activity_type": "string",
                    "description": "string",
                    "image_url": "string|null",
                    "spots": int,
                    "spots_remaining": int,
                    "activity_date": "YYYY-MM-DD",
                    "time_window": "string",
                    "location": "string",
                    "status": "string",
                    "created_by": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "created_at": "ISO datetime"
                }
            ]
        }
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all activities created by the current user, ordered by created_at descending
        activities = Activity.objects.filter(
            created_by=user_profile
        ).order_by('-created_at')
        
        serializer = ActivitySerializer(activities, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='my-matches')
    def my_matches(self, request):
        """
        List activities the current user has matched on.
        
        GET /api/v1/activities/my-matches/
        
        Returns all ActivityMatch records where the current user is an attendee,
        ordered by matched_at descending (newest first).
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "activity": {
                        "id": "uuid",
                        "title": "string",
                        "activity_type": "string",
                        "description": "string",
                        "image_url": "string|null",
                        "spots": int,
                        "spots_remaining": int,
                        "activity_date": "YYYY-MM-DD",
                        "time_window": "string",
                        "location": "string",
                        "status": "matched",
                        "created_by": { ... },
                        "created_at": "ISO datetime"
                    },
                    "attendees": [
                        {
                            "id": "uuid",
                            "display_name": "string",
                            "avatar_url": "string|null"
                        }
                    ],
                    "matched_at": "ISO datetime"
                }
            ]
        }
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all ActivityMatch records where the current user is an attendee
        # ordered by matched_at descending (newest first)
        matches = ActivityMatch.objects.filter(
            attendees=user_profile
        ).order_by('-matched_at')
        
        serializer = ActivityMatchSerializer(matches, many=True)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        """
        List or send messages for a matched activity chat.
        
        GET /api/v1/activities/{id}/messages/
        POST /api/v1/activities/{id}/messages/
        
        GET: Returns all messages for the activity's chat, ordered chronologically.
        POST: Creates a new message in the activity's chat.
        
        Access Control:
        - Activity must have a match (ActivityMatch exists)
        - Current user must be an attendee of the match
        
        GET Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "sender": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "content": "string",
                    "created_at": "ISO datetime"
                }
            ]
        }
        
        POST Request body:
        {
            "content": "string (required, max 500 chars)"
        }
        
        POST Response format:
        {
            "status": "success",
            "data": { ... message object ... }
        }
        
        Error responses:
        - 404: Activity not found
        - 400: Activity has not been matched yet
        - 403: You are not an attendee of this activity
        """
        # Get the current user's profile
        try:
            user_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the activity
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Activity not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if activity has a match
        try:
            activity_match = ActivityMatch.objects.get(activity=activity)
        except ActivityMatch.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Activity has not been matched yet'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is an attendee of the match (Requirement 8.1)
        if not activity_match.attendees.filter(id=user_profile.id).exists():
            return Response({
                'status': 'error',
                'message': 'You are not an attendee of this activity'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if request.method == 'GET':
            # List messages ordered by created_at ascending (chronological) (Requirement 8.4)
            messages = ActivityMessage.objects.filter(
                activity_match=activity_match
            ).order_by('created_at')
            
            serializer = ActivityMessageSerializer(messages, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Create a new message (Requirement 8.3)
            serializer = ActivityMessageSerializer(data=request.data)
            
            if serializer.is_valid():
                # Create the message with sender set to current user's profile
                message = ActivityMessage.objects.create(
                    activity_match=activity_match,
                    sender=user_profile,
                    content=serializer.validated_data['content']
                )
                
                # Return the created message
                response_serializer = ActivityMessageSerializer(message)
                
                return Response({
                    'status': 'success',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'status': 'error',
                'message': 'Invalid message data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# Friend ViewSet (Three-Tab Restructure Feature)
# ============================================================================

class FriendViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """
    ViewSet for friend requests and friendships.
    
    Provides endpoints for:
    - GET /api/v1/friends/ - List all friendships for the current user
    - POST /api/v1/friends/request/ - Send a friend request
    - GET /api/v1/friends/requests/ - List pending friend requests
    - POST /api/v1/friends/requests/{id}/accept/ - Accept a friend request
    - POST /api/v1/friends/requests/{id}/decline/ - Decline a friend request
    - GET /api/v1/friends/{id}/messages/ - Get messages in a friendship chat
    - POST /api/v1/friends/{id}/messages/ - Send a message to a friend
    - DELETE /api/v1/friends/{id}/ - Remove a friendship
    """
    permission_classes = [IsAuthenticated]
    serializer_class = FriendshipSerializer
    
    def get_queryset(self):
        """
        Return friendships where the current user is either user1 or user2.
        Ordered by created_at descending (newest first).
        """
        try:
            profile = self.request.user.profile
        except Profile.DoesNotExist:
            return Friendship.objects.none()
        
        return Friendship.objects.filter(
            Q(user1=profile) | Q(user2=profile)
        ).order_by('-created_at')
    
    def list(self, request):
        """
        List all friendships for the current user.
        
        GET /api/v1/friends/
        
        Returns all Friendship records where the current user is either user1 or user2.
        Uses FriendshipSerializer which includes the computed 'friend' field showing
        the other user's profile data.
        
        Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "friend": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "created_at": "ISO datetime"
                },
                ...
            ]
        }
        
        Results are ordered by created_at descending (newest first).
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all friendships where the current user is either user1 or user2
        friendships = self.get_queryset()
        
        # Serialize with request context so FriendshipSerializer can compute the 'friend' field
        serializer = FriendshipSerializer(friendships, many=True, context={'request': request})
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='request')
    def request(self, request):
        """
        Send a friend request to another user.
        
        POST /api/v1/friends/request/
        
        Request body:
        {
            "to_user_id": "uuid (required) - UUID of the user to send request to"
        }
        
        Validations:
        - Cannot send request to yourself
        - No existing pending request between the users
        - Not already friends with the target user
        - Target user must exist
        
        Response format:
        {
            "status": "success",
            "data": {
                "id": "uuid",
                "from_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "to_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "status": "pending",
                "created_at": "ISO datetime",
                "responded_at": null
            }
        }
        
        Error responses:
        - 400: You cannot send a friend request to yourself
        - 400: Friend request already pending
        - 400: You are already friends with this user
        - 404: User not found
        """
        # Get the current user's profile
        try:
            from_profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Sender must have looking_for_friends enabled
        if not from_profile.looking_for_friends:
            return Response({
                'status': 'error',
                'message': 'You must enable friend discovery to send friend requests'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate to_user_id is provided
        to_user_id = request.data.get('to_user_id')
        if not to_user_id:
            return Response({
                'status': 'error',
                'message': 'to_user_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the target user's profile
        try:
            to_profile = Profile.objects.get(id=to_user_id)
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Target must have looking_for_friends enabled
        if not to_profile.looking_for_friends:
            return Response({
                'status': 'error',
                'message': 'This user is not accepting friend requests'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate: Cannot send request to yourself
        if from_profile.id == to_profile.id:
            return Response({
                'status': 'error',
                'message': 'You cannot send a friend request to yourself'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate: No existing pending request (in either direction)
        existing_pending = FriendRequest.objects.filter(
            Q(from_user=from_profile, to_user=to_profile, status='pending') |
            Q(from_user=to_profile, to_user=from_profile, status='pending')
        ).exists()

        if existing_pending:
            return Response({
                'status': 'error',
                'message': 'Friend request already pending'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate: Not already friends
        # Friendship model enforces user1.id < user2.id, so we need to check both orderings
        # by querying with Q objects
        user1_id, user2_id = sorted([from_profile.id, to_profile.id])
        already_friends = Friendship.objects.filter(
            user1_id=user1_id,
            user2_id=user2_id
        ).exists()
        
        if already_friends:
            return Response({
                'status': 'error',
                'message': 'You are already friends with this user'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # If a prior request from this user exists (declined/accepted), reuse it
        existing_request = FriendRequest.objects.filter(
            from_user=from_profile,
            to_user=to_profile
        ).first()
        if existing_request:
            existing_request.status = 'pending'
            existing_request.responded_at = None
            existing_request.save(update_fields=['status', 'responded_at'])
            friend_request = existing_request
        else:
            # Create the friend request with status='pending'
            friend_request = FriendRequest.objects.create(
                from_user=from_profile,
                to_user=to_profile,
                status='pending'
            )
        
        # Serialize and return the created request
        serializer = FriendRequestSerializer(friend_request)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK if existing_request else status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='requests')
    def requests(self, request):
        """
        List pending friend requests (sent and received).
        
        GET /api/v1/friends/requests/
        
        Returns all pending friend requests where the current user is either
        the sender or recipient, grouped into two lists.
        
        Response format:
        {
            "status": "success",
            "data": {
                "sent": [
                    {
                        "id": "uuid",
                        "from_user": { ... },
                        "to_user": { ... },
                        "status": "pending",
                        "created_at": "ISO datetime",
                        "responded_at": null
                    },
                    ...
                ],
                "received": [
                    {
                        "id": "uuid",
                        "from_user": { ... },
                        "to_user": { ... },
                        "status": "pending",
                        "created_at": "ISO datetime",
                        "responded_at": null
                    },
                    ...
                ]
            }
        }
        
        Both lists are ordered by created_at descending (newest first).
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get sent requests (from_user=current user, status='pending')
        sent_requests = FriendRequest.objects.filter(
            from_user=profile,
            status='pending'
        ).order_by('-created_at')
        
        # Get received requests (to_user=current user, status='pending')
        received_requests = FriendRequest.objects.filter(
            to_user=profile,
            status='pending'
        ).order_by('-created_at')
        
        # Serialize both lists
        sent_serializer = FriendRequestSerializer(sent_requests, many=True)
        received_serializer = FriendRequestSerializer(received_requests, many=True)
        
        return Response({
            'status': 'success',
            'data': {
                'sent': sent_serializer.data,
                'received': received_serializer.data
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='requests/(?P<request_id>[^/.]+)/accept')
    def accept(self, request, request_id=None):
        """
        Accept a friend request.
        
        POST /api/v1/friends/requests/{id}/accept/
        
        Accepts a pending friend request sent to the current user.
        Creates a Friendship record between the two users.
        
        Validations:
        - Request must exist
        - Current user must be the recipient (to_user)
        - Request must be pending (not already responded to)
        
        Response format:
        {
            "status": "success",
            "data": {
                "id": "uuid",
                "from_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "to_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "status": "accepted",
                "created_at": "ISO datetime",
                "responded_at": "ISO datetime"
            }
        }
        
        Error responses:
        - 404: Friend request not found
        - 403: You can only accept requests sent to you
        - 400: This request has already been responded to
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the friend request by ID
        try:
            friend_request = FriendRequest.objects.get(pk=request_id)
        except FriendRequest.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Friend request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Current user must be the recipient (to_user)
        if friend_request.to_user != profile:
            return Response({
                'status': 'error',
                'message': 'You can only accept requests sent to you'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Validate: Request must be pending
        if friend_request.status != 'pending':
            return Response({
                'status': 'error',
                'message': 'This request has already been responded to'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update request status to 'accepted' and set responded_at
        friend_request.status = 'accepted'
        friend_request.responded_at = timezone.now()
        friend_request.save()
        
        # Create Friendship record between the two users
        # The Friendship model's save() method automatically handles user1 < user2 ordering
        Friendship.objects.create(
            user1=friend_request.from_user,
            user2=friend_request.to_user
        )
        
        # Return the updated request
        serializer = FriendRequestSerializer(friend_request)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='requests/(?P<request_id>[^/.]+)/decline')
    def decline(self, request, request_id=None):
        """
        Decline a friend request.
        
        POST /api/v1/friends/requests/{id}/decline/
        
        Declines a pending friend request sent to the current user.
        Does NOT create a Friendship record.
        
        Validations:
        - Request must exist
        - Current user must be the recipient (to_user)
        - Request must be pending (not already responded to)
        
        Response format:
        {
            "status": "success",
            "data": {
                "id": "uuid",
                "from_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "to_user": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "status": "declined",
                "created_at": "ISO datetime",
                "responded_at": "ISO datetime"
            }
        }
        
        Error responses:
        - 404: Friend request not found
        - 403: You can only decline requests sent to you
        - 400: This request has already been responded to
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the friend request by ID
        try:
            friend_request = FriendRequest.objects.get(pk=request_id)
        except FriendRequest.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Friend request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Current user must be the recipient (to_user)
        if friend_request.to_user != profile:
            return Response({
                'status': 'error',
                'message': 'You can only decline requests sent to you'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Validate: Request must be pending
        if friend_request.status != 'pending':
            return Response({
                'status': 'error',
                'message': 'This request has already been responded to'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update request status to 'declined' and set responded_at
        friend_request.status = 'declined'
        friend_request.responded_at = timezone.now()
        friend_request.save()
        
        # Return the updated request (no Friendship created for decline)
        serializer = FriendRequestSerializer(friend_request)
        
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """
        Remove a friendship.
        
        DELETE /api/v1/friends/{id}/
        
        Deletes a friendship between the current user and another user.
        Only users who are part of the friendship can delete it.
        This also deletes all associated FriendMessage records (via CASCADE).
        
        Validations:
        - Friendship must exist
        - Current user must be either user1 or user2 in the friendship
        
        Response format:
        {
            "status": "success",
            "message": "Friendship removed successfully"
        }
        
        Error responses:
        - 404: Friendship not found
        - 403: You are not part of this friendship
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the friendship by ID
        try:
            friendship = Friendship.objects.get(pk=pk)
        except Friendship.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Friendship not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Current user must be part of the friendship (either user1 or user2)
        if friendship.user1 != profile and friendship.user2 != profile:
            return Response({
                'status': 'error',
                'message': 'You are not part of this friendship'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Delete the friendship (FriendMessages will be deleted via CASCADE)
        friendship.delete()
        
        return Response({
            'status': 'success',
            'message': 'Friendship removed successfully'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        """
        Get or send messages in a friendship chat.
        
        GET /api/v1/friends/{id}/messages/
        POST /api/v1/friends/{id}/messages/
        
        GET: Returns all messages in the friendship chat, ordered chronologically.
        POST: Sends a new message to the friend.
        
        Validations:
        - Friendship must exist
        - Current user must be part of the friendship (either user1 or user2)
        
        GET Response format:
        {
            "status": "success",
            "data": [
                {
                    "id": "uuid",
                    "sender": {
                        "id": "uuid",
                        "display_name": "string",
                        "avatar_url": "string|null"
                    },
                    "content": "string",
                    "created_at": "ISO datetime",
                    "is_read": boolean
                },
                ...
            ]
        }
        
        POST Request body:
        {
            "content": "string (required) - Message content, max 1000 chars"
        }
        
        POST Response format:
        {
            "status": "success",
            "data": {
                "id": "uuid",
                "sender": {
                    "id": "uuid",
                    "display_name": "string",
                    "avatar_url": "string|null"
                },
                "content": "string",
                "created_at": "ISO datetime",
                "is_read": false
            }
        }
        
        Error responses:
        - 404: Friendship not found
        - 403: You must be friends to send messages
        - 400: Content is required (POST only)
        """
        # Get the current user's profile
        try:
            profile = request.user.profile
        except Profile.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get the friendship by ID
        try:
            friendship = Friendship.objects.get(pk=pk)
        except Friendship.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Friendship not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate: Current user must be part of the friendship (either user1 or user2)
        if friendship.user1 != profile and friendship.user2 != profile:
            return Response({
                'status': 'error',
                'message': 'You must be friends to send messages'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if request.method == 'GET':
            # Get all messages for this friendship, ordered chronologically
            messages = FriendMessage.objects.filter(
                friendship=friendship
            ).order_by('created_at')
            
            from core.serializers import FriendMessageSerializer
            serializer = FriendMessageSerializer(messages, many=True)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Validate content is provided
            content = request.data.get('content')
            if not content:
                return Response({
                    'status': 'error',
                    'message': 'Content is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate content length (max 1000 chars per FriendMessage model)
            if len(content) > 1000:
                return Response({
                    'status': 'error',
                    'message': 'Content must be 1000 characters or less'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create the message
            message = FriendMessage.objects.create(
                friendship=friendship,
                sender=profile,
                content=content
            )
            
            from core.serializers import FriendMessageSerializer
            serializer = FriendMessageSerializer(message)
            
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
