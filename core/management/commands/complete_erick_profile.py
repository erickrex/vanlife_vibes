"""
Management command to complete Erick's profile with detailed data.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from core.models import (
    Profile, Vehicle, InTownWindow, 
    ProfilePrompt, HobbyTag, Country, Region
)

User = get_user_model()


class Command(BaseCommand):
    help = 'Completes Erick\'s profile with detailed persona data similar to Aaron'

    def handle(self, *args, **options):
        self.stdout.write('Completing Erick\'s profile...')
        
        try:
            user = User.objects.get(username='erick')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('User "erick" not found in database'))
            return
        
        # Get or create profile
        profile, created = Profile.objects.get_or_create(user=user)
        
        # Update profile
        profile.display_name = 'Erick'
        profile.bio = 'Van lifer exploring the Southwest. Love finding remote spots with great views and reliable internet for work. Always down for sunrise hikes and campfire conversations. 🚐✨'
        profile.profile_type = 'van_lifer'
        profile.intent = 'friends'
        profile.has_vehicle = True
        profile.travel_frequency = 'full_time'
        profile.avatar_url = 'https://i.pravatar.cc/300?img=68'
        profile.cover_url = 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800&h=400&fit=crop'
        
        # Get regions for location timing
        usa = Country.objects.get(name='United States')
        utah = Region.objects.get(name='Utah', country=usa)
        colorado = Region.objects.get(name='Colorado', country=usa)
        
        profile.now_in = utah
        profile.next_week_in = utah
        profile.next_month_in = colorado
        profile.save()
        
        self.stdout.write(f'  Updated profile: {profile.display_name}')
        
        # Add hobbies
        hobby_slugs = ['hiking', 'photography', 'remote_work', 'camping', 'cooking']
        hobbies = HobbyTag.objects.filter(slug__in=hobby_slugs)
        profile.hobbies.set(hobbies)
        self.stdout.write(f'  Added {hobbies.count()} hobbies')
        
        # Create or update vehicle
        vehicle, v_created = Vehicle.objects.update_or_create(
            profile=profile,
            defaults={
                'vehicle_type': 'van',
                'make': 'Mercedes',
                'model': 'Sprinter',
                'year': 2021,
                'build_status': 'full',
                'nickname': 'The Explorer',
            }
        )
        self.stdout.write(f'  {"Created" if v_created else "Updated"} vehicle: {vehicle}')
        
        # Clear existing in-town windows
        InTownWindow.objects.filter(profile=profile).delete()
        
        # Create in-town windows
        today = timezone.now().date()
        
        # This week: Moab, UT
        window1 = InTownWindow.objects.create(
            profile=profile,
            city_area='Moab, UT',
            start_date=today,
            end_date=today + timedelta(days=7),
        )
        self.stdout.write(f'  Created window: {window1.city_area} ({window1.start_date} to {window1.end_date})')
        
        # Next month: Colorado
        window2 = InTownWindow.objects.create(
            profile=profile,
            city_area='Boulder, CO',
            start_date=today + timedelta(days=30),
            end_date=today + timedelta(days=44),
        )
        self.stdout.write(f'  Created window: {window2.city_area} ({window2.start_date} to {window2.end_date})')
        
        # Clear existing prompts
        ProfilePrompt.objects.filter(profile=profile).delete()
        
        # Create profile prompts
        prompt1 = ProfilePrompt.objects.create(
            profile=profile,
            prompt_question='perfect_day',
            prompt_answer='Coffee at sunrise, a few hours of focused work, then exploring a new trail or scenic overlook. Ending the day with good food and maybe meeting fellow travelers.',
            display_order=1,
        )
        
        prompt2 = ProfilePrompt.objects.create(
            profile=profile,
            prompt_question='next_destination',
            prompt_answer='Colorado mountains for cooler weather and epic hiking. Thinking about spending time around Boulder and Rocky Mountain National Park.',
            display_order=2,
        )
        
        self.stdout.write(f'  Created 2 profile prompts')
        
        self.stdout.write(self.style.SUCCESS(
            f'\nSuccessfully completed Erick\'s profile!\n'
            f'  - Display name: {profile.display_name}\n'
            f'  - Vehicle: {vehicle.year} {vehicle.make} {vehicle.model}\n'
            f'  - Current location: Moab, UT (next 7 days)\n'
            f'  - Next location: Boulder, CO (in 30 days)\n'
            f'  - Hobbies: {", ".join(hobbies.values_list("name", flat=True))}\n'
            f'  - Profile prompts: 2'
        ))
