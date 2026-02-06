"""
Management command to seed 20 varied users traveling around Moab, Utah, Colorado, California, and Nevada.
"""
import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from core.models import Profile, Vehicle, InTownWindow, HobbyTag, Country, Region

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds 20 varied users traveling around Moab, Utah, Colorado, California, and Nevada'

    def handle(self, *args, **options):
        self.stdout.write('Seeding 20 users...')
        
        # Get USA
        usa = Country.objects.get(code='US')
        
        # Get regions
        utah = Region.objects.filter(country=usa, name__icontains='Utah').first()
        colorado = Region.objects.filter(country=usa, name__icontains='Colorado').first()
        california = Region.objects.filter(country=usa, name__icontains='California').first()
        nevada = Region.objects.filter(country=usa, name__icontains='Nevada').first()
        
        regions = [utah, colorado, california, nevada]
        
        # Create hobby tags
        hobby_data = [
            ('Hiking', 'hiking'), ('Photography', 'photography'), ('Rock Climbing', 'rock_climbing'),
            ('Yoga', 'yoga'), ('Cooking', 'cooking'), ('Mountain Biking', 'mountain_biking'),
            ('Surfing', 'surfing'), ('Stargazing', 'stargazing'), ('Reading', 'reading'),
            ('Writing', 'writing'), ('Coffee', 'coffee'), ('Camping', 'camping'),
            ('Remote Work', 'remote_work'), ('Music', 'music'), ('Painting', 'painting'),
        ]
        
        for name, slug in hobby_data:
            HobbyTag.objects.get_or_create(name=name, slug=slug)
        
        # User data
        users_data = [
            ('alex', 'rivers', 'Alex Rivers', 'Living the dream one mile at a time 🚐✨', ['hiking', 'photography', 'camping']),
            ('jordan', 'stone', 'Jordan Stone', 'Chasing sunsets and good vibes', ['rock_climbing', 'yoga', 'cooking']),
            ('casey', 'woods', 'Casey Woods', 'Full-time van lifer | Digital nomad | Adventure seeker', ['mountain_biking', 'surfing', 'music']),
            ('morgan', 'trail', 'Morgan Trail', 'Converting my van, converting my life', ['stargazing', 'reading', 'writing']),
            ('riley', 'summit', 'Riley Summit', 'Weekend warrior exploring the Southwest', ['coffee', 'remote_work', 'photography']),
            ('avery', 'canyon', 'Avery Canyon', 'Remote work + van life = freedom', ['hiking', 'rock_climbing', 'camping']),
            ('quinn', 'desert', 'Quinn Desert', 'Climbing, camping, and coffee ☕🧗', ['yoga', 'cooking', 'painting']),
            ('sage', 'mountain', 'Sage Mountain', 'Documenting life on the road', ['mountain_biking', 'photography', 'camping']),
            ('river', 'valley', 'River Valley', 'Minimalist living, maximum adventure', ['surfing', 'music', 'coffee']),
            ('sky', 'creek', 'Sky Creek', 'Van life newbie learning as I go', ['hiking', 'stargazing', 'remote_work']),
            ('luna', 'ridge', 'Luna Ridge', 'Photographer capturing the nomadic life 📸', ['photography', 'camping', 'writing']),
            ('phoenix', 'mesa', 'Phoenix Mesa', 'Backpacking through the desert', ['hiking', 'rock_climbing', 'reading']),
            ('kai', 'peak', 'Kai Peak', 'Building my dream rig one day at a time', ['cooking', 'music', 'camping']),
            ('rowan', 'dune', 'Rowan Dune', 'Yoga, hiking, and van dwelling 🧘‍♀️', ['yoga', 'hiking', 'stargazing']),
            ('dakota', 'cliff', 'Dakota Cliff', 'Escaping the 9-5, embracing the open road', ['remote_work', 'coffee', 'photography']),
            ('ember', 'grove', 'Ember Grove', 'Solo traveler seeking community', ['hiking', 'writing', 'camping']),
            ('atlas', 'meadow', 'Atlas Meadow', 'Couple living tiny, dreaming big', ['mountain_biking', 'cooking', 'music']),
            ('nova', 'lake', 'Nova Lake', 'Mountain biking and van camping', ['mountain_biking', 'camping', 'photography']),
            ('zephyr', 'forest', 'Zephyr Forest', 'Sustainable living on wheels ♻️', ['hiking', 'yoga', 'cooking']),
            ('willow', 'prairie', 'Willow Prairie', 'Finding myself in the wilderness', ['stargazing', 'reading', 'painting']),
        ]
        
        vehicle_data = [
            ('van', 'Ford', 'Transit'), ('van', 'Mercedes', 'Sprinter'), ('rv', 'Winnebago', 'View'),
            ('van', 'Ram', 'ProMaster'), ('truck_camper', 'Toyota', 'Tacoma'), ('skoolie', 'International', 'School Bus'),
            ('van', 'Chevy', 'Express'), ('trailer', 'Airstream', 'Classic'),
        ]
        
        city_names = {
            utah: ['Moab, UT', 'Canyonlands, UT', 'Arches, UT', 'Capitol Reef, UT'],
            colorado: ['Durango, CO', 'Telluride, CO', 'Boulder, CO', 'Aspen, CO'],
            california: ['Big Sur, CA', 'Joshua Tree, CA', 'Yosemite, CA', 'Lake Tahoe, CA'],
            nevada: ['Las Vegas, NV', 'Reno, NV', 'Valley of Fire, NV', 'Lake Mead, NV'],
        }
        
        today = timezone.now().date()
        
        for first, last, display_name, bio, hobby_slugs in users_data:
            username = f"{first}{last}"
            
            # Create or get user
            user, created = User.objects.get_or_create(
                username=username,
                defaults={'email': f"{username}@example.com"}
            )
            
            if created:
                user.set_password('testpass123')
                user.save()
            
            # Skip if profile exists
            if hasattr(user, 'profile') and user.profile.display_name:
                self.stdout.write(self.style.WARNING(f'User {username} already has complete profile, skipping'))
                continue
            
            # Create or update profile
            has_vehicle = random.choice([True, True, True, False])  # 75% have vehicles
            profile_type = random.choice(['solo', 'couple', 'group'])
            looking_for_dating = random.choice([True, False])
            looking_for_friends = random.choice([True, True, True])  # More likely
            
            profile, _ = Profile.objects.update_or_create(
                user=user,
                defaults={
                    'display_name': display_name,
                    'bio': bio,
                    'profile_type': profile_type,
                    'looking_for_dating': looking_for_dating,
                    'looking_for_friends': looking_for_friends,
                    'interested_in_dating': looking_for_dating,  # Mirror looking_for_dating
                    'relationship_status': random.choice(['single', 'in_relationship', 'married', 'prefer_not_to_say']),
                    'has_van': has_vehicle,
                    'now_in': random.choice(regions),
                    'next_week_in': random.choice(regions),
                    'next_month_in': random.choice(regions),
                }
            )
            
            # Add hobbies
            hobbies = HobbyTag.objects.filter(slug__in=hobby_slugs)
            profile.hobbies.set(hobbies)
            
            # Create vehicle if applicable
            if has_vehicle and not hasattr(profile, 'vehicle'):
                vtype, make, model = random.choice(vehicle_data)
                Vehicle.objects.create(
                    profile=profile,
                    vehicle_type=vtype,
                    make=make,
                    model=model,
                    year=random.randint(2010, 2024),
                    build_status=random.choice(['stock', 'partial', 'full']),
                    nickname=f"The {random.choice(['Wanderer', 'Explorer', 'Nomad', 'Adventurer', 'Roamer'])}"
                )
            
            # Create in-town windows
            InTownWindow.objects.filter(profile=profile).delete()  # Clear existing
            
            current_region = random.choice(regions)
            next_week_region = random.choice(regions)
            next_month_region = random.choice(regions)
            
            InTownWindow.objects.create(
                profile=profile,
                city_area=random.choice(city_names[current_region]),
                start_date=today,
                end_date=today + timedelta(days=14),
            )
            
            InTownWindow.objects.create(
                profile=profile,
                city_area=random.choice(city_names[next_week_region]),
                start_date=today + timedelta(days=14),
                end_date=today + timedelta(days=28),
            )
            
            InTownWindow.objects.create(
                profile=profile,
                city_area=random.choice(city_names[next_month_region]),
                start_date=today + timedelta(days=28),
                end_date=today + timedelta(days=60),
            )
            
            dating = "dating" if looking_for_dating else ""
            friends = "friends" if looking_for_friends else ""
            intent = " & ".join(filter(None, [dating, friends])) or "neither"
            
            self.stdout.write(self.style.SUCCESS(f'✓ {username}: {display_name} ({profile_type}, {intent})'))
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully seeded 20 users!'))
