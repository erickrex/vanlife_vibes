# Generated migration to remove FriendMessage model after data migration

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0047_migrate_friend_messages'),
    ]

    operations = [
        migrations.DeleteModel(
            name='FriendMessage',
        ),
    ]
