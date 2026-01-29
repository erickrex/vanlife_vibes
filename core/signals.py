from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import Swipe
from core.services.matching import evaluate_match_for_candidate


@receiver(post_save, sender=Swipe)
def evaluate_match_on_swipe_save(sender, instance, **kwargs):
    """Evaluate session rules whenever a swipe is saved."""
    evaluate_match_for_candidate(instance.candidate)
