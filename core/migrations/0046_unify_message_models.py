# Migration to add friendship FK to DirectMessage for unified messaging

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0045_drop_legacy_plan_activity_tables'),
    ]

    operations = [
        # Add friendship foreign key to DirectMessage
        migrations.AddField(
            model_name='directmessage',
            name='friendship',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='direct_messages',
                to='core.friendship'
            ),
        ),
        # Make match nullable (it was required before)
        migrations.AlterField(
            model_name='directmessage',
            name='match',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='messages',
                to='core.personmatch'
            ),
        ),
        # Add index for friendship + created_at queries
        migrations.AddIndex(
            model_name='directmessage',
            index=models.Index(
                fields=['friendship', 'created_at'],
                name='direct_mess_friends_443e60_idx'
            ),
        ),
        # Add check constraint: exactly one of match or friendship must be set
        migrations.AddConstraint(
            model_name='directmessage',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(('friendship__isnull', True), ('match__isnull', False)),
                    models.Q(('friendship__isnull', False), ('match__isnull', True)),
                    _connector='OR'
                ),
                name='direct_message_has_one_parent'
            ),
        ),
    ]
