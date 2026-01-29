"""
Tests for the matching logic
"""
from django.test import TestCase
from core.models import UserAccount, Group, GroupMembership, Session, Candidate, Swipe, Match
from core.services.matching import evaluate_match_for_candidate
from django.utils import timezone


class MatchingLogicTestCase(TestCase):
    """Test the matching evaluation logic"""

    def setUp(self):
        """Set up test data"""
        # Create users
        self.user1 = UserAccount.objects.create_user(
            username='user1',
            email='user1@test.com',
            password='testpass123'
        )
        self.user2 = UserAccount.objects.create_user(
            username='user2',
            email='user2@test.com',
            password='testpass123'
        )
        self.user3 = UserAccount.objects.create_user(
            username='user3',
            email='user3@test.com',
            password='testpass123'
        )

        # Create group
        self.group = Group.objects.create(
            name='Test Group',
            description='Test group for matching',
            created_by=self.user1
        )

        # Add members
        GroupMembership.objects.create(
            group=self.group,
            user=self.user1,
            role='admin',
            membership_type='invitation',
            status='confirmed',
            is_confirmed=True,
            confirmed_at=timezone.now()
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.user2,
            role='member',
            membership_type='invitation',
            status='confirmed',
            is_confirmed=True,
            confirmed_at=timezone.now()
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.user3,
            role='member',
            membership_type='invitation',
            status='confirmed',
            is_confirmed=True,
            confirmed_at=timezone.now()
        )

    def test_unanimous_rule_all_approve(self):
        """Test unanimous rule when all members approve"""
        # Create session with unanimous rule
        session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'unanimous'},
            status='open'
        )

        # Create candidate
        candidate = Candidate.objects.create(
            session=session,
            label='Test Candidate',
            created_by=self.user1
        )

        # All users swipe like
        Swipe.objects.create(candidate=candidate, user=self.user1, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user2, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user3, is_like=True)

        # Check if match was created by the signal
        match = Match.objects.filter(session=session, candidate=candidate).first()

        # Should create a match
        self.assertIsNotNone(match)
        self.assertEqual(match.candidate, candidate)
        self.assertEqual(match.session, session)
        self.assertEqual(match.snapshot['approvals'], 3)
        self.assertEqual(match.snapshot['total_members'], 3)

    def test_unanimous_rule_one_rejects(self):
        """Test unanimous rule when one member rejects"""
        session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'unanimous'},
            status='open'
        )

        candidate = Candidate.objects.create(
            session=session,
            label='Test Candidate',
            created_by=self.user1
        )

        # Two approve, one rejects
        Swipe.objects.create(candidate=candidate, user=self.user1, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user2, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user3, is_like=False)

        # Evaluate match
        match = evaluate_match_for_candidate(candidate)

        # Should NOT create a match
        self.assertIsNone(match)

    def test_threshold_rule_meets_threshold(self):
        """Test threshold rule when threshold is met"""
        session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'threshold', 'value': 0.67},  # 67% approval needed
            status='open'
        )

        candidate = Candidate.objects.create(
            session=session,
            label='Test Candidate',
            created_by=self.user1
        )

        # 2 out of 3 approve (66.67%)
        Swipe.objects.create(candidate=candidate, user=self.user1, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user2, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user3, is_like=False)

        # Check if match was created - should NOT match (66.67% < 67%)
        match = Match.objects.filter(session=session, candidate=candidate).first()
        self.assertIsNone(match)

        # Now user3 changes to approve
        swipe3 = Swipe.objects.get(candidate=candidate, user=self.user3)
        swipe3.is_like = True
        swipe3.save()

        # Check again - should match now (100% >= 67%)
        match = Match.objects.filter(session=session, candidate=candidate).first()
        self.assertIsNotNone(match)
        self.assertGreaterEqual(match.snapshot['approval_ratio'], 0.67)

    def test_threshold_rule_below_threshold(self):
        """Test threshold rule when threshold is not met"""
        session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'threshold', 'value': 0.75},  # 75% approval needed
            status='open'
        )

        candidate = Candidate.objects.create(
            session=session,
            label='Test Candidate',
            created_by=self.user1
        )

        # 2 out of 3 approve (66.67%)
        Swipe.objects.create(candidate=candidate, user=self.user1, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user2, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user3, is_like=False)

        # Evaluate match
        match = evaluate_match_for_candidate(candidate)

        # Should NOT create a match (66.67% < 75%)
        self.assertIsNone(match)

    def test_match_not_duplicated(self):
        """Test that matches are not duplicated"""
        session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'unanimous'},
            status='open'
        )

        candidate = Candidate.objects.create(
            session=session,
            label='Test Candidate',
            created_by=self.user1
        )

        # All users approve
        Swipe.objects.create(candidate=candidate, user=self.user1, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user2, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user3, is_like=True)

        # Check that match was created by signal
        match1 = Match.objects.filter(session=session, candidate=candidate).first()
        self.assertIsNotNone(match1)

        # Evaluate again - should return None since match already exists
        match2 = evaluate_match_for_candidate(candidate)
        self.assertIsNone(match2)

        # Should only be one match in database
        self.assertEqual(Match.objects.filter(candidate=candidate).count(), 1)

    def test_signal_creates_match_on_swipe(self):
        """Test that Django signal creates match when swipe is saved"""
        session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'unanimous'},
            status='open'
        )

        candidate = Candidate.objects.create(
            session=session,
            label='Test Candidate',
            created_by=self.user1
        )

        # Create swipes one by one - signal should fire after each
        Swipe.objects.create(candidate=candidate, user=self.user1, is_like=True)
        self.assertEqual(Match.objects.filter(candidate=candidate).count(), 0)

        Swipe.objects.create(candidate=candidate, user=self.user2, is_like=True)
        self.assertEqual(Match.objects.filter(candidate=candidate).count(), 0)

        # Last swipe should trigger match creation via signal
        Swipe.objects.create(candidate=candidate, user=self.user3, is_like=True)
        self.assertEqual(Match.objects.filter(candidate=candidate).count(), 1)

    def test_invalid_rule_type(self):
        """Test that invalid rule types don't create matches"""
        session = Session.objects.create(
            group=self.group,
            title='Test Session',
            rules={'type': 'invalid_rule'},
            status='open'
        )

        candidate = Candidate.objects.create(
            session=session,
            label='Test Candidate',
            created_by=self.user1
        )

        # All users approve
        Swipe.objects.create(candidate=candidate, user=self.user1, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user2, is_like=True)
        Swipe.objects.create(candidate=candidate, user=self.user3, is_like=True)

        # Evaluate match
        match = evaluate_match_for_candidate(candidate)

        # Should NOT create a match
        self.assertIsNone(match)
