from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0053_usersubscription_trial_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="city",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="city",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="city",
            name="timezone",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="event",
            name="is_platform_hosted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddIndex(
            model_name="event",
            index=models.Index(fields=["is_platform_hosted", "event_date"], name="event_is_plat_9ef6fa_idx"),
        ),
        migrations.AddConstraint(
            model_name="event",
            constraint=models.UniqueConstraint(
                condition=Q(is_platform_hosted=True),
                fields=("event_date", "location", "join_mode"),
                name="uniq_platform_event_per_city_day_mode",
            ),
        ),
    ]
