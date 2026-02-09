# Generated migration to migrate FriendMessage data to DirectMessage

from django.db import migrations


def migrate_friend_messages_forward(apps, schema_editor):
    """
    Migrate all FriendMessage records to DirectMessage.
    
    FriendMessage fields: id, friendship, sender, content, created_at, is_read
    DirectMessage fields: id, match, friendship, sender, content, message_type, mini_card_data, created_at, is_read
    """
    FriendMessage = apps.get_model('core', 'FriendMessage')
    DirectMessage = apps.get_model('core', 'DirectMessage')
    
    friend_messages = FriendMessage.objects.all()
    
    for fm in friend_messages:
        DirectMessage.objects.create(
            id=fm.id,  # Preserve the original ID
            friendship=fm.friendship,
            match=None,
            sender=fm.sender,
            content=fm.content,
            message_type='text',
            mini_card_data=None,
            created_at=fm.created_at,
            is_read=fm.is_read,
        )
    
    print(f"Migrated {friend_messages.count()} FriendMessage records to DirectMessage")


def migrate_friend_messages_backward(apps, schema_editor):
    """
    Reverse migration: Move DirectMessage records with friendship back to FriendMessage.
    """
    FriendMessage = apps.get_model('core', 'FriendMessage')
    DirectMessage = apps.get_model('core', 'DirectMessage')
    
    # Get all DirectMessages that have a friendship (were originally FriendMessages)
    friendship_messages = DirectMessage.objects.filter(friendship__isnull=False)
    
    for dm in friendship_messages:
        FriendMessage.objects.create(
            id=dm.id,
            friendship=dm.friendship,
            sender=dm.sender,
            content=dm.content,
            created_at=dm.created_at,
            is_read=dm.is_read,
        )
        dm.delete()
    
    print(f"Reverted {friendship_messages.count()} DirectMessage records back to FriendMessage")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0046_unify_message_models'),
    ]

    operations = [
        migrations.RunPython(
            migrate_friend_messages_forward,
            migrate_friend_messages_backward,
        ),
    ]
