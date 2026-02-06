from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0015_create_plan_message"),
    ]

    operations = [
        migrations.DeleteModel(
            name="UserBlock",
        ),
    ]
