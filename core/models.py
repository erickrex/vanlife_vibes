import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


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
