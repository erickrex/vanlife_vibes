from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import Swipe, UserAccount, Profile
from core.services.matching import evaluate_match_for_candidate


@receiver(post_save, sender=Swipe)
def evaluate_match_on_swipe_save(sender, instance, **kwargs):
    """Evaluate session rules whenever a swipe is saved."""
    evaluate_match_for_candidate(instance.candidate)


@receiver(post_save, sender=UserAccount)
def create_profile_on_user_creation(sender, instance, created, **kwargs):
    """
    Automatically create a Profile when a new UserAccount is created.
    
    The Profile is created with default values:
    - interested_in_friends = True
    - interested_in_dating = False
    - has_van = False
    
    Validates: Requirements 13.3
    """
    if created:
        Profile.objects.create(user=instance)
