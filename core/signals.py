from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import UserAccount, Profile


@receiver(post_save, sender=UserAccount)
def create_profile_on_user_creation(sender, instance, created, **kwargs):
    """Create a Profile with defaults when a new UserAccount is created."""
    if created:
        Profile.objects.create(user=instance)
