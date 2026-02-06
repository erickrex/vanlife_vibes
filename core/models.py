import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError


class UserAccount(AbstractUser):
    """Custom user model extending Django's AbstractUser"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_account'

    def __str__(self):
        return self.username


class Country(models.Model):
    """Country for location selection in user profiles"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=3, unique=True)  # ISO 3166-1 alpha-2 or alpha-3

    class Meta:
        db_table = 'country'
        ordering = ['name']
        verbose_name_plural = 'countries'

    def __str__(self):
        return self.name


class Region(models.Model):
    """Region within a country for location selection in user profiles"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    country = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        related_name='regions'
    )
    name = models.CharField(max_length=100)

    class Meta:
        db_table = 'region'
        ordering = ['name']
        unique_together = ['country', 'name']

    def __str__(self):
        return f"{self.name}, {self.country.name}"


class Profile(models.Model):
    """User profile for van lifers and nomadic travelers"""
    TRAVEL_STATUS_CHOICES = [
        ('full-time', 'Full-time'),
        ('part-time', 'Part-time'),
        ('weekender', 'Weekender'),
        ('aspiring', 'Aspiring'),
    ]

    TRAVEL_COMPANIONS_CHOICES = [
        ('solo', 'Solo'),
        ('couple', 'Couple'),
        ('family', 'Family'),
        ('with_pets', 'With Pets'),
    ]

    WORK_STATUS_CHOICES = [
        ('remote_worker', 'Remote Worker'),
        ('retired', 'Retired'),
        ('seasonal_worker', 'Seasonal Worker'),
        ('unemployed', 'Unemployed'),
        ('other', 'Other'),
    ]

    TRAVEL_PACE_CHOICES = [
        ('slow', 'Slow (weeks per spot)'),
        ('mixed', 'Mixed (varies)'),
        ('fast', 'Fast (moves frequently)'),
    ]

    # New profile type choices for nomad-logistics feature
    PROFILE_TYPE_CHOICES = [
        ('solo', 'Solo'),
        ('couple', 'Couple'),
        ('group', 'Group'),
    ]

    # New meetup interest choices for nomad-logistics feature
    MEETUP_INTEREST_CHOICES = [
        ('actively_looking', 'Actively Looking'),
        ('open_to_it', 'Open To It'),
        ('selective', 'Selective'),
        ('solo_mode', 'Solo Mode'),
    ]

    # Rig status choices for nomad-logistics feature (Requirement 2.1)
    RIG_STATUS_CHOICES = [
        ('van', 'Van'),
        ('rv', 'RV'),
        ('truck_camper', 'Truck Camper'),
        ('skoolie', 'Skoolie'),
        ('car', 'Car'),
        ('no_vehicle', 'No Vehicle'),
        ('other', 'Other'),
    ]

    # Social vibe choices for nomad-logistics feature (Requirement 3.2)
    SOCIAL_VIBE_CHOICES = [
        ('introvert', 'Introvert'),
        ('balanced', 'Balanced'),
        ('social', 'Social'),
    ]

    # Lifestyle schedule choices for nomad-logistics feature (Requirement 3.6)
    LIFESTYLE_SCHEDULE_CHOICES = [
        ('early_bird', 'Early Bird'),
        ('night_owl', 'Night Owl'),
    ]

    # Lifestyle social choices for nomad-logistics feature (Requirement 3.6)
    LIFESTYLE_SOCIAL_CHOICES = [
        ('quiet', 'Quiet'),
        ('party', 'Party'),
    ]

    # Lifestyle environment choices for nomad-logistics feature (Requirement 3.6)
    LIFESTYLE_ENVIRONMENT_CHOICES = [
        ('outdoors', 'Outdoors'),
        ('city_mix', 'City Mix'),
    ]

    # Pet type choices for nomad-logistics feature (Requirement 3.4)
    PET_TYPE_CHOICES = [
        ('dog', 'Dog'),
        ('cat', 'Cat'),
        ('other', 'Other'),
    ]

    # Relationship status choices for friend-intent-filtering feature (Requirement 6.1)
    RELATIONSHIP_STATUS_CHOICES = [
        ('single', 'Single'),
        ('in_relationship', 'In a Relationship'),
        ('married', 'Married'),
        ('its_complicated', "It's Complicated"),
        ('prefer_not_to_say', 'Prefer Not to Say'),
    ]

    # Looking for friend type choices for friend-intent-filtering feature (Requirement 6.2)
    LOOKING_FOR_FRIEND_TYPE_CHOICES = [
        ('any', 'Any'),
        ('singles_only', 'Singles Only'),
        ('couples_only', 'Couples Only'),
        ('no_preference', 'No Preference'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        UserAccount,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    display_name = models.CharField(max_length=50, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    cover_url = models.URLField(max_length=500, blank=True, null=True)
    current_location = models.CharField(max_length=100, blank=True)
    home_base = models.CharField(max_length=100, blank=True)
    has_van = models.BooleanField(default=False)
    interested_in_dating = models.BooleanField(default=False)
    # New fields for nomad-logistics feature (Requirements 1.1, 1.2, 4.1, 4.2, 5.1)
    profile_type = models.CharField(
        max_length=20,
        choices=PROFILE_TYPE_CHOICES,
        default='solo'
    )
    group_description = models.TextField(max_length=200, blank=True)
    looking_for_dating = models.BooleanField(default=False)
    looking_for_friends = models.BooleanField(default=True)
    meetup_interest = models.CharField(
        max_length=20,
        choices=MEETUP_INTEREST_CHOICES,
        default='open_to_it'
    )
    travel_status = models.CharField(
        max_length=20,
        choices=TRAVEL_STATUS_CHOICES,
        blank=True,
        null=True
    )
    travel_companions = models.CharField(
        max_length=20,
        choices=TRAVEL_COMPANIONS_CHOICES,
        blank=True,
        null=True
    )
    work_status = models.CharField(
        max_length=20,
        choices=WORK_STATUS_CHOICES,
        blank=True,
        null=True
    )
    camping_preferences = models.JSONField(default=list, blank=True)
    travel_pace = models.CharField(
        max_length=20,
        choices=TRAVEL_PACE_CHOICES,
        blank=True,
        null=True
    )
    # New travel and lifestyle fields for nomad-logistics feature (Requirements 2.1, 3.1-3.6)
    rig_status = models.CharField(
        max_length=20,
        choices=RIG_STATUS_CHOICES,
        blank=True,
        null=True
    )
    social_vibe = models.CharField(
        max_length=20,
        choices=SOCIAL_VIBE_CHOICES,
        blank=True,
        null=True
    )
    has_pets = models.BooleanField(default=False)
    pet_type = models.CharField(
        max_length=20,
        choices=PET_TYPE_CHOICES,
        blank=True,
        null=True
    )
    pet_friendly_only = models.BooleanField(default=False)
    lifestyle_schedule = models.CharField(
        max_length=20,
        choices=LIFESTYLE_SCHEDULE_CHOICES,
        blank=True,
        null=True
    )
    lifestyle_social = models.CharField(
        max_length=20,
        choices=LIFESTYLE_SOCIAL_CHOICES,
        blank=True,
        null=True
    )
    lifestyle_environment = models.CharField(
        max_length=20,
        choices=LIFESTYLE_ENVIRONMENT_CHOICES,
        blank=True,
        null=True
    )
    # Relationship status fields for friend-intent-filtering feature (Requirements 6.1, 6.2)
    relationship_status = models.CharField(
        max_length=20,
        choices=RELATIONSHIP_STATUS_CHOICES,
        default='prefer_not_to_say'
    )
    looking_for_friend_type = models.CharField(
        max_length=20,
        choices=LOOKING_FOR_FRIEND_TYPE_CHOICES,
        default='no_preference'
    )
    # Location timing fields
    now_in = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profiles_now'
    )
    now_in_updated_at = models.DateTimeField(blank=True, null=True)
    next_week_in = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profiles_next_week'
    )
    next_week_in_updated_at = models.DateTimeField(blank=True, null=True)
    next_month_in = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profiles_next_month'
    )
    next_month_in_updated_at = models.DateTimeField(blank=True, null=True)
    # City-based location fields (simplified US-only location)
    now_in_city = models.CharField(max_length=100, blank=True, null=True)
    next_week_in_city = models.CharField(max_length=100, blank=True, null=True)
    next_month_in_city = models.CharField(max_length=100, blank=True, null=True)
    # Hobbies - ManyToMany through ProfileHobby (defined later)
    hobbies = models.ManyToManyField(
        'HobbyTag',
        through='ProfileHobby',
        related_name='profiles'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'profile'
        indexes = [
            models.Index(fields=['now_in']),
            models.Index(fields=['next_week_in']),
            models.Index(fields=['next_month_in']),
        ]

    def __str__(self):
        return f"Profile for {self.user.username}"


class Vehicle(models.Model):
    """Vehicle/rig information for van lifers"""
    VEHICLE_TYPE_CHOICES = [
        ('van', 'Van'),
        ('rv', 'RV'),
        ('truck_camper', 'Truck Camper'),
        ('skoolie', 'Skoolie'),
        ('trailer', 'Trailer'),
        ('car_camper', 'Car Camper'),
        ('other', 'Other'),
    ]

    BUILD_STATUS_CHOICES = [
        ('stock', 'Stock'),
        ('partial', 'Partial Build'),
        ('full', 'Full Build'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.OneToOneField(
        Profile,
        on_delete=models.CASCADE,
        related_name='vehicle'
    )
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPE_CHOICES)
    make = models.CharField(max_length=50, blank=True)
    model = models.CharField(max_length=50, blank=True)
    year = models.PositiveIntegerField(blank=True, null=True)
    build_status = models.CharField(
        max_length=20,
        choices=BUILD_STATUS_CHOICES,
        blank=True,
        null=True
    )
    nickname = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vehicle'

    def __str__(self):
        parts = [self.vehicle_type]
        if self.make:
            parts.append(self.make)
        if self.model:
            parts.append(self.model)
        if self.year:
            parts.append(str(self.year))
        return f"{' '.join(parts)} ({self.profile.user.username})"


class VehiclePhoto(models.Model):
    """Photos of user's vehicle/rig"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name='photos'
    )
    image_url = models.URLField(max_length=500)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'vehicle_photo'
        ordering = ['display_order']
        indexes = [
            models.Index(fields=['vehicle']),
        ]

    def __str__(self):
        return f"Photo {self.display_order} for {self.vehicle}"


class Follow(models.Model):
    """Follow relationship between user profiles"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    follower = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='following_set'
    )
    following = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='follower_set'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'follow'
        unique_together = ['follower', 'following']
        indexes = [
            models.Index(fields=['follower']),
            models.Index(fields=['following']),
        ]

    def __str__(self):
        return f"{self.follower.user.username} follows {self.following.user.username}"


class Group(models.Model):
    """Group entity for collaborative matching"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        UserAccount,
        on_delete=models.CASCADE,
        related_name='created_groups'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'app_group'

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    """Links users to groups with role and confirmation status"""
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('member', 'Member'),
    ]
    
    MEMBERSHIP_TYPE_CHOICES = [
        ('invitation', 'Invitation'),  # Admin invited user
        ('request', 'Request'),        # User requested to join
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    user = models.ForeignKey(
        UserAccount,
        on_delete=models.CASCADE,
        related_name='group_memberships'
    )
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='member')
    membership_type = models.CharField(
        max_length=20,
        choices=MEMBERSHIP_TYPE_CHOICES,
        default='invitation'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    is_confirmed = models.BooleanField(default=False)
    invited_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'group_membership'
        unique_together = [['group', 'user']]
        indexes = [
            models.Index(fields=['group', 'is_confirmed']),
            models.Index(fields=['group', 'status']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['membership_type', 'status']),
        ]

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"


class Session(models.Model):
    """Match session with approval rules and status"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('archived', 'Archived'),
    ]

    # Valid status transitions
    VALID_TRANSITIONS = {
        'draft': ['open', 'archived'],
        'open': ['closed', 'archived'],
        'closed': ['archived'],
        'archived': []
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    candidate_type = models.CharField(max_length=100, blank=True, null=True)
    rules = models.JSONField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'session'
        indexes = [
            models.Index(fields=['group']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.title
    
    def can_transition_to(self, new_status):
        """Check if transition to new_status is valid"""
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])


class SessionSharedGroup(models.Model):
    """Many-to-many for cross-group sessions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='shared_groups'
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='shared_sessions'
    )
    shared_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'session_shared_group'
        unique_together = [['session', 'group']]
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['group']),
        ]

    def __str__(self):
        return f"{self.session.title} shared with {self.group.name}"



class Candidate(models.Model):
    """Candidate within a session that users can swipe on"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='candidates'
    )
    label = models.CharField(max_length=255)
    image_url = models.URLField(max_length=500, null=True, blank=True)
    attributes = models.JSONField(null=True, blank=True)
    external_ref = models.CharField(max_length=255, null=True, blank=True)
    created_by = models.ForeignKey(
        'UserAccount',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_candidates'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'candidate'
        unique_together = [['session', 'external_ref', 'label']]
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['created_by']),
        ]

    def __str__(self):
        return self.label
    



class Swipe(models.Model):
    """User swipe on a candidate"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='swipes'
    )
    user = models.ForeignKey(
        UserAccount,
        on_delete=models.CASCADE,
        related_name='votes'
    )
    is_like = models.BooleanField()
    swiped_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'swipe'
        unique_together = [['user', 'candidate']]
        indexes = [
            models.Index(fields=['candidate']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.username} swipe on {self.candidate.label}"


class Match(models.Model):
    """Candidates that met approval rules"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='matches'
    )
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='matches'
    )
    matched_at = models.DateTimeField(auto_now_add=True)
    snapshot = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'match'
        unique_together = [['session', 'candidate']]
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['candidate']),
        ]

    def __str__(self):
        return f"{self.candidate.label} matched in {self.session.title}"


class MatchMessage(models.Model):
    """Chat message attached to a group match"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    user = models.ForeignKey(
        UserAccount,
        on_delete=models.CASCADE,
        related_name='match_messages'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'match_message'
        indexes = [
            models.Index(fields=['match']),
            models.Index(fields=['user']),
        ]
        ordering = ['created_at']

    def __str__(self):
        return f"Message on {self.match.candidate.label} by {self.user.username}"


class Taxonomy(models.Model):
    """Classification system for organizing items"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'taxonomy'
        verbose_name_plural = 'taxonomies'

    def __str__(self):
        return self.name


class Term(models.Model):
    """Specific value within a taxonomy"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    taxonomy = models.ForeignKey(
        Taxonomy,
        on_delete=models.CASCADE,
        related_name='terms'
    )
    value = models.CharField(max_length=255)
    attributes = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'term'
        unique_together = [['taxonomy', 'value']]
        indexes = [
            models.Index(fields=['taxonomy']),
        ]

    def __str__(self):
        return f"{self.taxonomy.name}: {self.value}"


class CandidateTerm(models.Model):
    """Links candidates to taxonomy terms (tagging)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='candidate_terms'
    )
    term = models.ForeignKey(
        Term,
        on_delete=models.CASCADE,
        related_name='item_terms'
    )

    class Meta:
        db_table = 'candidate_term'
        unique_together = [['candidate', 'term']]
        indexes = [
            models.Index(fields=['candidate']),
            models.Index(fields=['term']),
        ]

    def __str__(self):
        return f"{self.candidate.label} tagged with {self.term.value}"


class Question(models.Model):
    """Question for capturing user preferences"""
    SCOPE_CHOICES = [
        ('global', 'Global'),
        ('candidate_type', 'Candidate Type'),
        ('session', 'Session'),
        ('group', 'Group'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text = models.TextField()
    scope = models.CharField(max_length=50, choices=SCOPE_CHOICES)
    candidate_type = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'question'
        indexes = [
            models.Index(fields=['scope']),
        ]

    def __str__(self):
        return self.text[:50]


class AnswerOption(models.Model):
    """Predefined answer choices for questions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='answer_options'
    )
    text = models.CharField(max_length=255)
    order_num = models.IntegerField()

    class Meta:
        db_table = 'answer_option'
        indexes = [
            models.Index(fields=['question']),
        ]
        ordering = ['order_num']

    def __str__(self):
        return self.text


class UserAnswer(models.Model):
    """User responses to questions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        UserAccount,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='user_answers'
    )
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='user_answers'
    )
    answer_option = models.ForeignKey(
        AnswerOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_answers'
    )
    answer_value = models.JSONField(null=True, blank=True)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_answer'
        unique_together = [['user', 'question', 'session']]
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['question']),
            models.Index(fields=['session']),
        ]

    def __str__(self):
        return f"{self.user.username} answer to {self.question.text[:30]}"


class HobbyTag(models.Model):
    """Predefined hobby tags for user profiles"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)

    class Meta:
        db_table = 'hobby_tag'
        ordering = ['name']

    def __str__(self):
        return self.name


class ProfileHobby(models.Model):
    """Junction table linking profiles to hobby tags"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='profile_hobbies'
    )
    hobby_tag = models.ForeignKey(
        HobbyTag,
        on_delete=models.CASCADE,
        related_name='profile_hobbies'
    )

    class Meta:
        db_table = 'profile_hobby'
        unique_together = ['profile', 'hobby_tag']

    def __str__(self):
        return f"{self.profile.user.username} - {self.hobby_tag.name}"


class InTownWindow(models.Model):
    """
    Lightweight location + date range for matching boost.
    Users can set up to 3 in-town windows (current + upcoming).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='in_town_windows'
    )
    city_area = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'in_town_window'
        ordering = ['start_date']
        indexes = [
            models.Index(fields=['profile']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def clean(self):
        """Validate that start_date is before or equal to end_date"""
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError('Start date must be before or equal to end date')

    def __str__(self):
        return f"{self.profile.user.username} in {self.city_area} ({self.start_date} - {self.end_date})"


class ProfilePrompt(models.Model):
    """
    User's prompt answers for their profile.
    Users can select and answer up to 3 prompts from predefined nomad-themed questions.
    """
    PROMPT_CHOICES = [
        ('perfect_day', 'My perfect day on the road looks like...'),
        ('cant_live_without', "I can't live without..."),
        ('looking_for', "I'm looking for someone who..."),
        ('best_adventure', 'My best adventure so far...'),
        ('next_destination', 'My next dream destination is...'),
        ('van_life_lesson', 'The biggest lesson van life taught me...'),
        ('ideal_travel_buddy', 'My ideal travel buddy is...'),
        ('hidden_talent', 'My hidden talent is...'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='prompts'
    )
    prompt_question = models.CharField(max_length=50, choices=PROMPT_CHOICES)
    prompt_answer = models.TextField(max_length=200)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'profile_prompt'
        ordering = ['display_order']
        unique_together = ['profile', 'prompt_question']

    def __str__(self):
        return f"{self.profile.user.username} - {self.get_prompt_question_display()}"


class PersonSwipe(models.Model):
    """
    Tracks swipes between users for person-to-person matching (like/pass).
    
    Used for dating/friends discovery where users swipe on profiles.
    A mutual like (both users swipe right in the same mode) creates a PersonMatch.
    """
    MODE_CHOICES = [
        ('dating', 'Dating'),
        ('friends', 'Friends'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    swiper = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='swipes_made'
    )
    swiped_on = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='swipes_received'
    )
    is_like = models.BooleanField()
    mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    swiped_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'person_swipe'
        unique_together = ['swiper', 'swiped_on', 'mode']
        indexes = [
            models.Index(fields=['swiper', 'mode']),
            models.Index(fields=['swiped_on', 'mode']),
            models.Index(fields=['swiped_on', 'is_like', 'mode']),
        ]

    def __str__(self):
        action = "liked" if self.is_like else "passed on"
        return f"{self.swiper.user.username} {action} {self.swiped_on.user.username} ({self.mode})"


class PersonMatch(models.Model):
    """
    Represents a mutual match between two users.
    
    Created when two users mutually swipe right in the same mode (dating or friends).
    Enables chat access between matched users.
    """
    MODE_CHOICES = [
        ('dating', 'Dating'),
        ('friends', 'Friends'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user1 = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='matches_as_user1'
    )
    user2 = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='matches_as_user2'
    )
    mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    matched_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'person_match'
        indexes = [
            models.Index(fields=['user1', 'is_active']),
            models.Index(fields=['user2', 'is_active']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user1', 'user2', 'mode'],
                name='uniq_person_match_pair_mode'
            ),
        ]

    def get_other_user(self, profile):
        """Return the other user in the match"""
        return self.user2 if self.user1 == profile else self.user1

    def __str__(self):
        return f"Match: {self.user1.user.username} <-> {self.user2.user.username} ({self.mode})"


class DirectMessage(models.Model):
    """
    Chat messages between matched users.
    
    Enables 1:1 chat between users with a PersonMatch.
    Supports text messages, mini-card sharing, and icebreaker prompts.
    """
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('mini_card', 'Mini Card'),
        ('icebreaker', 'Icebreaker'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(
        PersonMatch,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='sent_direct_messages'
    )
    content = models.TextField(max_length=1000)
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPE_CHOICES,
        default='text'
    )
    mini_card_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = 'direct_message'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['match', 'created_at']),
            models.Index(fields=['sender']),
        ]

    def __str__(self):
        return f"Message from {self.sender.user.username} in match {self.match.id}"


class UserReport(models.Model):
    """
    Tracks when a user reports another user for policy violations.
    
    Reports are stored for moderation review. Multiple reports can be made
    against the same user by different reporters.
    """
    REASON_CHOICES = [
        ('harassment', 'Harassment'),
        ('spam', 'Spam'),
        ('inappropriate_content', 'Inappropriate Content'),
        ('fake_profile', 'Fake Profile'),
        ('scam', 'Scam'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='reports_made'
    )
    reported = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='reports_received'
    )
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    description = models.TextField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_report'
        indexes = [
            models.Index(fields=['reporter']),
            models.Index(fields=['reported']),
            models.Index(fields=['reason']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.reporter.user.username} reported {self.reported.user.username} for {self.reason}"


class Plan(models.Model):
    """
    Lightweight meetup events for nomads.
    
    Plans allow users to create or join casual meetups like coffee, hikes,
    cowork sessions, etc. Plans have a date, time window, meetup area,
    and maximum group size.
    """
    PLAN_TYPE_CHOICES = [
        ('coffee', 'Coffee'),
        ('sunrise_hike', 'Sunrise Hike'),
        ('dog_walk', 'Dog Walk'),
        ('cowork', 'Cowork Session'),
        ('sunset', 'Sunset Viewpoint'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('full', 'Full'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]

    TIME_WINDOW_CHOICES = [
        ('morning', 'Morning (6am-12pm)'),
        ('afternoon', 'Afternoon (12pm-5pm)'),
        ('evening', 'Evening (5pm-9pm)'),
        ('flexible', 'Flexible'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='created_plans'
    )
    title = models.CharField(max_length=100)
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPE_CHOICES)
    plan_date = models.DateField()
    time_window = models.CharField(max_length=20, choices=TIME_WINDOW_CHOICES)
    meetup_area = models.CharField(max_length=100)
    description = models.TextField(max_length=500, blank=True)
    max_attendees = models.PositiveIntegerField(default=6)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'plan'
        ordering = ['plan_date', 'time_window']
        indexes = [
            models.Index(fields=['created_by']),
            models.Index(fields=['plan_date', 'status']),
            models.Index(fields=['meetup_area']),
        ]

    def __str__(self):
        return f"{self.title} ({self.plan_date})"


class PlanAttendee(models.Model):
    """
    Tracks plan attendance for users.
    
    Users can join plans and later confirm their attendance. The status
    tracks whether they've joined, confirmed, or declined.
    """
    STATUS_CHOICES = [
        ('joined', 'Joined'),
        ('confirmed', 'Confirmed'),
        ('declined', 'Declined'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE,
        related_name='attendees'
    )
    user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='plan_attendances'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='joined')
    joined_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'plan_attendee'
        unique_together = ['plan', 'user']
        indexes = [
            models.Index(fields=['plan', 'status']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.user.username} attending {self.plan.title} ({self.status})"


class PlanMessage(models.Model):
    """
    Chat messages for plan group chat.
    
    Enables group chat for plan attendees. All attendees can send and
    receive messages in the plan's group chat.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='sent_plan_messages'
    )
    content = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'plan_message'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['plan', 'created_at']),
        ]

    def __str__(self):
        return f"Message from {self.sender.user.username} in plan {self.plan.title}"


class Activity(models.Model):
    """
    User-created meetup event for swipe-based activity matching.
    
    Activities allow users to create meetups (climbing, coffee, cowork, etc.)
    that other travelers can discover and swipe on. When enough users swipe
    right to fill all spots, an ActivityMatch is created.
    """
    ACTIVITY_TYPE_CHOICES = [
        ('climbing', 'Climbing'),
        ('snowboarding', 'Snowboarding'),
        ('skiing', 'Skiing'),
        ('hiking', 'Hiking'),
        ('kayaking', 'Kayaking'),
        ('surfing', 'Surfing'),
        ('biking', 'Biking'),
        ('camping', 'Camping'),
        ('coffee', 'Coffee'),
        ('cowork', 'Cowork'),
        ('potluck', 'Potluck'),
        ('campfire', 'Campfire'),
        ('dog_walk', 'Dog Walk'),
        ('sunset', 'Sunset'),
        ('sunrise_hike', 'Sunrise Hike'),
        ('other', 'Other'),
    ]

    TIME_WINDOW_CHOICES = [
        ('morning', 'Morning (6am-12pm)'),
        ('afternoon', 'Afternoon (12pm-5pm)'),
        ('evening', 'Evening (5pm-9pm)'),
        ('flexible', 'Flexible'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('matched', 'Matched'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='created_activities'
    )
    title = models.CharField(max_length=100)
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES)
    description = models.TextField(max_length=500, blank=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    spots = models.PositiveIntegerField()  # Total spots including creator
    activity_date = models.DateField()
    time_window = models.CharField(max_length=20, choices=TIME_WINDOW_CHOICES)
    location = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activity'
        ordering = ['activity_date', 'time_window']
        indexes = [
            models.Index(fields=['status', 'activity_date']),
            models.Index(fields=['location']),
            models.Index(fields=['activity_type']),
        ]

    def __str__(self):
        return f"{self.title} ({self.activity_date})"


class ActivitySwipe(models.Model):
    """
    User swipe on an activity for swipe-based activity matching.
    
    Tracks when a user swipes right (like) or left (pass) on an activity.
    Each user can only swipe once per activity. When enough users swipe
    right to fill all spots, an ActivityMatch is created.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='swipes'
    )
    user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='activity_swipes'
    )
    is_like = models.BooleanField()
    swiped_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activity_swipe'
        unique_together = ['activity', 'user']
        indexes = [
            models.Index(fields=['activity', 'is_like']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        action = "liked" if self.is_like else "passed on"
        return f"{self.user.user.username} {action} {self.activity.title}"


class ActivityMatch(models.Model):
    """
    Represents a matched activity when enough users have swiped right.
    
    Created when the number of likes equals available spots. Includes all
    users who liked the activity plus the creator as attendees.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.OneToOneField(
        Activity,
        on_delete=models.CASCADE,
        related_name='match'
    )
    matched_at = models.DateTimeField(auto_now_add=True)
    attendees = models.ManyToManyField(
        Profile,
        related_name='activity_matches'
    )

    class Meta:
        db_table = 'activity_match'

    def __str__(self):
        return f"Match for {self.activity.title}"


class ActivityMessage(models.Model):
    """
    Chat message for matched activity group chat.
    
    Enables group chat for all attendees of a matched activity.
    Messages are displayed in chronological order.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity_match = models.ForeignKey(
        ActivityMatch,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='sent_activity_messages'
    )
    content = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activity_message'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['activity_match', 'created_at']),
        ]

    def __str__(self):
        return f"Message from {self.sender.user.username} in {self.activity_match.activity.title}"


class FriendRequest(models.Model):
    """
    Friend request between two users.
    
    Tracks when one user sends a friend request to another. When accepted,
    a Friendship is created enabling chat between the users.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='sent_friend_requests'
    )
    to_user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='received_friend_requests'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'friend_request'
        unique_together = ['from_user', 'to_user']
        indexes = [
            models.Index(fields=['from_user', 'status']),
            models.Index(fields=['to_user', 'status']),
        ]

    def __str__(self):
        return f"Friend request from {self.from_user.user.username} to {self.to_user.user.username} ({self.status})"


class Friendship(models.Model):
    """
    Bidirectional friendship between two users.
    
    Created when a FriendRequest is accepted. Enables chat between users.
    Enforces user1.id < user2.id to prevent duplicate friendships.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user1 = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='friendships_as_user1'
    )
    user2 = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='friendships_as_user2'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'friendship'
        constraints = [
            models.UniqueConstraint(fields=['user1', 'user2'], name='unique_friendship'),
            models.CheckConstraint(check=models.Q(user1__lt=models.F('user2')), name='user1_lt_user2'),
        ]
        indexes = [
            models.Index(fields=['user1']),
            models.Index(fields=['user2']),
        ]

    def save(self, *args, **kwargs):
        """Ensure user1.id < user2.id to prevent duplicate friendships."""
        if self.user1_id and self.user2_id and self.user1_id > self.user2_id:
            self.user1, self.user2 = self.user2, self.user1
        super().save(*args, **kwargs)

    def get_friend(self, profile):
        """Return the other user in the friendship."""
        return self.user2 if self.user1 == profile else self.user1

    def __str__(self):
        return f"Friendship: {self.user1.user.username} <-> {self.user2.user.username}"


class FriendMessage(models.Model):
    """
    Chat message between friends.
    
    Enables 1:1 chat between users with a Friendship. Messages are displayed
    in chronological order with read status for tracking unread messages.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    friendship = models.ForeignKey(
        Friendship,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='sent_friend_messages'
    )
    content = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = 'friend_message'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['friendship', 'created_at']),
            models.Index(fields=['sender']),
        ]

    def __str__(self):
        return f"Message from {self.sender.user.username} in friendship {self.friendship.id}"
