"""
Migration to consolidate location systems to InTownWindow only.

This migration:
1. Migrates existing now_in_city, next_week_in_city, next_month_in_city data to InTownWindow records
2. Removes the legacy Region FK fields (now_in, next_week_in, next_month_in)
3. Removes the city CharField fields (now_in_city, next_week_in_city, next_month_in_city)
4. Removes the timestamp fields (now_in_updated_at, next_week_in_updated_at, next_month_in_updated_at)
"""

from django.db import migrations
from datetime import date, timedelta


def migrate_city_fields_to_intownwindow(apps, schema_editor):
    """
    Convert existing city fields to InTownWindow records.
    
    Logic:
    - now_in_city -> InTownWindow with start_date=today, end_date=today+6 days
    - next_week_in_city -> InTownWindow with start_date=today+7, end_date=today+13 days
    - next_month_in_city -> InTownWindow with start_date=today+14, end_date=today+44 days
    """
    Profile = apps.get_model('core', 'Profile')
    InTownWindow = apps.get_model('core', 'InTownWindow')
    
    today = date.today()
    
    for profile in Profile.objects.all():
        windows_to_create = []
        
        # Migrate now_in_city
        if profile.now_in_city:
            windows_to_create.append(InTownWindow(
                profile=profile,
                city_area=profile.now_in_city,
                start_date=today,
                end_date=today + timedelta(days=6),
            ))
        
        # Migrate next_week_in_city
        if profile.next_week_in_city:
            windows_to_create.append(InTownWindow(
                profile=profile,
                city_area=profile.next_week_in_city,
                start_date=today + timedelta(days=7),
                end_date=today + timedelta(days=13),
            ))
        
        # Migrate next_month_in_city
        if profile.next_month_in_city:
            windows_to_create.append(InTownWindow(
                profile=profile,
                city_area=profile.next_month_in_city,
                start_date=today + timedelta(days=14),
                end_date=today + timedelta(days=44),
            ))
        
        # Bulk create windows for this profile
        if windows_to_create:
            InTownWindow.objects.bulk_create(windows_to_create)


def reverse_migration(apps, schema_editor):
    """
    Reverse migration - convert InTownWindow back to city fields.
    
    This is a best-effort reverse - we take the first window in each time range.
    """
    Profile = apps.get_model('core', 'Profile')
    InTownWindow = apps.get_model('core', 'InTownWindow')
    
    today = date.today()
    next_week_start = today + timedelta(days=7)
    next_month_start = today + timedelta(days=14)
    
    for profile in Profile.objects.all():
        windows = InTownWindow.objects.filter(profile=profile).order_by('start_date')
        
        for window in windows:
            # Determine which field this window maps to based on start_date
            if window.start_date <= today + timedelta(days=6):
                if not profile.now_in_city:
                    profile.now_in_city = window.city_area
            elif window.start_date <= next_week_start + timedelta(days=6):
                if not profile.next_week_in_city:
                    profile.next_week_in_city = window.city_area
            else:
                if not profile.next_month_in_city:
                    profile.next_month_in_city = window.city_area
        
        profile.save()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_add_analytics_event'),
    ]

    operations = [
        # Step 1: Run data migration to convert city fields to InTownWindow
        migrations.RunPython(migrate_city_fields_to_intownwindow, reverse_migration),
        
        # Step 2: Remove Region FK fields (legacy)
        migrations.RemoveField(
            model_name='profile',
            name='now_in',
        ),
        migrations.RemoveField(
            model_name='profile',
            name='next_week_in',
        ),
        migrations.RemoveField(
            model_name='profile',
            name='next_month_in',
        ),
        
        # Step 3: Remove timestamp fields
        migrations.RemoveField(
            model_name='profile',
            name='now_in_updated_at',
        ),
        migrations.RemoveField(
            model_name='profile',
            name='next_week_in_updated_at',
        ),
        migrations.RemoveField(
            model_name='profile',
            name='next_month_in_updated_at',
        ),
        
        # Step 4: Remove city CharField fields
        migrations.RemoveField(
            model_name='profile',
            name='now_in_city',
        ),
        migrations.RemoveField(
            model_name='profile',
            name='next_week_in_city',
        ),
        migrations.RemoveField(
            model_name='profile',
            name='next_month_in_city',
        ),
    ]
