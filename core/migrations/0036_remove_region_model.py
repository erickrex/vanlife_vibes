"""
Migration to remove the Region model.

The Region model is no longer used - location is now managed via InTownWindow
with city names stored directly as strings.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0035_consolidate_location_to_intownwindow'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Region',
        ),
    ]
