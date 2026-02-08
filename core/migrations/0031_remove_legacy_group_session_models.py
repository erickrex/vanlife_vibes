# Generated manually to remove legacy Group/Session/Match models

from django.db import migrations


class Migration(migrations.Migration):
    """
    Remove legacy Group/Session/Match models that are no longer used.
    
    These models were part of the original group decision-making feature
    that has been replaced by the Activities feature.
    """

    dependencies = [
        ('core', '0030_add_profile_gender'),
    ]

    operations = [
        # Drop tables in correct order (respecting foreign key constraints)
        migrations.RunSQL(
            sql=[
                'DROP TABLE IF EXISTS user_answer CASCADE;',
                'DROP TABLE IF EXISTS answer_option CASCADE;',
                'DROP TABLE IF EXISTS question CASCADE;',
                'DROP TABLE IF EXISTS candidate_term CASCADE;',
                'DROP TABLE IF EXISTS term CASCADE;',
                'DROP TABLE IF EXISTS taxonomy CASCADE;',
                'DROP TABLE IF EXISTS match_message CASCADE;',
                'DROP TABLE IF EXISTS match CASCADE;',
                'DROP TABLE IF EXISTS swipe CASCADE;',
                'DROP TABLE IF EXISTS candidate CASCADE;',
                'DROP TABLE IF EXISTS session_shared_group CASCADE;',
                'DROP TABLE IF EXISTS session CASCADE;',
                'DROP TABLE IF EXISTS group_membership CASCADE;',
                'DROP TABLE IF EXISTS app_group CASCADE;',
            ],
            reverse_sql=[],  # No reverse - these tables are gone
        ),
    ]
