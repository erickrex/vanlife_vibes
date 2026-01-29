"""
Matching service for evaluating approval rules and creating matches.

This module handles the core matching logic for VanlifeVibes. When users swipe on
candidates, this service evaluates whether the session's approval rules have been met.

Architecture:
- Triggered by Django signals (see core/signals.py)
- Called automatically when a Swipe is saved
- Evaluates both 'unanimous' and 'threshold' approval rules
- Creates Match objects when rules are satisfied

Note: Earlier versions used PostgreSQL triggers for this functionality, but the
current implementation uses Django signals for better maintainability and testability.
"""
from core.models import GroupMembership, Match, Swipe


def evaluate_match_for_candidate(candidate):
    """Create a match if the candidate meets the session's approval rules."""
    session = candidate.session
    rules = session.rules or {}
    rule_type = rules.get('type')

    if rule_type not in ['unanimous', 'threshold']:
        return None

    total_members = GroupMembership.objects.filter(
        group=session.group,
        status='confirmed',
        is_confirmed=True
    ).count()

    if total_members <= 0:
        return None

    approvals = Swipe.objects.filter(
        candidate=candidate,
        is_like=True
    ).count()

    if rule_type == 'unanimous':
        if approvals != total_members:
            return None

        snapshot = {
            'approvals': approvals,
            'total_members': total_members,
            'rule': rules
        }
    else:
        threshold = rules.get('value')
        if threshold is None:
            return None

        approval_ratio = approvals / total_members
        if approval_ratio < threshold:
            return None

        snapshot = {
            'approvals': approvals,
            'total_members': total_members,
            'threshold': threshold,
            'approval_ratio': approval_ratio,
            'rule': rules
        }

    match, created = Match.objects.get_or_create(
        session=session,
        candidate=candidate,
        defaults={'snapshot': snapshot}
    )

    return match if created else None
