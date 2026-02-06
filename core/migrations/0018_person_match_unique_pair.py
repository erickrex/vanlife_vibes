from django.db import migrations, models


def normalize_person_match_order(apps, schema_editor):
    PersonMatch = apps.get_model('core', 'PersonMatch')
    for match in PersonMatch.objects.all():
        user1_id = str(match.user1_id)
        user2_id = str(match.user2_id)
        if user1_id > user2_id:
            match.user1_id, match.user2_id = match.user2_id, match.user1_id
            match.save(update_fields=['user1', 'user2'])

    seen = {}
    for match in PersonMatch.objects.order_by('-matched_at'):
        key = (match.user1_id, match.user2_id, match.mode)
        if key not in seen:
            seen[key] = match
            continue
        existing = seen[key]
        if existing.is_active and not match.is_active:
            match.delete()
        elif match.is_active and not existing.is_active:
            existing.delete()
            seen[key] = match
        else:
            match.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_remove_profile_visibility'),
    ]

    operations = [
        migrations.RunPython(normalize_person_match_order, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='personmatch',
            constraint=models.UniqueConstraint(
                fields=('user1', 'user2', 'mode'),
                name='uniq_person_match_pair_mode',
            ),
        ),
    ]
