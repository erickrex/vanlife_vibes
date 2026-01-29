from rest_framework import status, viewsets
from rest_framework.decorators import action, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db.models import Q
from core.throttles import LoginRateThrottle
from core.models import (
    UserAccount, Group, GroupMembership, Session, Taxonomy, Term,
    Candidate, CandidateTerm, Swipe, Match, MatchMessage,
    Question, AnswerOption, UserAnswer
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
    UserAnswerCreateSerializer
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
