from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from core.models import (
    UserAccount, Group, GroupMembership, Session, SessionSharedGroup,
    Taxonomy, Term, Candidate, CandidateTerm,
    Swipe, Match, MatchMessage, Question, AnswerOption, UserAnswer
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



class GroupMembershipSerializer(serializers.ModelSerializer):
    """Serializer for GroupMembership model"""
    user = UserAccountSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True, required=False)
    group_name = serializers.CharField(source='group.name', read_only=True)
    
    class Meta:
        model = GroupMembership
        fields = [
            'id', 'group', 'group_name', 'user', 'user_id', 'role', 
            'membership_type', 'status', 'is_confirmed', 
            'invited_at', 'confirmed_at', 'rejected_at'
        ]
        read_only_fields = ['id', 'invited_at', 'confirmed_at', 'rejected_at']


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
