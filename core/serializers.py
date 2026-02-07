from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models, transaction, IntegrityError
from django.utils import timezone
from core.models import (
    UserAccount, Group, GroupMembership, Session, SessionSharedGroup,
    Taxonomy, Term, Candidate, CandidateTerm,
    Swipe, Match, MatchMessage, Question, AnswerOption, UserAnswer,
    Profile, Vehicle, VehiclePhoto, Follow, HobbyTag, Country, Region,
    InTownWindow, City, Prompt, ProfilePrompt, PersonSwipe, PersonMatch, DirectMessage,
    UserReport, Plan, PlanAttendee, PlanMessage,
    Activity, ActivitySwipe, ActivityMatch, ActivityMessage,
    FriendRequest, Friendship, FriendMessage
)


class UserAccountSerializer(serializers.ModelSerializer):
    """Serializer for UserAccount model"""
    
    class Meta:
        model = UserAccount
        fields = ['id', 'username', 'email', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration with password validation"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = UserAccount
        fields = ['username', 'email', 'password', 'password_confirm']
    
    def validate_email(self, value):
        """Validate email uniqueness"""
        if UserAccount.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        """Validate username uniqueness"""
        if UserAccount.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def validate(self, attrs):
        """Validate password complexity and matching"""
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')
        
        # Check if passwords match
        if password != password_confirm:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        
        # Validate password complexity using Django's validators
        try:
            validate_password(password)
        except DjangoValidationError as e:
            raise serializers.ValidationError({
                'password': list(e.messages)
            })
        
        return attrs
    
    def create(self, validated_data):
        """Create user with hashed password"""
        # Remove password_confirm as it's not needed for user creation
        validated_data.pop('password_confirm')
        
        # Create user with hashed password
        user = UserAccount.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        
        return user


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    username = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )



class ProfileCardDataSerializer(serializers.ModelSerializer):
    """
    Compact profile serializer for displaying profile cards in lists.
    
    Includes only the essential fields needed for ProfileCard display:
    id, display_name, avatar_url, has_van, vehicle, travel_status.
    """
    vehicle = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url', 'has_van', 'vehicle', 'travel_status']
        read_only_fields = ['id', 'display_name', 'avatar_url', 'has_van', 'vehicle', 'travel_status']
    
    def get_vehicle(self, obj):
        """Return vehicle type info if user has a van"""
        if not obj.has_van:
            return None
        try:
            vehicle = obj.vehicle
            return {
                'vehicle_type': vehicle.vehicle_type
            }
        except Vehicle.DoesNotExist:
            return None


class GroupMembershipSerializer(serializers.ModelSerializer):
    """Serializer for GroupMembership model"""
    user = UserAccountSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True, required=False)
    group_name = serializers.CharField(source='group.name', read_only=True)
    profile = serializers.SerializerMethodField()
    
    class Meta:
        model = GroupMembership
        fields = [
            'id', 'group', 'group_name', 'user', 'user_id', 'role', 
            'membership_type', 'status', 'is_confirmed', 
            'invited_at', 'confirmed_at', 'rejected_at', 'profile'
        ]
        read_only_fields = ['id', 'invited_at', 'confirmed_at', 'rejected_at', 'profile']
    
    def get_profile(self, obj):
        """Return profile card data for the member"""
        try:
            profile = obj.user.profile
            return ProfileCardDataSerializer(profile).data
        except Profile.DoesNotExist:
            return None


class GroupSerializer(serializers.ModelSerializer):
    """Serializer for Group model"""
    created_by = UserAccountSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    session_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'created_by', 'created_at', 'member_count', 'session_count']
        read_only_fields = ['id', 'created_by', 'created_at']
    
    def get_member_count(self, obj):
        """Get count of confirmed members"""
        return obj.memberships.filter(is_confirmed=True).count()

    def get_session_count(self, obj):
        """Get count of sessions in the group"""
        return obj.sessions.count()
    
    def create(self, validated_data):
        """Create group and add creator as confirmed admin member"""
        user = self.context['request'].user
        
        # Create the group
        group = Group.objects.create(
            created_by=user,
            **validated_data
        )
        
        # Add creator as confirmed admin member with proper fields
        GroupMembership.objects.create(
            group=group,
            user=user,
            role='admin',
            membership_type='invitation',  # Creator is treated as auto-accepted invitation
            status='confirmed',
            is_confirmed=True,
            confirmed_at=timezone.now()
        )
        
        return group


class GroupDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Group with members"""
    created_by = UserAccountSerializer(read_only=True)
    members = GroupMembershipSerializer(source='memberships', many=True, read_only=True)
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'created_by', 'created_at', 'members']
        read_only_fields = ['id', 'created_by', 'created_at']


class InviteUserSerializer(serializers.Serializer):
    """Serializer for inviting a user to a group"""
    user_id = serializers.UUIDField(required=False)
    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    role = serializers.ChoiceField(
        choices=['admin', 'member'],
        default='member'
    )
    
    def validate(self, attrs):
        """Validate that at least one identifier is provided"""
        if not any([attrs.get('user_id'), attrs.get('username'), attrs.get('email')]):
            raise serializers.ValidationError(
                "At least one of user_id, username, or email must be provided"
            )
        return attrs


class JoinRequestSerializer(serializers.Serializer):
    """Serializer for creating join requests"""
    group_name = serializers.CharField(required=True)
    
    def validate_group_name(self, value):
        """Validate group exists, user not member, no pending request"""
        # Get the user from context
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("User must be authenticated")
        
        user = request.user
        
        # Check if group exists
        try:
            group = Group.objects.get(name=value)
        except Group.DoesNotExist:
            raise serializers.ValidationError("Group not found")
        
        # Check if user is already a confirmed member
        if GroupMembership.objects.filter(
            group=group,
            user=user,
            status='confirmed'
        ).exists():
            raise serializers.ValidationError("You are already a member of this group")
        
        # Check if user has a pending request
        if GroupMembership.objects.filter(
            group=group,
            user=user,
            membership_type='request',
            status='pending'
        ).exists():
            raise serializers.ValidationError("You already have a pending request for this group")
        
        # Store the group in the serializer for later use
        self.group = group
        return value


class MembershipActionSerializer(serializers.Serializer):
    """Serializer for membership actions (accept, reject, approve, decline, resend, delete)"""
    action = serializers.ChoiceField(
        choices=['accept', 'reject', 'approve', 'decline', 'resend', 'delete'],
        required=True
    )

class SessionSerializer(serializers.ModelSerializer):
    """Serializer for Session model with rule validation"""
    group_name = serializers.CharField(source='group.name', read_only=True)
    
    class Meta:
        model = Session
        fields = [
            'id', 'group', 'group_name', 'title', 'description', 
            'candidate_type', 'rules', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_rules(self, value):
        """Validate rules JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Rules must be a JSON object")
        
        rule_type = value.get('type')
        if rule_type not in ['unanimous', 'threshold']:
            raise serializers.ValidationError(
                "Rule type must be 'unanimous' or 'threshold'"
            )
        
        if rule_type == 'threshold':
            threshold_value = value.get('value')
            if threshold_value is None:
                raise serializers.ValidationError(
                    "Threshold rules must include a 'value' field"
                )
            if not isinstance(threshold_value, (int, float)):
                raise serializers.ValidationError(
                    "Threshold value must be a number"
                )
            if not (0 <= threshold_value <= 1):
                raise serializers.ValidationError(
                    "Threshold value must be between 0 and 1"
                )
        
        return value
    
    def validate_status(self, value):
        """Validate status transitions"""
        if self.instance:
            # This is an update
            if not self.instance.can_transition_to(value):
                valid_transitions = Session.VALID_TRANSITIONS.get(self.instance.status, [])
                raise serializers.ValidationError(
                    f"Cannot transition from '{self.instance.status}' to '{value}'. "
                    f"Valid transitions: {', '.join(valid_transitions) if valid_transitions else 'none'}"
                )
        return value


class SessionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating sessions"""
    
    class Meta:
        model = Session
        fields = [
            'group', 'title', 'description', 
            'candidate_type', 'rules', 'status'
        ]
    
    def validate_rules(self, value):
        """Validate rules JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Rules must be a JSON object")
        
        rule_type = value.get('type')
        if rule_type not in ['unanimous', 'threshold']:
            raise serializers.ValidationError(
                "Rule type must be 'unanimous' or 'threshold'"
            )
        
        if rule_type == 'threshold':
            threshold_value = value.get('value')
            if threshold_value is None:
                raise serializers.ValidationError(
                    "Threshold rules must include a 'value' field"
                )
            if not isinstance(threshold_value, (int, float)):
                raise serializers.ValidationError(
                    "Threshold value must be a number"
                )
            if not (0 <= threshold_value <= 1):
                raise serializers.ValidationError(
                    "Threshold value must be between 0 and 1"
                )
        
        return value


class SessionUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating sessions"""
    
    class Meta:
        model = Session
        fields = ['title', 'description', 'rules', 'status']
    
    def validate_rules(self, value):
        """Validate rules JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Rules must be a JSON object")
        
        rule_type = value.get('type')
        if rule_type not in ['unanimous', 'threshold']:
            raise serializers.ValidationError(
                "Rule type must be 'unanimous' or 'threshold'"
            )
        
        if rule_type == 'threshold':
            threshold_value = value.get('value')
            if threshold_value is None:
                raise serializers.ValidationError(
                    "Threshold rules must include a 'value' field"
                )
            if not isinstance(threshold_value, (int, float)):
                raise serializers.ValidationError(
                    "Threshold value must be a number"
                )
            if not (0 <= threshold_value <= 1):
                raise serializers.ValidationError(
                    "Threshold value must be between 0 and 1"
                )
        
        return value
    
    def validate_status(self, value):
        """Validate status transitions"""
        if self.instance and value != self.instance.status:
            if not self.instance.can_transition_to(value):
                valid_transitions = Session.VALID_TRANSITIONS.get(self.instance.status, [])
                raise serializers.ValidationError(
                    f"Cannot transition from '{self.instance.status}' to '{value}'. "
                    f"Valid transitions: {', '.join(valid_transitions) if valid_transitions else 'none'}"
                )
        return value


class SessionSharedGroupSerializer(serializers.ModelSerializer):
    """Serializer for SessionSharedGroup model"""
    group_name = serializers.CharField(source='group.name', read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)
    
    class Meta:
        model = SessionSharedGroup
        fields = ['id', 'session', 'session_title', 'group', 'group_name', 'shared_at']
        read_only_fields = ['id', 'shared_at']



class TermSerializer(serializers.ModelSerializer):
    """Serializer for Term model"""
    taxonomy_name = serializers.CharField(source='taxonomy.name', read_only=True)
    
    class Meta:
        model = Term
        fields = ['id', 'taxonomy', 'taxonomy_name', 'value', 'attributes']
        read_only_fields = ['id']
    
    def validate_attributes(self, value):
        """Validate attributes is a valid JSON object if provided"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("Attributes must be a JSON object")
        return value


class TaxonomySerializer(serializers.ModelSerializer):
    """Serializer for Taxonomy model"""
    term_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Taxonomy
        fields = ['id', 'name', 'description', 'term_count']
        read_only_fields = ['id']
    
    def get_term_count(self, obj):
        """Get count of terms in this taxonomy"""
        return obj.terms.count()
    
    def validate_name(self, value):
        """Validate taxonomy name uniqueness"""
        # Check if this is an update
        if self.instance:
            # Exclude current instance from uniqueness check
            if Taxonomy.objects.filter(name=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("A taxonomy with this name already exists.")
        else:
            # For new taxonomies, check if name exists
            if Taxonomy.objects.filter(name=value).exists():
                raise serializers.ValidationError("A taxonomy with this name already exists.")
        return value


class TaxonomyDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Taxonomy with terms"""
    terms = TermSerializer(many=True, read_only=True)
    
    class Meta:
        model = Taxonomy
        fields = ['id', 'name', 'description', 'terms']
        read_only_fields = ['id']



class CandidateTermSerializer(serializers.ModelSerializer):
    """Serializer for CandidateTerm model"""
    term_value = serializers.CharField(source='term.value', read_only=True)
    taxonomy_name = serializers.CharField(source='term.taxonomy.name', read_only=True)
    
    class Meta:
        model = CandidateTerm
        fields = ['id', 'candidate', 'term', 'term_value', 'taxonomy_name']
        read_only_fields = ['id']


class CandidateSerializer(serializers.ModelSerializer):
    """Serializer for Candidate model with nested attribute handling"""
    tags = CandidateTermSerializer(source='candidate_terms', many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = Candidate
        fields = [
            'id', 'session', 'label', 'image_url', 'attributes', 'external_ref', 'created_by',
            'created_by_username', 'created_at', 'tags'
        ]
        read_only_fields = ['id', 'created_at', 'created_by_username']
    
    def validate_attributes(self, value):
        """Validate attributes is a valid JSON object if provided"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("Attributes must be a JSON object")
        return value
    
    def validate(self, attrs):
        """Validate uniqueness of external_ref and label per session"""
        session = attrs.get('session')
        external_ref = attrs.get('external_ref')
        label = attrs.get('label')
        
        # Check for duplicate items
        if session and label:
            query = Candidate.objects.filter(
                session=session,
                label=label
            )
            
            if external_ref:
                query = query.filter(external_ref=external_ref)
            
            # Exclude current instance if updating
            if self.instance:
                query = query.exclude(id=self.instance.id)
            
            if query.exists():
                raise serializers.ValidationError(
                    "A candidate with this label and external_ref already exists in this session"
                )
        
        return attrs


class CandidateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating candidates"""
    
    class Meta:
        model = Candidate
        fields = ['session', 'label', 'image_url', 'attributes', 'external_ref']
    
    def validate_attributes(self, value):
        """Validate attributes is a valid JSON object if provided"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("Attributes must be a JSON object")
        return value
    
    def validate(self, attrs):
        """Validate uniqueness of external_ref and label per session"""
        session = attrs.get('session')
        external_ref = attrs.get('external_ref')
        label = attrs.get('label')
        
        # Check for duplicate items
        if session and label:
            query = Candidate.objects.filter(
                session=session,
                label=label
            )
            
            if external_ref:
                query = query.filter(external_ref=external_ref)
            
            if query.exists():
                raise serializers.ValidationError(
                    "A candidate with this label and external_ref already exists in this session"
                )
        
        return attrs


class CandidateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating candidates"""
    
    class Meta:
        model = Candidate
        fields = ['label', 'image_url', 'attributes', 'external_ref']
    
    def validate_attributes(self, value):
        """Validate attributes is a valid JSON object if provided"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("Attributes must be a JSON object")
        return value



class SwipeSerializer(serializers.ModelSerializer):
    """Serializer for Swipe model with validation"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    candidate_label = serializers.CharField(source='candidate.label', read_only=True)
    
    class Meta:
        model = Swipe
        fields = [
            'id', 'candidate', 'user', 'user_username', 'candidate_label',
            'is_like', 'swiped_at'
        ]
        read_only_fields = ['id', 'user', 'swiped_at']
    
    def validate(self, attrs):
        """Validate is_like is provided for new swipes"""
        if self.instance is None and attrs.get('is_like') is None:
            raise serializers.ValidationError("is_like is required")
        return attrs


class SwipeSummarySerializer(serializers.Serializer):
    """Serializer for swipe summary statistics"""
    total_swipes = serializers.IntegerField()
    likes = serializers.IntegerField()
    dislikes = serializers.IntegerField()
    like_ratio = serializers.FloatField()


class MatchSerializer(serializers.ModelSerializer):
    """Serializer for Match with candidate details and snapshot"""
    candidate = CandidateSerializer(read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)
    
    class Meta:
        model = Match
        fields = ['id', 'session', 'session_title', 'candidate', 'matched_at', 'snapshot']
        read_only_fields = ['id', 'session', 'candidate', 'matched_at', 'snapshot']


class MatchMessageSerializer(serializers.ModelSerializer):
    """Serializer for MatchMessage model"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    match_candidate_label = serializers.CharField(source='match.candidate.label', read_only=True)

    class Meta:
        model = MatchMessage
        fields = ['id', 'match', 'match_candidate_label', 'user', 'user_username', 'content', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']



class AnswerOptionSerializer(serializers.ModelSerializer):
    """Serializer for AnswerOption model"""
    
    class Meta:
        model = AnswerOption
        fields = ['id', 'question', 'text', 'order_num']
        read_only_fields = ['id']


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for Question model"""
    answer_options = AnswerOptionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'text', 'scope', 'candidate_type', 'created_at', 'answer_options']
        read_only_fields = ['id', 'created_at']
    
    def validate(self, attrs):
        """Validate that candidate_type is provided when scope is 'candidate_type'"""
        scope = attrs.get('scope')
        candidate_type = attrs.get('candidate_type')
        
        if scope == 'candidate_type' and not candidate_type:
            raise serializers.ValidationError(
                "candidate_type must be provided when scope is 'candidate_type'"
            )
        
        return attrs


class UserAnswerSerializer(serializers.ModelSerializer):
    """Serializer for UserAnswer model"""
    question_text = serializers.CharField(source='question.text', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = UserAnswer
        fields = [
            'id', 'user', 'user_username', 'question', 'question_text',
            'session', 'answer_option', 'answer_value', 'answered_at'
        ]
        read_only_fields = ['id', 'user', 'answered_at']
    
    def validate(self, attrs):
        """Validate that at least one of answer_option or answer_value is provided"""
        answer_option = attrs.get('answer_option')
        answer_value = attrs.get('answer_value')
        
        # For updates, check if either field is being set or already exists
        if self.instance:
            final_answer_option = answer_option if answer_option is not None else self.instance.answer_option
            final_answer_value = answer_value if answer_value is not None else self.instance.answer_value
            
            if final_answer_option is None and final_answer_value is None:
                raise serializers.ValidationError(
                    "At least one of answer_option or answer_value must be provided"
                )
        else:
            # For new answers, at least one must be provided
            if answer_option is None and answer_value is None:
                raise serializers.ValidationError(
                    "At least one of answer_option or answer_value must be provided"
                )
        
        return attrs


class UserAnswerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating user answers"""
    
    class Meta:
        model = UserAnswer
        fields = ['question', 'session', 'answer_option', 'answer_value']
    
    def validate(self, attrs):
        """Validate that at least one of answer_option or answer_value is provided"""
        answer_option = attrs.get('answer_option')
        answer_value = attrs.get('answer_value')
        
        if answer_option is None and answer_value is None:
            raise serializers.ValidationError(
                "At least one of answer_option or answer_value must be provided"
            )
        
        return attrs


# ============================================================================
# Profile Serializers (Van Lifer Profiles Feature)
# ============================================================================

class CountrySerializer(serializers.ModelSerializer):
    """Serializer for Country model"""
    
    class Meta:
        model = Country
        fields = ['id', 'name', 'code']
        read_only_fields = ['id']


class RegionSerializer(serializers.ModelSerializer):
    """Serializer for Region model with nested country"""
    country = CountrySerializer(read_only=True)
    
    class Meta:
        model = Region
        fields = ['id', 'name', 'country']
        read_only_fields = ['id']


class LocationTimingSerializer(serializers.Serializer):
    """Serializer for location timing fields (now_in, next_week_in, next_month_in)"""
    region = RegionSerializer(read_only=True)
    country = CountrySerializer(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    def to_representation(self, instance):
        """
        Custom representation for location timing.
        Instance is expected to be a dict with 'region' and 'updated_at' keys.
        """
        if instance is None:
            return None
        
        region = instance.get('region')
        updated_at = instance.get('updated_at')
        
        if region is None:
            return None
        
        return {
            'region': {
                'id': region.id,
                'name': region.name,
            },
            'country': {
                'id': region.country.id,
                'name': region.country.name,
                'code': region.country.code,
            },
            'updated_at': updated_at,
        }


class HobbyTagSerializer(serializers.ModelSerializer):
    """Serializer for HobbyTag model"""
    
    class Meta:
        model = HobbyTag
        fields = ['id', 'name', 'slug']
        read_only_fields = ['id']


class VehiclePhotoSerializer(serializers.ModelSerializer):
    """Serializer for VehiclePhoto model"""
    url = serializers.URLField(source='image_url', read_only=True)
    order = serializers.IntegerField(source='display_order', read_only=True)
    
    class Meta:
        model = VehiclePhoto
        fields = ['id', 'url', 'order']
        read_only_fields = ['id']


class VehicleSerializer(serializers.ModelSerializer):
    """Serializer for Vehicle model with nested photos"""
    photos = VehiclePhotoSerializer(many=True, read_only=True)
    type = serializers.CharField(source='vehicle_type', read_only=True)
    
    class Meta:
        model = Vehicle
        fields = ['id', 'type', 'make', 'model', 'year', 'build_status', 'nickname', 'photos']
        read_only_fields = ['id']


class ProfileSerializer(serializers.ModelSerializer):
    """
    Full profile serializer with all nested data.
    
    Includes user info, profile fields, vehicle, location timing,
    in_town_windows, prompts, hobbies, and social indicators.
    """
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    
    # Nested serializers
    vehicle = serializers.SerializerMethodField()
    hobbies = HobbyTagSerializer(many=True, read_only=True)
    
    # Nested in_town_windows and prompts
    in_town_windows = serializers.SerializerMethodField()
    prompts = serializers.SerializerMethodField()
    
    # Location timing fields
    now_in = serializers.SerializerMethodField()
    next_week_in = serializers.SerializerMethodField()
    next_month_in = serializers.SerializerMethodField()
    
    # Social counts
    follower_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    
    # Relationship indicators (relative to request user)
    is_following = serializers.SerializerMethodField()
    is_followed_by = serializers.SerializerMethodField()
    
    # Friend status indicator (relative to request user)
    friend_status = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = [
            'id',
            'user_id',
            'username',
            'display_name',
            'bio',
            'has_completed_onboarding',
            'gender',
            'avatar_url',
            'cover_url',
            'current_location',
            'home_base',
            'has_van',
            'interested_in_men',
            'interested_in_women',
            'interested_in_nonbinary',
            'travel_status',
            'travel_companions',
            'work_status',
            'camping_preferences',
            'travel_pace',
            # Nomad-logistics fields
            'profile_type',
            'group_description',
            'looking_for_dating',
            'looking_for_friends',
            'meetup_interest',
            'rig_status',
            'social_vibe',
            'has_pets',
            'pet_type',
            'pet_friendly_only',
            'lifestyle_schedule',
            'lifestyle_social',
            'lifestyle_environment',
            # Friend-intent-filtering fields
            'relationship_status',
            'looking_for_friend_type',
            # End nomad-logistics fields
            'in_town_windows',
            'prompts',
            'now_in',
            'next_week_in',
            'next_month_in',
            'now_in_city',
            'next_week_in_city',
            'next_month_in_city',
            'hobbies',
            'vehicle',
            'follower_count',
            'following_count',
            'is_following',
            'is_followed_by',
            'friend_status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_vehicle(self, obj):
        """
        Return vehicle data if has_van is true and vehicle exists.
        Returns None if has_van is false or no vehicle exists.
        """
        if not obj.has_van:
            return None
        
        try:
            vehicle = obj.vehicle
            return VehicleSerializer(vehicle).data
        except Vehicle.DoesNotExist:
            return None
    
    def get_in_town_windows(self, obj):
        """
        Return list of in-town windows for this profile.
        Only returns active (non-expired) windows, ordered by start_date.
        """
        from django.utils import timezone
        today = timezone.now().date()
        
        # Get active windows (end_date >= today), ordered by start_date
        windows = obj.in_town_windows.filter(end_date__gte=today).order_by('start_date')
        
        # Use a simplified serializer to avoid circular import issues
        return [
            {
                'id': str(window.id),
                'city_area': window.city_area,
                'start_date': window.start_date.isoformat(),
                'end_date': window.end_date.isoformat(),
                'created_at': window.created_at.isoformat() if window.created_at else None,
            }
            for window in windows
        ]
    
    def get_prompts(self, obj):
        """
        Return list of profile prompts for this profile.
        Returns prompts ordered by display_order.
        """
        prompts = obj.prompts.all().order_by('display_order')
        
        # Use a simplified serializer to avoid circular import issues
        return [
            {
                'id': str(prompt.id),
                'prompt_name': prompt.prompt.prompt_name,
                'prompt_question': prompt.prompt.prompt_question,
                'prompt_answer': prompt.prompt_answer,
                'display_order': prompt.display_order,
            }
            for prompt in prompts
        ]
    
    def get_now_in(self, obj):
        """Return now_in location with region, country, and updated_at"""
        if obj.now_in is None:
            return None
        
        location_data = {
            'region': obj.now_in,
            'updated_at': obj.now_in_updated_at,
        }
        return LocationTimingSerializer().to_representation(location_data)
    
    def get_next_week_in(self, obj):
        """Return next_week_in location with region, country, and updated_at"""
        if obj.next_week_in is None:
            return None
        
        location_data = {
            'region': obj.next_week_in,
            'updated_at': obj.next_week_in_updated_at,
        }
        return LocationTimingSerializer().to_representation(location_data)
    
    def get_next_month_in(self, obj):
        """Return next_month_in location with region, country, and updated_at"""
        if obj.next_month_in is None:
            return None
        
        location_data = {
            'region': obj.next_month_in,
            'updated_at': obj.next_month_in_updated_at,
        }
        return LocationTimingSerializer().to_representation(location_data)
    
    def get_follower_count(self, obj):
        """Return count of users following this profile"""
        return obj.follower_set.count()
    
    def get_following_count(self, obj):
        """Return count of users this profile is following"""
        return obj.following_set.count()
    
    def get_is_following(self, obj):
        """
        Return True if the request user follows this profile.
        Returns False if no request context or user is not authenticated.
        """
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        
        # Don't check follow relationship for own profile
        if request.user.id == obj.user_id:
            return False
        
        try:
            request_user_profile = request.user.profile
            return Follow.objects.filter(
                follower=request_user_profile,
                following=obj
            ).exists()
        except Profile.DoesNotExist:
            return False
    
    def get_is_followed_by(self, obj):
        """
        Return True if this profile follows the request user.
        Returns False if no request context or user is not authenticated.
        """
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        
        # Don't check follow relationship for own profile
        if request.user.id == obj.user_id:
            return False
        
        try:
            request_user_profile = request.user.profile
            return Follow.objects.filter(
                follower=obj,
                following=request_user_profile
            ).exists()
        except Profile.DoesNotExist:
            return False

    def get_friend_status(self, obj):
        """
        Return the friend status between the request user and this profile.
        
        Returns:
        - None: if viewing own profile or not authenticated
        - 'none': no friend relationship exists
        - 'request_sent': current user sent a pending request to this profile
        - 'request_received': this profile sent a pending request to current user
        - 'friends': users are friends
        """
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        
        # Don't show friend status for own profile
        if request.user.id == obj.user_id:
            return None
        
        try:
            request_user_profile = request.user.profile
        except Profile.DoesNotExist:
            return None
        
        # Check if they are already friends
        # Friendship model enforces user1.id < user2.id
        friendship_exists = Friendship.objects.filter(
            models.Q(user1=request_user_profile, user2=obj) |
            models.Q(user1=obj, user2=request_user_profile)
        ).exists()
        
        if friendship_exists:
            return 'friends'
        
        # Check if current user sent a pending request to this profile
        request_sent = FriendRequest.objects.filter(
            from_user=request_user_profile,
            to_user=obj,
            status='pending'
        ).exists()
        
        if request_sent:
            return 'request_sent'
        
        # Check if this profile sent a pending request to current user
        request_received = FriendRequest.objects.filter(
            from_user=obj,
            to_user=request_user_profile,
            status='pending'
        ).exists()
        
        if request_received:
            return 'request_received'
        
        return 'none'


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profiles with comprehensive validation.
    
    Validates character limits, enum fields, region IDs, and camping preferences.
    """
    
    # Region ID fields for location timing updates (legacy)
    now_in_region_id = serializers.UUIDField(required=False, allow_null=True)
    next_week_in_region_id = serializers.UUIDField(required=False, allow_null=True)
    next_month_in_region_id = serializers.UUIDField(required=False, allow_null=True)
    
    # City name fields for simplified US-only location
    now_in_city = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    next_week_in_city = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    next_month_in_city = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    
    # Hobby IDs for updating hobbies
    hobby_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True
    )
    
    # Valid camping preference values
    VALID_CAMPING_PREFERENCES = [
        'boondocking',
        'campgrounds', 
        'stealth_camping',
        'rv_parks',
        'friends_driveways'
    ]
    
    class Meta:
        model = Profile
        fields = [
            'display_name',
            'bio',
            'has_completed_onboarding',
            'gender',
            'current_location',
            'home_base',
            'has_van',
            'interested_in_men',
            'interested_in_women',
            'interested_in_nonbinary',
            'travel_status',
            'travel_companions',
            'work_status',
            'camping_preferences',
            'travel_pace',
            # Nomad-logistics fields
            'profile_type',
            'group_description',
            'looking_for_dating',
            'looking_for_friends',
            'meetup_interest',
            'rig_status',
            'social_vibe',
            'has_pets',
            'pet_type',
            'pet_friendly_only',
            'lifestyle_schedule',
            'lifestyle_social',
            'lifestyle_environment',
            # Friend-intent-filtering fields
            'relationship_status',
            'looking_for_friend_type',
            # End nomad-logistics fields
            'now_in_region_id',
            'next_week_in_region_id',
            'next_month_in_region_id',
            'now_in_city',
            'next_week_in_city',
            'next_month_in_city',
            'hobby_ids',
        ]
    
    def validate_display_name(self, value):
        """Validate display_name character limit (≤ 50 characters)"""
        if value and len(value) > 50:
            raise serializers.ValidationError(
                "Display name must be 50 characters or fewer."
            )
        return value
    
    def validate_bio(self, value):
        """Validate bio character limit (≤ 500 characters)"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Bio must be 500 characters or fewer."
            )
        return value
    
    def validate_current_location(self, value):
        """Validate current_location character limit (≤ 100 characters)"""
        if value and len(value) > 100:
            raise serializers.ValidationError(
                "Current location must be 100 characters or fewer."
            )
        return value
    
    def validate_home_base(self, value):
        """Validate home_base character limit (≤ 100 characters)"""
        if value and len(value) > 100:
            raise serializers.ValidationError(
                "Home base must be 100 characters or fewer."
            )
        return value
    
    def validate_travel_status(self, value):
        """Validate travel_status is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.TRAVEL_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid travel status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_travel_companions(self, value):
        """Validate travel_companions is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.TRAVEL_COMPANIONS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid travel companions. Must be one of: {', '.join(valid_choices)}"
            )
        return value

    def validate_now_in_city(self, value):
        if value is None or value == '':
            return value
        if not City.objects.filter(display_name__iexact=value).exists():
            raise serializers.ValidationError("Select a city from the list.")
        return value

    def validate_next_week_in_city(self, value):
        if value is None or value == '':
            return value
        if not City.objects.filter(display_name__iexact=value).exists():
            raise serializers.ValidationError("Select a city from the list.")
        return value

    def validate_next_month_in_city(self, value):
        if value is None or value == '':
            return value
        if not City.objects.filter(display_name__iexact=value).exists():
            raise serializers.ValidationError("Select a city from the list.")
        return value
    
    def validate_work_status(self, value):
        """Validate work_status is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.WORK_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid work status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_travel_pace(self, value):
        """Validate travel_pace is a valid choice"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.TRAVEL_PACE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid travel pace. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    # =========================================================================
    # Nomad-logistics enum field validation (Requirements 1.1, 2.1, 3.1-3.6)
    # =========================================================================
    
    def validate_profile_type(self, value):
        """Validate profile_type is a valid choice (Requirement 1.1)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.PROFILE_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid profile type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_group_description(self, value):
        """Validate group_description character limit (≤ 200 characters) (Requirement 1.2)"""
        if value and len(value) > 200:
            raise serializers.ValidationError(
                "Group description must be 200 characters or fewer."
            )
        return value
    
    def validate_meetup_interest(self, value):
        """Validate meetup_interest is a valid choice (Requirement 1.1)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.MEETUP_INTEREST_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid meetup interest. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_rig_status(self, value):
        """Validate rig_status is a valid choice (Requirement 2.1)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.RIG_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid rig status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_social_vibe(self, value):
        """Validate social_vibe is a valid choice (Requirement 3.2)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.SOCIAL_VIBE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid social vibe. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_pet_type(self, value):
        """Validate pet_type is a valid choice (Requirement 3.4)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.PET_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid pet type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_lifestyle_schedule(self, value):
        """Validate lifestyle_schedule is a valid choice (Requirement 3.6)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LIFESTYLE_SCHEDULE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid lifestyle schedule. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_lifestyle_social(self, value):
        """Validate lifestyle_social is a valid choice (Requirement 3.6)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LIFESTYLE_SOCIAL_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid lifestyle social. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_lifestyle_environment(self, value):
        """Validate lifestyle_environment is a valid choice (Requirement 3.6)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LIFESTYLE_ENVIRONMENT_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid lifestyle environment. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_relationship_status(self, value):
        """Validate relationship_status is a valid choice (Requirement 6.1)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.RELATIONSHIP_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid relationship_status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_looking_for_friend_type(self, value):
        """Validate looking_for_friend_type is a valid choice (Requirement 6.2)"""
        if value is None:
            return value
        valid_choices = [choice[0] for choice in Profile.LOOKING_FOR_FRIEND_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid looking_for_friend_type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_camping_preferences(self, value):
        """Validate camping_preferences contains only valid values"""
        if value is None:
            return []
        
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Camping preferences must be a list."
            )
        
        invalid_prefs = [pref for pref in value if pref not in self.VALID_CAMPING_PREFERENCES]
        if invalid_prefs:
            raise serializers.ValidationError(
                f"Invalid camping preferences: {', '.join(invalid_prefs)}. "
                f"Valid options are: {', '.join(self.VALID_CAMPING_PREFERENCES)}"
            )
        
        return value
    
    def validate_now_in_region_id(self, value):
        """Validate now_in_region_id exists in the database"""
        if value is None:
            return value
        
        if not Region.objects.filter(id=value).exists():
            raise serializers.ValidationError(
                "Region not found. Please provide a valid region ID."
            )
        return value
    
    def validate_next_week_in_region_id(self, value):
        """Validate next_week_in_region_id exists in the database"""
        if value is None:
            return value
        
        if not Region.objects.filter(id=value).exists():
            raise serializers.ValidationError(
                "Region not found. Please provide a valid region ID."
            )
        return value
    
    def validate_next_month_in_region_id(self, value):
        """Validate next_month_in_region_id exists in the database"""
        if value is None:
            return value
        
        if not Region.objects.filter(id=value).exists():
            raise serializers.ValidationError(
                "Region not found. Please provide a valid region ID."
            )
        return value
    
    def validate_hobby_ids(self, value):
        """Validate all hobby_ids exist in the database"""
        if value is None:
            return []
        
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Hobby IDs must be a list."
            )
        
        # Check all hobby IDs exist
        existing_ids = set(
            HobbyTag.objects.filter(id__in=value).values_list('id', flat=True)
        )
        provided_ids = set(value)
        missing_ids = provided_ids - existing_ids
        
        if missing_ids:
            raise serializers.ValidationError(
                f"Invalid hobby IDs: {', '.join(str(id) for id in missing_ids)}. "
                "Please provide valid hobby tag IDs."
            )
        
        return value
    
    def validate(self, attrs):
        """
        Cross-field validation.
        
        Validates:
        - At least one of looking_for_dating or looking_for_friends must be true (Requirements 5.3, 5.4)
        """
        # =========================================================================
        # Validate looking_for_dating / looking_for_friends
        # Requirements 5.3, 5.4: At least one intent must be selected
        # =========================================================================
        looking_for_dating = attrs.get('looking_for_dating')
        looking_for_friends = attrs.get('looking_for_friends')
        
        # Only validate if at least one field is being updated
        if looking_for_dating is not None or looking_for_friends is not None:
            # Get current instance values for fields not being updated
            if self.instance:
                if looking_for_dating is None:
                    looking_for_dating = self.instance.looking_for_dating
                if looking_for_friends is None:
                    looking_for_friends = self.instance.looking_for_friends
            else:
                # For new profiles (shouldn't happen with update serializer, but be safe)
                if looking_for_dating is None:
                    looking_for_dating = False
                if looking_for_friends is None:
                    looking_for_friends = True
            
            # Validate at least one is true
            if not looking_for_dating and not looking_for_friends:
                raise serializers.ValidationError({
                    'looking_for': "At least one of 'looking_for_dating' or 'looking_for_friends' must be true."
                })
        
        # =========================================================================
        # Validate conditional pet_type (Requirement 3.4, Property 14)
        # pet_type should only be accepted when has_pets is true
        # =========================================================================
        has_pets = attrs.get('has_pets')
        pet_type = attrs.get('pet_type')
        
        # Determine the effective has_pets value
        if has_pets is None and self.instance:
            has_pets = self.instance.has_pets
        elif has_pets is None:
            has_pets = False
        
        # If has_pets is False, clear pet_type
        if not has_pets:
            if pet_type is not None:
                # Clear pet_type when has_pets is False
                attrs['pet_type'] = None
            elif self.instance and self.instance.pet_type:
                # Also clear if has_pets is being set to False and instance has pet_type
                attrs['pet_type'] = None
        
        # =========================================================================
        # Validate conditional group_description (Requirement 1.2)
        # group_description should only be accepted when profile_type is 'couple' or 'group'
        # =========================================================================
        profile_type = attrs.get('profile_type')
        group_description = attrs.get('group_description')
        
        # Determine the effective profile_type value
        if profile_type is None and self.instance:
            profile_type = self.instance.profile_type
        elif profile_type is None:
            profile_type = 'solo'
        
        # If profile_type is 'solo', clear group_description
        if profile_type == 'solo':
            if group_description is not None:
                # Clear group_description when profile_type is 'solo'
                attrs['group_description'] = ''
            elif self.instance and self.instance.group_description:
                # Also clear if profile_type is being set to 'solo' and instance has group_description
                attrs['group_description'] = ''
        
        return attrs
    
    def update(self, instance, validated_data):
        """
        Update profile with validated data.
        
        Handles special fields:
        - Region ID fields are converted to Region FK references (legacy)
        - City name fields are stored directly
        - Location timestamps are updated when location fields change
        - Hobby IDs are used to update the many-to-many relationship
        """
        # Extract special fields that need custom handling
        now_in_region_id = validated_data.pop('now_in_region_id', None)
        next_week_in_region_id = validated_data.pop('next_week_in_region_id', None)
        next_month_in_region_id = validated_data.pop('next_month_in_region_id', None)
        hobby_ids = validated_data.pop('hobby_ids', None)
        
        # Handle city fields (new simplified location)
        now_in_city = validated_data.pop('now_in_city', None)
        next_week_in_city = validated_data.pop('next_week_in_city', None)
        next_month_in_city = validated_data.pop('next_month_in_city', None)
        
        # Update city fields if provided
        if 'now_in_city' in self.initial_data:
            instance.now_in_city = now_in_city if now_in_city else None
        if 'next_week_in_city' in self.initial_data:
            instance.next_week_in_city = next_week_in_city if next_week_in_city else None
        if 'next_month_in_city' in self.initial_data:
            instance.next_month_in_city = next_month_in_city if next_month_in_city else None
        
        # Handle now_in region update (legacy)
        if now_in_region_id is not None:
            if now_in_region_id != (instance.now_in_id if instance.now_in else None):
                instance.now_in = Region.objects.get(id=now_in_region_id)
                instance.now_in_updated_at = timezone.now()
        elif 'now_in_region_id' in self.initial_data and self.initial_data['now_in_region_id'] is None:
            # Explicitly setting to null
            instance.now_in = None
            instance.now_in_updated_at = timezone.now()
        
        # Handle next_week_in region update
        if next_week_in_region_id is not None:
            if next_week_in_region_id != (instance.next_week_in_id if instance.next_week_in else None):
                instance.next_week_in = Region.objects.get(id=next_week_in_region_id)
                instance.next_week_in_updated_at = timezone.now()
        elif 'next_week_in_region_id' in self.initial_data and self.initial_data['next_week_in_region_id'] is None:
            # Explicitly setting to null
            instance.next_week_in = None
            instance.next_week_in_updated_at = timezone.now()
        
        # Handle next_month_in region update
        if next_month_in_region_id is not None:
            if next_month_in_region_id != (instance.next_month_in_id if instance.next_month_in else None):
                instance.next_month_in = Region.objects.get(id=next_month_in_region_id)
                instance.next_month_in_updated_at = timezone.now()
        elif 'next_month_in_region_id' in self.initial_data and self.initial_data['next_month_in_region_id'] is None:
            # Explicitly setting to null
            instance.next_month_in = None
            instance.next_month_in_updated_at = timezone.now()
        
        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        # Handle hobby updates (many-to-many relationship)
        if hobby_ids is not None:
            # Clear existing hobbies and set new ones
            instance.hobbies.clear()
            hobbies = HobbyTag.objects.filter(id__in=hobby_ids)
            instance.hobbies.set(hobbies)
        
        return instance


class VehicleUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating vehicles with validation.
    
    Validates vehicle_type, make, model, year, build_status, and nickname.
    """
    
    class Meta:
        model = Vehicle
        fields = ['vehicle_type', 'make', 'model', 'year', 'build_status', 'nickname']
    
    def validate_vehicle_type(self, value):
        """Validate vehicle_type is a valid choice"""
        valid_choices = [choice[0] for choice in Vehicle.VEHICLE_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid vehicle type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_make(self, value):
        """Validate make character limit (≤ 50 characters)"""
        if value and len(value) > 50:
            raise serializers.ValidationError(
                "Make must be 50 characters or fewer."
            )
        return value
    
    def validate_model(self, value):
        """Validate model character limit (≤ 50 characters)"""
        if value and len(value) > 50:
            raise serializers.ValidationError(
                "Model must be 50 characters or fewer."
            )
        return value
    
    def validate_year(self, value):
        """
        Validate vehicle year range (1900 to current year + 1).
        """
        if value is None:
            return value
        
        from datetime import datetime
        current_year = datetime.now().year
        min_year = 1900
        max_year = current_year + 1
        
        if value < min_year or value > max_year:
            raise serializers.ValidationError(
                f"Year must be between {min_year} and {max_year}."
            )
        return value
    
    def validate_build_status(self, value):
        """Validate build_status is a valid choice"""
        if value is None or value == '':
            return value
        valid_choices = [choice[0] for choice in Vehicle.BUILD_STATUS_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid build status. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_nickname(self, value):
        """Validate nickname character limit (≤ 30 characters)"""
        if value and len(value) > 30:
            raise serializers.ValidationError(
                "Nickname must be 30 characters or fewer."
            )
        return value


class VehiclePhotoCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for uploading vehicle photos with validation.
    
    Validates image_url, display_order, and max 10 photos per vehicle.
    """
    
    MAX_PHOTOS_PER_VEHICLE = 10
    
    class Meta:
        model = VehiclePhoto
        fields = ['image_url', 'display_order']
    
    def validate_image_url(self, value):
        """Validate image_url is a valid URL"""
        if not value:
            raise serializers.ValidationError(
                "Image URL is required."
            )
        return value
    
    def validate_display_order(self, value):
        """Validate display_order is a positive integer"""
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "Display order must be a positive integer."
            )
        return value
    
    def validate(self, attrs):
        """
        Cross-field validation.
        Validates that adding this photo won't exceed the max 10 photos per vehicle limit.
        """
        # Get the vehicle from context (should be set by the view)
        vehicle = self.context.get('vehicle')
        
        if vehicle:
            current_photo_count = vehicle.photos.count()
            if current_photo_count >= self.MAX_PHOTOS_PER_VEHICLE:
                raise serializers.ValidationError({
                    'image_url': f"Maximum of {self.MAX_PHOTOS_PER_VEHICLE} photos per vehicle allowed. "
                                 f"Please delete an existing photo before adding a new one."
                })
        
        return attrs
    
    def create(self, validated_data):
        """Create a new vehicle photo"""
        vehicle = self.context.get('vehicle')
        if not vehicle:
            raise serializers.ValidationError(
                "Vehicle context is required to create a photo."
            )
        
        # If display_order is not provided, set it to the next available order
        if validated_data.get('display_order') is None:
            max_order = vehicle.photos.aggregate(
                max_order=models.Max('display_order')
            )['max_order']
            validated_data['display_order'] = (max_order or 0) + 1
        
        return VehiclePhoto.objects.create(vehicle=vehicle, **validated_data)


class FeedCardSerializer(serializers.ModelSerializer):
    """
    Serializer for displaying profile cards in the nearby feed.
    """
    timing_label = serializers.CharField(read_only=True)
    friend_status = serializers.CharField(read_only=True, default='none')
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url', 'timing_label', 'friend_status']
        read_only_fields = ['id', 'display_name', 'avatar_url', 'timing_label', 'friend_status']


class ProfileSummarySerializer(serializers.ModelSerializer):
    """
    Compact profile serializer for followers/following lists.
    """
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url']
        read_only_fields = ['id', 'display_name', 'avatar_url']


# ============================================================================
# InTownWindow Serializers (Nomad Logistics Feature)
# ============================================================================

class InTownWindowSerializer(serializers.ModelSerializer):
    """
    Serializer for InTownWindow model with comprehensive validation.
    
    Validates city_area length, date range, and max 3 windows per profile.
    """
    
    MAX_WINDOWS_PER_PROFILE = 3
    
    class Meta:
        model = InTownWindow
        fields = ['id', 'profile', 'city_area', 'start_date', 'end_date', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'profile': {'required': False}  # Will be set from context in create
        }
    
    def validate_city_area(self, value):
        """Validate city_area character limit (≤ 100 characters)."""
        if value and len(value) > 100:
            raise serializers.ValidationError(
                "City/area name must be 100 characters or fewer."
            )
        return value
    
    def validate(self, attrs):
        """
        Cross-field validation for date range and max windows per profile.
        """
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        
        # For updates, get existing values if not provided
        if self.instance:
            if start_date is None:
                start_date = self.instance.start_date
            if end_date is None:
                end_date = self.instance.end_date
        
        # Validate date range: start_date must be <= end_date
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                'start_date': "Start date must be before or equal to end date."
            })
        
        # Validate max 3 windows per profile (only for creation)
        if not self.instance:
            profile = attrs.get('profile') or self.context.get('profile')
            if profile:
                current_window_count = InTownWindow.objects.filter(profile=profile).count()
                if current_window_count >= self.MAX_WINDOWS_PER_PROFILE:
                    raise serializers.ValidationError({
                        'profile': f"Maximum of {self.MAX_WINDOWS_PER_PROFILE} in-town windows per profile allowed. "
                                   "Please delete an existing window before adding a new one."
                    })
        
        return attrs
    
    def create(self, validated_data):
        """Create a new in-town window, setting profile from context if not provided."""
        if 'profile' not in validated_data or validated_data['profile'] is None:
            profile = self.context.get('profile')
            if not profile:
                raise serializers.ValidationError(
                    "Profile context is required to create an in-town window."
                )
            validated_data['profile'] = profile
        
        return InTownWindow.objects.create(**validated_data)


class CitySerializer(serializers.ModelSerializer):
    """Serializer for city autocomplete."""
    class Meta:
        model = City
        fields = ['id', 'name', 'state_code', 'display_name']


class PromptListSerializer(serializers.ModelSerializer):
    """Serializer for prompt choices."""
    class Meta:
        model = Prompt
        fields = ['prompt_name', 'prompt_question', 'prompt_placeholder', 'prompt_type']


# ============================================================================
# ProfilePrompt Serializers (Nomad Logistics Feature)
# ============================================================================

class AvailablePromptSerializer(serializers.ModelSerializer):
    """
    Serializer for listing available prompt questions.
    """
    class Meta:
        model = Prompt
        fields = ['prompt_name', 'prompt_question', 'prompt_placeholder', 'prompt_type']


class ProfilePromptSerializer(serializers.ModelSerializer):
    """
    Serializer for ProfilePrompt model with comprehensive validation.
    
    Validates prompt_answer length, prompt_name existence, and max 3 prompts per profile.
    """
    
    MAX_PROMPTS_PER_PROFILE = 3
    MAX_ANSWER_LENGTH = 200
    
    prompt_question = serializers.SerializerMethodField()
    prompt_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = ProfilePrompt
        fields = ['id', 'profile', 'prompt_name', 'prompt_question', 'prompt_answer', 'display_order']
        read_only_fields = ['id', 'prompt_question']
        extra_kwargs = {
            'profile': {'required': False}  # Will be set from context in create
        }
    
    def get_validators(self):
        """
        Override to remove the automatic UniqueTogetherValidator.
        We handle unique_together validation manually in validate() to support
        profile being passed via context.
        """
        validators = super().get_validators()
        # Filter out UniqueTogetherValidator - we handle it manually
        return [v for v in validators if not isinstance(v, serializers.UniqueTogetherValidator)]
    
    def get_prompt_question(self, obj):
        """Return the human-readable prompt question text."""
        return obj.prompt.prompt_question
    
    def validate_prompt_answer(self, value):
        """
        Validate prompt_answer character limit (≤ 200 characters).
        
        Requirement 5.5: THE Profile_System SHALL limit prompt answers to 200 
        characters each
        """
        if value and len(value) > self.MAX_ANSWER_LENGTH:
            raise serializers.ValidationError(
                f"Prompt answer must be {self.MAX_ANSWER_LENGTH} characters or fewer."
            )
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Prompt answer is required and cannot be empty."
            )
        return value
    
    def validate(self, attrs):
        """
        Cross-field validation.
        
        Validates:
        - Max 3 prompts per profile (Requirement 5.4)
        - Unique prompt_question per profile (enforced by model, but provide better error)
        """
        prompt_name = attrs.pop('prompt_name', None)
        profile = attrs.get('profile') or self.context.get('profile')

        if prompt_name:
            try:
                attrs['prompt'] = Prompt.objects.get(prompt_name=prompt_name)
            except Prompt.DoesNotExist:
                raise serializers.ValidationError({
                    'prompt_name': 'Invalid prompt name. Please choose a valid prompt.'
                })
        
        prompt = attrs.get('prompt')
        if not prompt and not self.instance:
            raise serializers.ValidationError({
                'prompt_name': 'Prompt name is required.'
            })
        
        # For updates, use instance's profile if not provided
        if self.instance and not profile:
            profile = self.instance.profile
        
        if profile:
            # Check for duplicate prompt (only for creation or if changing prompt)
            if not self.instance or (self.instance and prompt != self.instance.prompt):
                existing_prompt = ProfilePrompt.objects.filter(
                    profile=profile,
                    prompt=prompt
                )
                if self.instance:
                    existing_prompt = existing_prompt.exclude(id=self.instance.id)
                
                if existing_prompt.exists():
                    raise serializers.ValidationError({
                        'prompt_name': "You have already answered this prompt. "
                                      "Please choose a different prompt or update the existing one."
                    })
            
            # Validate max 3 prompts per profile (only for creation)
            if not self.instance:
                current_prompt_count = ProfilePrompt.objects.filter(profile=profile).count()
                if current_prompt_count >= self.MAX_PROMPTS_PER_PROFILE:
                    raise serializers.ValidationError({
                        'profile': f"Maximum of {self.MAX_PROMPTS_PER_PROFILE} prompts per profile allowed. "
                                   "Please delete an existing prompt before adding a new one."
                    })
        
        return attrs
    
    def create(self, validated_data):
        """Create a new profile prompt, setting profile from context if not provided."""
        if 'profile' not in validated_data or validated_data['profile'] is None:
            profile = self.context.get('profile')
            if not profile:
                raise serializers.ValidationError(
                    "Profile context is required to create a prompt."
                )
            validated_data['profile'] = profile

        if 'prompt' not in validated_data or validated_data['prompt'] is None:
            raise serializers.ValidationError({
                'prompt_name': 'Prompt name is required.'
            })
        
        # If display_order is not provided, set it to the next available order
        if validated_data.get('display_order') is None:
            profile = validated_data['profile']
            from django.db.models import Max
            max_order = ProfilePrompt.objects.filter(profile=profile).aggregate(
                max_order=Max('display_order')
            )['max_order']
            validated_data['display_order'] = (max_order or 0) + 1
        
        return ProfilePrompt.objects.create(**validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['prompt_name'] = instance.prompt.prompt_name
        return data


# ============================================================================
# PersonSwipe and PersonMatch Serializers (Nomad Logistics Feature)
# ============================================================================

class PersonMatchSerializer(serializers.ModelSerializer):
    """
    Serializer for PersonMatch model.
    
    Returns match information including both users and match metadata.
    """
    user1_profile = serializers.SerializerMethodField()
    user2_profile = serializers.SerializerMethodField()
    other_user = serializers.SerializerMethodField()
    
    class Meta:
        model = PersonMatch
        fields = [
            'id', 'user1', 'user2', 'user1_profile', 'user2_profile',
            'other_user', 'mode', 'matched_at', 'is_active'
        ]
        read_only_fields = ['id', 'matched_at']
    
    def get_user1_profile(self, obj):
        """Return basic profile info for user1"""
        return {
            'id': str(obj.user1.id),
            'display_name': obj.user1.display_name,
            'avatar_url': obj.user1.avatar_url,
        }
    
    def get_user2_profile(self, obj):
        """Return basic profile info for user2"""
        return {
            'id': str(obj.user2.id),
            'display_name': obj.user2.display_name,
            'avatar_url': obj.user2.avatar_url,
        }
    
    def get_other_user(self, obj):
        """
        Return the other user in the match (relative to the request user).
        
        This is useful for displaying "who you matched with" in the UI.
        """
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        
        try:
            request_user_profile = request.user.profile
            other_profile = obj.get_other_user(request_user_profile)
            return {
                'id': str(other_profile.id),
                'display_name': other_profile.display_name,
                'avatar_url': other_profile.avatar_url,
            }
        except Profile.DoesNotExist:
            return None


class PersonSwipeSerializer(serializers.ModelSerializer):
    """
    Serializer for PersonSwipe model with mutual match detection.
    
    Creates swipe records and auto-creates PersonMatch on mutual likes.
    """
    swiper = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.all(),
        required=False,
        allow_null=True
    )
    swiper_profile = serializers.SerializerMethodField()
    swiped_on_profile = serializers.SerializerMethodField()
    match_created = serializers.SerializerMethodField()
    match = serializers.SerializerMethodField()
    
    class Meta:
        model = PersonSwipe
        fields = [
            'id', 'swiper', 'swiped_on', 'swiper_profile', 'swiped_on_profile',
            'is_like', 'mode', 'swiped_at', 'match_created', 'match'
        ]
        read_only_fields = ['id', 'swiped_at', 'match_created', 'match']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Store match info for response
        self._match_created = False
        self._match = None
    
    def get_swiper_profile(self, obj):
        """Return basic profile info for swiper"""
        return {
            'id': str(obj.swiper.id),
            'display_name': obj.swiper.display_name,
            'avatar_url': obj.swiper.avatar_url,
        }
    
    def get_swiped_on_profile(self, obj):
        """Return basic profile info for swiped_on user"""
        return {
            'id': str(obj.swiped_on.id),
            'display_name': obj.swiped_on.display_name,
            'avatar_url': obj.swiped_on.avatar_url,
        }
    
    def get_match_created(self, obj):
        """Return whether a match was created from this swipe"""
        return getattr(self, '_match_created', False)
    
    def get_match(self, obj):
        """Return the match if one was created"""
        match = getattr(self, '_match', None)
        if match:
            return {
                'id': str(match.id),
                'mode': match.mode,
                'matched_at': match.matched_at.isoformat() if match.matched_at else None,
            }
        return None
    
    def validate_mode(self, value):
        """Validate mode is a valid choice"""
        valid_choices = [choice[0] for choice in PersonSwipe.MODE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid mode. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_swiped_on(self, value):
        """Validate swiped_on is a valid profile"""
        if not value:
            raise serializers.ValidationError("swiped_on is required.")
        return value
    
    def validate(self, attrs):
        """
        Cross-field validation.
        
        Validates:
        - swiper cannot swipe on themselves
        - No duplicate swipes (same swiper, swiped_on, mode)
        - swiped_on must opt in to dating for dating mode
        """
        swiper = attrs.get('swiper') or self.context.get('swiper')
        swiped_on = attrs.get('swiped_on')
        mode = attrs.get('mode')
        
        # Validate swiper is not swiping on themselves
        if swiper and swiped_on and swiper.id == swiped_on.id:
            raise serializers.ValidationError({
                'swiped_on': "You cannot swipe on yourself."
            })
        
        # Check for duplicate swipe (only for creation)
        if not self.instance and swiper and swiped_on and mode:
            existing_swipe = PersonSwipe.objects.filter(
                swiper=swiper,
                swiped_on=swiped_on,
                mode=mode
            ).exists()
            
            if existing_swipe:
                raise serializers.ValidationError({
                    'swiped_on': f"You have already swiped on this user in {mode} mode."
                })

        if swiped_on and mode == 'dating' and not swiped_on.looking_for_dating:
            raise serializers.ValidationError({
                'swiped_on': "This user is not available for dating."
            })
        
        return attrs
    
    def create(self, validated_data):
        """
        Create a new PersonSwipe and check for mutual match.
        
        If the swipe is a like (is_like=True), check if the other user has also
        liked the swiper in the same mode. If so, create a PersonMatch.
        
        Property 7: Mutual Match Creation
        Validates: Requirements 7.3
        """
        # Set swiper from context if not provided
        if 'swiper' not in validated_data or validated_data['swiper'] is None:
            swiper = self.context.get('swiper')
            if not swiper:
                raise serializers.ValidationError(
                    "Swiper context is required to create a swipe."
                )
            validated_data['swiper'] = swiper
        
        # Create the swipe
        swipe = PersonSwipe.objects.create(**validated_data)
        
        # Check for mutual match if this is a like
        if swipe.is_like:
            match = self._check_and_create_match(swipe)
            if match:
                self._match_created = True
                self._match = match
        
        return swipe
    
    def _check_and_create_match(self, swipe):
        """
        Check if there's a mutual like and create a PersonMatch if so.
        
        A mutual match occurs when:
        1. User A likes User B in mode X
        2. User B has already liked User A in mode X
        
        When mutual match is detected, create a PersonMatch with:
        - user1: The user who swiped first (chronologically)
        - user2: The user who swiped second (the current swiper)
        - mode: The mode of the swipes
        
        Returns the created PersonMatch or None if no mutual match.
        """
        # Look for a reciprocal like from the swiped_on user
        reciprocal_swipe = PersonSwipe.objects.filter(
            swiper=swipe.swiped_on,
            swiped_on=swipe.swiper,
            mode=swipe.mode,
            is_like=True
        ).first()
        
        if not reciprocal_swipe:
            return None
        
        # Check if a match already exists between these users in this mode
        existing_match = PersonMatch.objects.filter(
            mode=swipe.mode
        ).filter(
            models.Q(user1=swipe.swiper, user2=swipe.swiped_on) |
            models.Q(user1=swipe.swiped_on, user2=swipe.swiper)
        ).first()

        if existing_match:
            if not existing_match.is_active:
                existing_match.is_active = True
                existing_match.save(update_fields=['is_active'])
            return existing_match

        # Normalize ordering to prevent duplicate pair rows
        user1 = swipe.swiper
        user2 = swipe.swiped_on
        if str(user1.id) > str(user2.id):
            user1, user2 = user2, user1

        # Create the match (unique by ordered pair + mode), handle race safely
        try:
            with transaction.atomic():
                match, created = PersonMatch.objects.get_or_create(
                    user1=user1,
                    user2=user2,
                    mode=swipe.mode,
                    defaults={'is_active': True}
                )
        except IntegrityError:
            match = PersonMatch.objects.get(
                user1=user1,
                user2=user2,
                mode=swipe.mode
            )
            created = False

        if not match.is_active:
            match.is_active = True
            match.save(update_fields=['is_active'])

        return match


# ============================================================================
# DirectMessage Serializers (Nomad Logistics Feature - Chat System)
# ============================================================================

class DirectMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for DirectMessage model with comprehensive validation.
    
    Enables 1:1 chat between matched users with support for text messages,
    mini-card sharing, and icebreaker prompts.
    """
    
    MAX_CONTENT_LENGTH = 1000
    
    # Include sender profile info for display
    sender_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = DirectMessage
        fields = [
            'id', 'match', 'sender', 'sender_profile', 'content',
            'message_type', 'mini_card_data', 'created_at', 'is_read'
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'sender': {'required': False},  # Will be set from context
            'match': {'required': False},   # Will be set from context
        }
    
    def get_sender_profile(self, obj):
        """Return basic profile info for the sender."""
        return {
            'id': str(obj.sender.id),
            'display_name': obj.sender.display_name,
            'avatar_url': obj.sender.avatar_url,
        }
    
    def validate_content(self, value):
        """Validate content length (≤ 1000 characters)."""
        if value and len(value) > self.MAX_CONTENT_LENGTH:
            raise serializers.ValidationError(
                f"Message content must be {self.MAX_CONTENT_LENGTH} characters or fewer."
            )
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Message content is required and cannot be empty."
            )
        return value
    
    def validate_message_type(self, value):
        """Validate message_type is a valid choice."""
        valid_choices = [choice[0] for choice in DirectMessage.MESSAGE_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid message type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_mini_card_data(self, value):
        """
        Validate mini_card_data structure when provided.
        
        Mini-card data should contain: current_location, in_town_until, meet_preference.
        """
        if value is None:
            return value
        
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Mini-card data must be a JSON object."
            )
        
        # Validate allowed fields
        allowed_fields = {'current_location', 'in_town_until', 'meet_preference'}
        provided_fields = set(value.keys())
        unknown_fields = provided_fields - allowed_fields
        
        if unknown_fields:
            raise serializers.ValidationError(
                f"Unknown fields in mini-card data: {', '.join(unknown_fields)}. "
                f"Allowed fields are: {', '.join(allowed_fields)}"
            )
        
        # Validate current_location if provided
        if 'current_location' in value and value['current_location'] is not None:
            if not isinstance(value['current_location'], str):
                raise serializers.ValidationError(
                    "current_location must be a string."
                )
            if len(value['current_location']) > 100:
                raise serializers.ValidationError(
                    "current_location must be 100 characters or fewer."
                )
        
        # Validate in_town_until if provided (should be a date string)
        if 'in_town_until' in value and value['in_town_until'] is not None:
            if not isinstance(value['in_town_until'], str):
                raise serializers.ValidationError(
                    "in_town_until must be a date string (YYYY-MM-DD format)."
                )
            # Try to parse the date
            try:
                from datetime import datetime
                datetime.strptime(value['in_town_until'], '%Y-%m-%d')
            except ValueError:
                raise serializers.ValidationError(
                    "in_town_until must be a valid date in YYYY-MM-DD format."
                )
        
        # Validate meet_preference if provided
        if 'meet_preference' in value and value['meet_preference'] is not None:
            if not isinstance(value['meet_preference'], str):
                raise serializers.ValidationError(
                    "meet_preference must be a string."
                )
            if len(value['meet_preference']) > 200:
                raise serializers.ValidationError(
                    "meet_preference must be 200 characters or fewer."
                )
        
        return value
    
    def validate(self, attrs):
        """
        Cross-field validation.
        
        Validates:
        - Sender must be one of the two users in the match (Property 10: Chat Access Control)
        - mini_card_data is required when message_type is 'mini_card'
        - Match must be active
        
        Property 10: Chat Access Control
        Validates: Requirements 10.1, 10.4
        """
        # Get match and sender from attrs or context
        match = attrs.get('match') or self.context.get('match')
        sender = attrs.get('sender') or self.context.get('sender')
        message_type = attrs.get('message_type', 'text')
        mini_card_data = attrs.get('mini_card_data')
        
        # Validate match is provided
        if not match:
            raise serializers.ValidationError({
                'match': "Match is required."
            })
        
        # Validate sender is provided
        if not sender:
            raise serializers.ValidationError({
                'sender': "Sender is required."
            })
        
        # Property 10: Chat Access Control
        # Validate sender is one of the two users in the match
        if sender.id != match.user1_id and sender.id != match.user2_id:
            raise serializers.ValidationError({
                'sender': "Sender must be one of the two users in the match."
            })
        
        # Validate match is active
        if not match.is_active:
            raise serializers.ValidationError({
                'match': "Cannot send messages to an inactive match."
            })
        
        # Validate mini_card_data is provided when message_type is 'mini_card'
        if message_type == 'mini_card':
            if not mini_card_data:
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data is required when message_type is 'mini_card'."
                })
            # Ensure at least one field is provided in mini_card_data
            if not any(mini_card_data.get(field) for field in ['current_location', 'in_town_until', 'meet_preference']):
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data must contain at least one of: "
                                      "current_location, in_town_until, meet_preference."
                })
        
        return attrs
    
    def create(self, validated_data):
        """
        Create a new DirectMessage.
        
        Sets match and sender from context if not provided in validated_data.
        """
        # Set match from context if not provided
        if 'match' not in validated_data or validated_data['match'] is None:
            match = self.context.get('match')
            if not match:
                raise serializers.ValidationError(
                    "Match context is required to create a message."
                )
            validated_data['match'] = match
        
        # Set sender from context if not provided
        if 'sender' not in validated_data or validated_data['sender'] is None:
            sender = self.context.get('sender')
            if not sender:
                raise serializers.ValidationError(
                    "Sender context is required to create a message."
                )
            validated_data['sender'] = sender
        
        return DirectMessage.objects.create(**validated_data)


class DirectMessageCreateSerializer(serializers.Serializer):
    """
    Simplified serializer for creating DirectMessages via API.
    
    Accepts content, message_type, and mini_card_data. Match and sender
    are set from the URL and authenticated user.
    """
    content = serializers.CharField(
        max_length=1000,
        required=True,
        help_text="Message content (max 1000 characters)"
    )
    message_type = serializers.ChoiceField(
        choices=DirectMessage.MESSAGE_TYPE_CHOICES,
        default='text',
        required=False,
        help_text="Type of message: text, mini_card, or icebreaker"
    )
    mini_card_data = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="Mini-card data with current_location, in_town_until, meet_preference"
    )
    
    def validate_content(self, value):
        """Validate content is not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Message content is required and cannot be empty."
            )
        return value
    
    def validate_mini_card_data(self, value):
        """
        Validate mini_card_data structure.
        
        Delegates to DirectMessageSerializer for consistent validation.
        """
        if value is None:
            return value
        
        # Use DirectMessageSerializer's validation logic
        temp_serializer = DirectMessageSerializer()
        return temp_serializer.validate_mini_card_data(value)
    
    def validate(self, attrs):
        """
        Cross-field validation.
        
        Validates mini_card_data is provided when message_type is 'mini_card'.
        """
        message_type = attrs.get('message_type', 'text')
        mini_card_data = attrs.get('mini_card_data')
        
        if message_type == 'mini_card':
            if not mini_card_data:
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data is required when message_type is 'mini_card'."
                })
            # Ensure at least one field is provided
            if not any(mini_card_data.get(field) for field in ['current_location', 'in_town_until', 'meet_preference']):
                raise serializers.ValidationError({
                    'mini_card_data': "mini_card_data must contain at least one of: "
                                      "current_location, in_town_until, meet_preference."
                })
        
        return attrs


# ============================================================================
# User Report Serializers
# ============================================================================
class UserReportSerializer(serializers.ModelSerializer):
    """
    Serializer for UserReport model.
    
    Used for creating user reports for policy violations.
    """
    reporter_profile = serializers.SerializerMethodField()
    reported_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = UserReport
        fields = [
            'id', 'reporter', 'reported', 'reporter_profile', 'reported_profile',
            'reason', 'description', 'created_at'
        ]
        read_only_fields = ['id', 'reporter', 'created_at']
    
    def get_reporter_profile(self, obj):
        """Return basic profile info for reporter"""
        return {
            'id': str(obj.reporter.id),
            'display_name': obj.reporter.display_name,
            'avatar_url': obj.reporter.avatar_url,
        }
    
    def get_reported_profile(self, obj):
        """Return basic profile info for reported user"""
        return {
            'id': str(obj.reported.id),
            'display_name': obj.reported.display_name,
            'avatar_url': obj.reported.avatar_url,
        }
    
    def validate_reason(self, value):
        """Validate reason is a valid choice"""
        valid_choices = [choice[0] for choice in UserReport.REASON_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid reason. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_description(self, value):
        """Validate description length"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value


class UserReportCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a user report from a match context.
    """
    reason = serializers.ChoiceField(choices=UserReport.REASON_CHOICES)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    
    def validate_reason(self, value):
        """Validate reason is a valid choice"""
        valid_choices = [choice[0] for choice in UserReport.REASON_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid reason. Must be one of: {', '.join(valid_choices)}"
            )
        return value


# ============================================================================
# Plan Serializers (Nomad Logistics Feature)
# ============================================================================

class PlanAttendeeSerializer(serializers.ModelSerializer):
    """
    Serializer for PlanAttendee model with profile information.
    """
    user_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = PlanAttendee
        fields = ['id', 'plan', 'user', 'user_profile', 'status', 'joined_at', 'confirmed_at']
        read_only_fields = ['id', 'joined_at', 'confirmed_at']
    
    def get_user_profile(self, obj):
        """Return basic profile info for the attendee"""
        return {
            'id': str(obj.user.id),
            'display_name': obj.user.display_name,
            'avatar_url': obj.user.avatar_url,
        }


class PlanMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for PlanMessage model with sender profile data.
    """
    sender_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = PlanMessage
        fields = ['id', 'plan', 'sender', 'sender_profile', 'content', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']
    
    def get_sender_profile(self, obj):
        """Return basic profile info for the sender"""
        return {
            'id': str(obj.sender.id),
            'display_name': obj.sender.display_name,
            'avatar_url': obj.sender.avatar_url,
        }
    
    def validate_content(self, value):
        """Validate message content length (max 500 chars)"""
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        if len(value) > 500:
            raise serializers.ValidationError(
                "Message content must be 500 characters or less."
            )
        return value


class PlanSerializer(serializers.ModelSerializer):
    """
    Serializer for Plan model with nested attendees.
    """
    created_by_profile = serializers.SerializerMethodField()
    attendees = PlanAttendeeSerializer(many=True, read_only=True)
    attendee_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Plan
        fields = [
            'id', 'created_by', 'created_by_profile', 'title', 'plan_type',
            'plan_date', 'time_window', 'meetup_area', 'description',
            'max_attendees', 'status', 'created_at', 'attendees', 'attendee_count'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'status']
    
    def get_created_by_profile(self, obj):
        """Return basic profile info for the plan creator"""
        return {
            'id': str(obj.created_by.id),
            'display_name': obj.created_by.display_name,
            'avatar_url': obj.created_by.avatar_url,
        }
    
    def get_attendee_count(self, obj):
        """Return count of attendees (joined or confirmed)"""
        return obj.attendees.exclude(status='declined').count()


class PlanCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating plans with validation.
    
    Validates max_attendees (1-10), plan_date (not in past), and title length.
    """
    
    class Meta:
        model = Plan
        fields = [
            'title', 'plan_type', 'plan_date', 'time_window',
            'meetup_area', 'description', 'max_attendees'
        ]
    
    def validate_title(self, value):
        """Validate title is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Title must be 100 characters or less."
            )
        return value
    
    def validate_plan_type(self, value):
        """Validate plan_type is a valid choice"""
        valid_choices = [choice[0] for choice in Plan.PLAN_TYPE_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid plan type. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_time_window(self, value):
        """Validate time_window is a valid choice"""
        valid_choices = [choice[0] for choice in Plan.TIME_WINDOW_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid time window. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_plan_date(self, value):
        """Validate plan_date is not in the past"""
        from datetime import date
        today = date.today()
        if value < today:
            raise serializers.ValidationError(
                "Plan date cannot be in the past."
            )
        return value
    
    def validate_meetup_area(self, value):
        """Validate meetup_area is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Meetup area cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Meetup area must be 100 characters or less."
            )
        return value
    
    def validate_max_attendees(self, value):
        """Validate max_attendees is between 1 and 10"""
        if value < 1:
            raise serializers.ValidationError(
                "Max attendees must be at least 1."
            )
        if value > 10:
            raise serializers.ValidationError(
                "Max attendees cannot exceed 10."
            )
        return value
    
    def validate_description(self, value):
        """Validate description length if provided"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value


class PlanUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating plans.
    
    Allows updating title, description, time_window, meetup_area, and max_attendees.
    """
    
    class Meta:
        model = Plan
        fields = ['title', 'time_window', 'meetup_area', 'description', 'max_attendees']
    
    def validate_title(self, value):
        """Validate title is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Title must be 100 characters or less."
            )
        return value
    
    def validate_time_window(self, value):
        """Validate time_window is a valid choice"""
        valid_choices = [choice[0] for choice in Plan.TIME_WINDOW_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid time window. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_meetup_area(self, value):
        """Validate meetup_area is not empty and within length limit"""
        if not value or not value.strip():
            raise serializers.ValidationError("Meetup area cannot be empty.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Meetup area must be 100 characters or less."
            )
        return value
    
    def validate_max_attendees(self, value):
        """
        Validate max_attendees is between 1 and 10.
        Also ensure it's not less than current attendee count.
        """
        if value < 1:
            raise serializers.ValidationError(
                "Max attendees must be at least 1."
            )
        if value > 10:
            raise serializers.ValidationError(
                "Max attendees cannot exceed 10."
            )
        
        # Check if reducing below current attendee count
        if self.instance:
            current_count = self.instance.attendees.exclude(status='declined').count()
            if value < current_count:
                raise serializers.ValidationError(
                    f"Cannot reduce max attendees below current attendee count ({current_count})."
                )
        
        return value
    
    def validate_description(self, value):
        """Validate description length if provided"""
        if value and len(value) > 500:
            raise serializers.ValidationError(
                "Description must be 500 characters or less."
            )
        return value


class PlanMessageCreateSerializer(serializers.Serializer):
    """
    Simplified serializer for creating PlanMessages via API.
    Only requires content field, plan and sender are set by the view.
    """
    content = serializers.CharField(max_length=500)
    
    def validate_content(self, value):
        """Validate message content is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value


# ============================================================================
# Activity Serializers (Three-Tab Restructure Feature)
# ============================================================================

class ActivityCreatedBySerializer(serializers.ModelSerializer):
    """
    Minimal profile serializer for activity created_by field.
    Includes id, display_name, and avatar_url.
    """
    
    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'avatar_url']
        read_only_fields = ['id', 'display_name', 'avatar_url']


class ActivitySerializer(serializers.ModelSerializer):
    """
    Serializer for Activity model with computed spots_remaining field.
    
    spots_remaining = spots - 1 (creator) - count(likes)
    """
    created_by = ActivityCreatedBySerializer(read_only=True)
    spots_remaining = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = [
            'id',
            'title',
            'activity_type',
            'description',
            'image_url',
            'spots',
            'spots_remaining',
            'activity_date',
            'time_window',
            'location',
            'status',
            'created_by',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'spots_remaining',
            'created_by',
            'created_at',
        ]
    
    def get_spots_remaining(self, obj):
        """
        Calculate remaining spots for the activity.
        
        Formula: spots - 1 (creator) - count(likes)
        
        The creator automatically occupies 1 spot, so we subtract 1 from total spots.
        Each user who swiped right (is_like=True) occupies 1 additional spot.
        
        Returns:
            int: Number of remaining spots available (minimum 0)
        """
        # Count the number of likes (right swipes) on this activity
        likes_count = obj.swipes.filter(is_like=True).count()
        
        # spots_remaining = total_spots - 1 (creator) - likes_count
        # Ensure we don't return negative values
        remaining = obj.spots - 1 - likes_count
        return max(0, remaining)


class ActivityCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating Activity instances with validation.
    
    Validates activity_date (must be today or future) and spots (1-20).
    """
    
    class Meta:
        model = Activity
        fields = [
            'title',
            'activity_type',
            'description',
            'image_url',
            'spots',
            'activity_date',
            'time_window',
            'location',
        ]
    
    def validate_activity_date(self, value):
        """Validate that activity_date is not in the past."""
        from datetime import date
        today = date.today()
        
        if value < today:
            raise serializers.ValidationError(
                "Activity date must be today or in the future."
            )
        
        return value
    
    def validate_spots(self, value):
        """Validate that spots is between 1 and 20."""
        if value < 1:
            raise serializers.ValidationError(
                "Number of spots must be at least 1."
            )
        
        if value > 20:
            raise serializers.ValidationError(
                "Number of spots cannot exceed 20."
            )
        
        return value
    
    def create(self, validated_data):
        """
        Create an Activity with the current user as the creator.
        
        The status is automatically set to 'open' by the model default.
        """
        # Get the user's profile from the request context
        request = self.context.get('request')
        if request and hasattr(request.user, 'profile'):
            validated_data['created_by'] = request.user.profile
        
        return super().create(validated_data)


class ActivitySwipeSerializer(serializers.ModelSerializer):
    """
    Serializer for ActivitySwipe model - recording swipe direction on activities.
    """
    
    class Meta:
        model = ActivitySwipe
        fields = [
            'id',
            'activity',
            'user',
            'is_like',
            'swiped_at',
        ]
        read_only_fields = ['id', 'activity', 'user', 'swiped_at']


class ActivityMatchSerializer(serializers.ModelSerializer):
    """
    Serializer for ActivityMatch model with nested activity and attendees.
    """
    activity = ActivitySerializer(read_only=True)
    attendees = ActivityCreatedBySerializer(many=True, read_only=True)
    
    class Meta:
        model = ActivityMatch
        fields = [
            'id',
            'activity',
            'attendees',
            'matched_at',
        ]
        read_only_fields = ['id', 'activity', 'attendees', 'matched_at']


class ActivityMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for ActivityMessage model - chat messages in matched activity groups.
    """
    sender = ActivityCreatedBySerializer(read_only=True)
    
    class Meta:
        model = ActivityMessage
        fields = [
            'id',
            'sender',
            'content',
            'created_at',
        ]
        read_only_fields = ['id', 'sender', 'created_at']


# ============================================================================
# Friend Request and Friendship Serializers
# ============================================================================

class FriendRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for FriendRequest model with nested profile data.
    """
    from_user = ActivityCreatedBySerializer(read_only=True)
    to_user = ActivityCreatedBySerializer(read_only=True)
    
    class Meta:
        model = FriendRequest
        fields = [
            'id',
            'from_user',
            'to_user',
            'status',
            'created_at',
            'responded_at',
        ]
        read_only_fields = ['id', 'from_user', 'to_user', 'status', 'created_at', 'responded_at']


class FriendshipSerializer(serializers.ModelSerializer):
    """
    Serializer for Friendship model with nested friend profile data.
    
    The 'friend' field returns the other user in the friendship (not the current user).
    """
    friend = serializers.SerializerMethodField()
    
    class Meta:
        model = Friendship
        fields = [
            'id',
            'friend',
            'created_at',
        ]
        read_only_fields = ['id', 'friend', 'created_at']
    
    def get_friend(self, obj):
        """
        Return the other user's profile data based on the request context.
        
        The Friendship model has user1 and user2 fields. This method determines
        which user is the "friend" (the other user, not the current user) and
        returns their profile data using ActivityCreatedBySerializer.
        """
        request = self.context.get('request')
        if not request or not request.user:
            return None
        
        try:
            current_profile = request.user.profile
        except Profile.DoesNotExist:
            return None
        
        # Determine which user is the friend (the other user)
        friend_profile = obj.get_friend(current_profile)
        
        return ActivityCreatedBySerializer(friend_profile).data


class FriendMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for FriendMessage model - chat messages between friends.
    """
    sender = ActivityCreatedBySerializer(read_only=True)
    
    class Meta:
        model = FriendMessage
        fields = [
            'id',
            'sender',
            'content',
            'created_at',
            'is_read',
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'is_read']
