"""
Management command to seed the database with detailed persona data.
Creates three complete user profiles: Aaron, Brenda, and Charles.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from core.models import (
    Profile, Vehicle, VehiclePhoto, InTownWindow, 
    ProfilePrompt, Country, Region, HobbyTag
)

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds the database with three detailed personas: Aaron, Brenda, and Charles'

    def handle(self, *args, **options):
        self.stdout.write('Starting persona seeding...')
        
        # Create hobby tags if they don't exist
        self.stdout.write('Creating hobby tags...')
        hobby_data = [
            ('Hiking', 'hiking'),
            ('Photography', 'photography'),
            ('Remote Work', 'remote_work'),
            ('Stargazing', 'stargazing'),
            ('Cooking', 'cooking'),
            ('Dog Training', 'dog_training'),
            ('Camping', 'camping'),
            ('Nature', 'nature'),
            ('Writing', 'writing'),
            ('Reading', 'reading'),
            ('Coffee', 'coffee'),
            ('Surfing', 'surfing'),
            ('Rock Climbing', 'rock_climbing'),
            ('Mountain Biking', 'mountain_biking'),
            ('Yoga', 'yoga'),
        ]
        
        for name, slug in hobby_data:
            HobbyTag.objects.get_or_create(name=name, slug=slug)
        
        # Get or create locations
        usa = Country.objects.get(name='United States')
        
        # Get regions we'll need
        utah = Region.objects.get(name='Utah', country=usa)
        arizona = Region.objects.get(name='Arizona', country=usa)
        new_mexico = Region.objects.get(name='New Mexico', country=usa)
        colorado = Region.objects.get(name='Colorado', country=usa)
        
        # Create Aaron
        self.stdout.write('Creating Aaron...')
        aaron = self._create_aaron(utah, colorado)
        
        # Create Brenda
        self.stdout.write('Creating Brenda...')
        brenda = self._create_brenda(arizona, utah, colorado)
        
        # Create Charles
        self.stdout.write('Creating Charles...')
        charles = self._create_charles(new_mexico, utah, colorado)
        
        self.stdout.write(self.style.SUCCESS(
            f'\nSuccessfully created 3 personas:\n'
            f'  - Aaron (username: aaron, password: pass)\n'
            f'  - Brenda (username: brenda, password: pass)\n'
            f'  - Charles (username: charles, password: pass)'
        ))

    def _create_aaron(self, utah, colorado):
        """Create Aaron - Solo van lifer, remote worker, slow traveler"""
        # Create user
        user, created = User.objects.get_or_create(
            username='aaron',
            email='aaron@example.com',
            defaults={'is_active': True}
        )
        if created:
            user.set_password('pass')
            user.save()
        
        # Create/update profile
        profile, _ = Profile.objects.update_or_create(
            user=user,
            defaults={
                'display_name': 'Aaron',
                'bio': 'Solo van lifer balancing remote work with adventure. Slow travel enthusiast who loves finding quiet spots off the beaten path. Always chasing the perfect sunrise viewpoint. 🌄',
                'age': 35,
                'profile_type': 'van_lifer',
                'intent': 'friends',
                'has_vehicle': True,
                'travel_frequency': 'full_time',
                'now_in': utah,
                'next_week_in': utah,
                'next_month_in': colorado,
                'avatar_url': 'https://i.pravatar.cc/300?img=12',
                'cover_url': 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=400&fit=crop',
            }
        )
        
        # Add hobbies
        hobby_slugs = ['hiking', 'photography', 'remote_work', 'stargazing', 'cooking']
        hobbies = HobbyTag.objects.filter(slug__in=hobby_slugs)
        profile.hobbies.set(hobbies)
        
        # Create vehicle
        vehicle, _ = Vehicle.objects.update_or_create(
            profile=profile,
            defaults={
                'vehicle_type': 'van',
                'make': 'Ford',
                'model': 'Transit',
                'year': 2019,
                'build_status': 'full',
                'nickname': 'The Office',
            }
        )
        
        # Create in-town windows
        today = timezone.now().date()
        
        # This week: Moab, UT
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Moab, UT',
            start_date=today,
            defaults={
                'end_date': today + timedelta(days=7),
            }
        )
        
        # Next week: Still Utah (Needles, Bears Ears)
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Needles District, UT',
            start_date=today + timedelta(days=7),
            defaults={
                'end_date': today + timedelta(days=14),
            }
        )
        
        # Next month: SW Colorado
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Durango, CO',
            start_date=today + timedelta(days=21),
            defaults={
                'end_date': today + timedelta(days=35),
            }
        )
        
        # Create profile prompts
        ProfilePrompt.objects.update_or_create(
            profile=profile,
            prompt_question='perfect_day',
            defaults={
                'prompt_answer': 'Wake up to sunrise over red rocks, coffee with a view, a solid work session, afternoon hike to a hidden spot, and ending with stargazing from camp.',
                'display_order': 1,
            }
        )
        
        ProfilePrompt.objects.update_or_create(
            profile=profile,
            prompt_question='best_adventure',
            defaults={
                'prompt_answer': 'A quiet BLM spot near Valley of the Gods - incredible views, zero crowds, perfect cell signal. Stayed for three weeks.',
                'display_order': 2,
            }
        )
        
        return user

    def _create_brenda(self, arizona, utah, colorado):
        """Create Brenda - RV traveler with dog, basecamp style"""
        # Create user
        user, created = User.objects.get_or_create(
            username='brenda',
            email='brenda@example.com',
            defaults={'is_active': True}
        )
        if created:
            user.set_password('pass')
            user.save()
        
        # Create/update profile
        profile, _ = Profile.objects.update_or_create(
            user=user,
            defaults={
                'display_name': 'Brenda',
                'bio': 'RV life with my adventure pup 🐕 Love basecamping in beautiful spots and exploring dog-friendly trails. Always looking for the best pet-friendly campgrounds and hiking buddies!',
                'age': 38,
                'profile_type': 'van_lifer',
                'intent': 'both',
                'has_vehicle': True,
                'travel_frequency': 'full_time',
                'now_in': arizona,
                'next_week_in': utah,
                'next_month_in': colorado,
                'avatar_url': 'https://i.pravatar.cc/300?img=47',
                'cover_url': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=400&fit=crop',
            }
        )
        
        # Add hobbies
        hobby_slugs = ['hiking', 'photography', 'dog_training', 'camping', 'nature']
        hobbies = HobbyTag.objects.filter(slug__in=hobby_slugs)
        profile.hobbies.set(hobbies)
        
        # Create vehicle
        vehicle, _ = Vehicle.objects.update_or_create(
            profile=profile,
            defaults={
                'vehicle_type': 'rv',
                'make': 'Winnebago',
                'model': 'View',
                'year': 2020,
                'build_status': 'full',
                'nickname': 'Luna\'s Palace',
            }
        )
        
        # Create in-town windows
        today = timezone.now().date()
        
        # This week: Arizona
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Sedona, AZ',
            start_date=today,
            defaults={
                'end_date': today + timedelta(days=7),
            }
        )
        
        # Next week: Moab, UT
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Moab, UT',
            start_date=today + timedelta(days=7),
            defaults={
                'end_date': today + timedelta(days=14),
            }
        )
        
        # Later: SW Colorado
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Durango, CO',
            start_date=today + timedelta(days=21),
            defaults={
                'end_date': today + timedelta(days=35),
            }
        )
        
        # Create profile prompts
        ProfilePrompt.objects.update_or_create(
            profile=profile,
            prompt_question='cant_live_without',
            defaults={
                'prompt_answer': 'My 4-year-old rescue pup Luna! She\'s a trail enthusiast who loves morning hikes and afternoon naps. Heat-sensitive so we plan around cooler hours.',
                'display_order': 1,
            }
        )
        
        ProfilePrompt.objects.update_or_create(
            profile=profile,
            prompt_question='looking_for',
            defaults={
                'prompt_answer': 'Dog-friendly hiking buddies and fellow RVers who know the best pet-friendly spots. Always happy to share campground recommendations!',
                'display_order': 2,
            }
        )
        
        return user

    def _create_charles(self, new_mexico, utah, colorado):
        """Create Charles - Nomadic traveler without vehicle, slow travel style"""
        # Create user
        user, created = User.objects.get_or_create(
            username='charles',
            email='charles@example.com',
            defaults={'is_active': True}
        )
        if created:
            user.set_password('pass')
            user.save()
        
        # Create/update profile
        profile, _ = Profile.objects.update_or_create(
            user=user,
            defaults={
                'display_name': 'Charles',
                'bio': 'Digital nomad exploring the Southwest by bus, train, and occasional rental car. Slow travel advocate - I stay 1-2 weeks per place to really soak it in. Writer, hiker, café enthusiast. ☕📚',
                'age': 32,
                'profile_type': 'nomadic',
                'intent': 'friends',
                'has_vehicle': False,
                'travel_frequency': 'full_time',
                'now_in': new_mexico,
                'next_week_in': new_mexico,
                'next_month_in': utah,
                'avatar_url': 'https://i.pravatar.cc/300?img=33',
                'cover_url': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
            }
        )
        
        # Add hobbies
        hobby_slugs = ['hiking', 'writing', 'photography', 'reading', 'coffee', 'remote_work']
        hobbies = HobbyTag.objects.filter(slug__in=hobby_slugs)
        profile.hobbies.set(hobbies)
        
        # Create in-town windows
        today = timezone.now().date()
        
        # This week: New Mexico
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Santa Fe, NM',
            start_date=today,
            defaults={
                'end_date': today + timedelta(days=14),
            }
        )
        
        # Next month: Moab, UT (arrives later)
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Moab, UT',
            start_date=today + timedelta(days=28),
            defaults={
                'end_date': today + timedelta(days=35),
            }
        )
        
        # Later: Colorado
        InTownWindow.objects.update_or_create(
            profile=profile,
            city_area='Denver, CO',
            start_date=today + timedelta(days=42),
            defaults={
                'end_date': today + timedelta(days=56),
            }
        )
        
        # Create profile prompts
        ProfilePrompt.objects.update_or_create(
            profile=profile,
            prompt_question='van_life_lesson',
            defaults={
                'prompt_answer': 'Slow and intentional. I anchor in walkable towns for 1-2 weeks, work from cafés, then rent a car for 2-3 day nature sprints. Quality over quantity.',
                'display_order': 1,
            }
        )
        
        ProfilePrompt.objects.update_or_create(
            profile=profile,
            prompt_question='ideal_travel_buddy',
            defaults={
                'prompt_answer': 'Morning coffee and trail recommendations, or joining someone for a day hike. I love learning about different travel styles - van life fascinates me!',
                'display_order': 2,
            }
        )
        
        return user
