from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import UserAccount, Profile


@receiver(post_save, sender=UserAccount)
def create_profile_on_user_creation(sender, instance, created, **kwargs):
    """
    Automatically create a Profile when a new UserAccount is created.
    
    The Profile is created with default values:
    - looking_for_friends = True
    - looking_for_dating = False
    - has_van = False
    """
    if created:
        Profile.objects.create(user=instance)
