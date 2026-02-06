from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0016_remove_user_block"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="profile",
            name="visibility",
        ),
    ]
