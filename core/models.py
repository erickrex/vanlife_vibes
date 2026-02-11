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


class City(models.Model):
    """City options for location selection."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    state_code = models.CharField(max_length=2)
    country = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        related_name='cities'
    )
    display_name = models.CharField(max_length=120, unique=True)

    class Meta:
        db_table = 'city'
        ordering = ['display_name']
        indexes = [
            models.Index(fields=['display_name']),
            models.Index(fields=['name']),
        ]
        unique_together = ['name', 'state_code', 'country']

    def __str__(self):
        return self.display_name


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

    # Rig status choices for nomad-logistics feature
    RIG_STATUS_CHOICES = [
        ('van', 'Van'),
        ('rv', 'RV'),
        ('truck_camper', 'Truck Camper'),
        ('skoolie', 'Skoolie'),
        ('car', 'Car'),
        ('no_vehicle', 'No Vehicle'),
        ('other', 'Other'),
    ]

    # Social vibe choices for nomad-logistics feature
    SOCIAL_VIBE_CHOICES = [
        ('introvert', 'Introvert'),
        ('balanced', 'Balanced'),
        ('social', 'Social'),
    ]

    # Lifestyle schedule choices for nomad-logistics feature
    LIFESTYLE_SCHEDULE_CHOICES = [
        ('early_bird', 'Early Bird'),
        ('night_owl', 'Night Owl'),
    ]

    # Lifestyle social choices for nomad-logistics feature
    LIFESTYLE_SOCIAL_CHOICES = [
        ('quiet', 'Quiet'),
        ('party', 'Party'),
    ]

    # Lifestyle environment choices for nomad-logistics feature
    LIFESTYLE_ENVIRONMENT_CHOICES = [
        ('outdoors', 'Outdoors'),
        ('city_mix', 'City Mix'),
    ]

    # Pet type choices for nomad-logistics feature
    PET_TYPE_CHOICES = [
        ('dog', 'Dog'),
        ('cat', 'Cat'),
        ('other', 'Other'),
    ]

    # Relationship status choices for friend-intent-filtering feature
    RELATIONSHIP_STATUS_CHOICES = [
        ('single', 'Single'),
        ('in_relationship', 'In a Relationship'),
        ('married', 'Married'),
        ('its_complicated', "It's Complicated"),
        ('prefer_not_to_say', 'Prefer Not to Say'),
    ]

    GENDER_CHOICES = [
        ('man', 'Man'),
        ('woman', 'Woman'),
        ('non_binary', 'Non-binary'),
    ]

    # Looking for friend type choices for friend-intent-filtering feature
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
    has_completed_onboarding = models.BooleanField(default=False)
    gender = models.CharField(
        max_length=20,
        choices=GENDER_CHOICES,
        blank=True,
        null=True
    )
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    cover_url = models.URLField(max_length=500, blank=True, null=True)
    current_location = models.CharField(max_length=100, blank=True)
    home_base = models.CharField(max_length=100, blank=True)
    has_van = models.BooleanField(default=False)
    # Gender preference fields for dating
    interested_in_men = models.BooleanField(default=False)
    interested_in_women = models.BooleanField(default=False)
    interested_in_nonbinary = models.BooleanField(default=False)
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
    # Relationship status fields for friend-intent-filtering feature
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
    # Hobbies - ManyToMany through ProfileHobby (defined later)
    # Note: Location is now managed via InTownWindow model (see in_town_windows relation)
    hobbies = models.ManyToManyField(
        'HobbyTag',
        through='ProfileHobby',
        related_name='profiles'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'profile'

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


class ProfilePhoto(models.Model):
    """Photos uploaded for a user's profile (avatar, cover, or gallery)"""
    PHOTO_TYPE_CHOICES = [
        ('avatar', 'Avatar'),
        ('cover', 'Cover'),
        ('gallery', 'Gallery'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='photos'
    )
    photo_type = models.CharField(max_length=10, choices=PHOTO_TYPE_CHOICES)
    image = models.ImageField(upload_to='profile_photos/%Y/%m/')
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profile_photo'
        ordering = ['display_order', '-created_at']
        indexes = [
            models.Index(fields=['profile', 'photo_type']),
        ]

    def __str__(self):
        return f"{self.photo_type} photo for {self.profile}"


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
    """Location + date range for matching boost (max 3 per user)."""
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


class Prompt(models.Model):
    """Canonical prompt definitions (identifier + question text)."""
    PROMPT_TYPE_CHOICES = [
        ('travel', 'Travel'),
        ('dating', 'Dating'),
        ('friendship', 'Friendship'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prompt_name = models.CharField(max_length=50, unique=True)
    prompt_question = models.CharField(max_length=500)
    prompt_placeholder = models.CharField(max_length=300, blank=True)
    prompt_type = models.CharField(max_length=20, choices=PROMPT_TYPE_CHOICES)

    class Meta:
        db_table = 'prompt'
        ordering = ['prompt_name']

    def __str__(self):
        return f"{self.prompt_name}: {self.prompt_question}"


class ProfilePrompt(models.Model):
    """User's prompt answers (up to 3 per profile)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='prompts'
    )
    prompt = models.ForeignKey(
        Prompt,
        on_delete=models.PROTECT,
        related_name='profile_prompts'
    )
    prompt_answer = models.TextField(max_length=200)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'profile_prompt'
        ordering = ['display_order']
        unique_together = ['profile', 'prompt']

    def __str__(self):
        return f"{self.profile.user.username} - {self.prompt.prompt_question}"


class PersonSwipe(models.Model):
    """Tracks like/pass swipes between users for dating/friends discovery."""
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
    """Mutual match between two users, enabling chat access."""
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
    """Chat message between matched/friended users (text, icebreaker, or mini_card)."""
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('mini_card', 'Mini Card'),
        ('icebreaker', 'Icebreaker'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(
        PersonMatch,
        on_delete=models.CASCADE,
        related_name='messages',
        null=True,
        blank=True
    )
    friendship = models.ForeignKey(
        'Friendship',
        on_delete=models.CASCADE,
        related_name='direct_messages',
        null=True,
        blank=True
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
            models.Index(fields=['friendship', 'created_at']),
            models.Index(fields=['sender']),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(match__isnull=False, friendship__isnull=True) |
                    models.Q(match__isnull=True, friendship__isnull=False)
                ),
                name='direct_message_has_one_parent'
            ),
        ]

    def __str__(self):
        parent = f"match {self.match_id}" if self.match_id else f"friendship {self.friendship_id}"
        return f"Message from {self.sender.user.username} in {parent}"


class UserReport(models.Model):
    """User report for policy violations, stored for moderation review."""
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
















class FriendRequest(models.Model):
    """Friend request between two users. Accepted requests create a Friendship."""
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
    """Bidirectional friendship (user1.id < user2.id to prevent duplicates)."""
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


class AnalyticsEvent(models.Model):
    """Lightweight product analytics event from authenticated clients."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='analytics_events',
    )
    profile = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='analytics_events',
    )
    event_name = models.CharField(max_length=80)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analytics_event'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_name', 'created_at']),
            models.Index(fields=['created_at']),
            models.Index(fields=['user']),
            models.Index(fields=['profile']),
        ]

    def __str__(self):
        return f"{self.event_name} @ {self.created_at.isoformat()}"


class Event(models.Model):
    """Unified event model with direct-join and swipe-to-join modes."""
    JOIN_MODE_CHOICES = [
        ('direct', 'Direct Join'),
        ('swipe', 'Swipe to Join'),
    ]
    
    EVENT_TYPE_CHOICES = [
        # Social/casual
        ('coffee', 'Coffee'),
        ('potluck', 'Potluck'),
        ('campfire', 'Campfire'),
        ('cowork', 'Cowork Session'),
        # Outdoor activities
        ('hiking', 'Hiking'),
        ('sunrise_hike', 'Sunrise Hike'),
        ('sunset', 'Sunset Viewpoint'),
        ('climbing', 'Climbing'),
        ('biking', 'Biking'),
        ('kayaking', 'Kayaking'),
        ('surfing', 'Surfing'),
        ('camping', 'Camping'),
        # Winter sports
        ('snowboarding', 'Snowboarding'),
        ('skiing', 'Skiing'),
        # Pet-related
        ('dog_walk', 'Dog Walk'),
        # Other
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
        ('full', 'Full'),           # For direct mode when max reached
        ('matched', 'Matched'),     # For swipe mode when threshold reached
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='created_events'
    )
    
    # Core fields
    title = models.CharField(max_length=100)
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)
    description = models.TextField(max_length=500, blank=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    
    # Join mechanism
    join_mode = models.CharField(max_length=20, choices=JOIN_MODE_CHOICES)
    
    # Capacity
    spots = models.PositiveIntegerField()  # Total spots including creator
    
    # Timing
    event_date = models.DateField()
    time_window = models.CharField(max_length=20, choices=TIME_WINDOW_CHOICES)
    
    # Location
    location = models.CharField(max_length=100)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'event'
        ordering = ['event_date', 'time_window']
        indexes = [
            models.Index(fields=['status', 'event_date']),
            models.Index(fields=['join_mode', 'status']),
            models.Index(fields=['location']),
            models.Index(fields=['event_type']),
        ]

    def __str__(self):
        return f"{self.title} ({self.event_date})"


class EventAttendee(models.Model):
    """Tracks event attendance (joined/confirmed/declined)."""
    STATUS_CHOICES = [
        ('joined', 'Joined'),
        ('confirmed', 'Confirmed'),
        ('declined', 'Declined'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='attendees'
    )
    user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='event_attendances'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='joined')
    joined_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'event_attendee'
        unique_together = ['event', 'user']

    def __str__(self):
        return f"{self.user.user.username} attending {self.event.title} ({self.status})"


class EventSwipe(models.Model):
    """User swipe on a swipe-mode event. Match triggers when spots fill."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='swipes'
    )
    user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='event_swipes'
    )
    is_like = models.BooleanField()
    swiped_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'event_swipe'
        unique_together = ['event', 'user']

    def __str__(self):
        action = "liked" if self.is_like else "passed on"
        return f"{self.user.user.username} {action} {self.event.title}"


class EventMessage(models.Model):
    """Group chat message for event attendees."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='sent_event_messages'
    )
    content = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'event_message'
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.user.username} in {self.event.title}"



class UserSubscription(models.Model):
    """User subscription status for the freemium model (synced via RevenueCat)."""
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('premium', 'Premium'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.OneToOneField(
        Profile,
        on_delete=models.CASCADE,
        related_name='subscription'
    )
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    revenuecat_app_user_id = models.CharField(max_length=255, blank=True, default='')
    current_period_end = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_subscription'

    @property
    def is_premium(self):
        return self.plan == 'premium' and self.is_active

    def __str__(self):
        return f"{self.profile.user.username} - {self.plan} ({'active' if self.is_active else 'inactive'})"

