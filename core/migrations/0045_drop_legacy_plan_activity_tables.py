# Generated migration to drop legacy Plan and Activity tables
# after data has been migrated to the unified Event model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_migrate_activity_messages'),
    ]

    operations = [
        # Drop Activity-related tables first (due to foreign key dependencies)
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS activity_message CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS activity_match_attendees CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS activity_match CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS activity_swipe CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS activity CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        # Drop Plan-related tables
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS plan_message CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS plan_attendee CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS plan CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
