"""
Management command to seed 40 diverse users traveling around Utah, Colorado, Nevada, and California.
Creates complete profiles with vehicles, hobbies, in-town windows, and profile prompts.
"""
import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from core.models import (
    Profile, Vehicle, InTownWindow, Prompt, ProfilePrompt,
    Country, Region, HobbyTag
)

User = get_user_model()


# Avatar URLs using pravatar.cc (1-70 range for variety)
AVATAR_URLS = [f'https://i.pravatar.cc/300?img={i}' for i in range(1, 71)]

# Cover photo URLs from Unsplash (van life / travel themed)
COVER_URLS = [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=400&fit=crop',
]

# Hobby tags to create/use
HOBBY_DATA = [
    ('Hiking', 'hiking'), ('Photography', 'photography'), ('Rock Climbing', 'rock_climbing'),
    ('Yoga', 'yoga'), ('Cooking', 'cooking'), ('Mountain Biking', 'mountain_biking'),
    ('Surfing', 'surfing'), ('Stargazing', 'stargazing'), ('Reading', 'reading'),
    ('Writing', 'writing'), ('Coffee', 'coffee'), ('Camping', 'camping'),
    ('Remote Work', 'remote_work'), ('Music', 'music'), ('Painting', 'painting'),
    ('Dog Training', 'dog_training'), ('Kayaking', 'kayaking'), ('Fishing', 'fishing'),
    ('Birdwatching', 'birdwatching'), ('Meditation', 'meditation'),
]

# City areas by state
CITY_AREAS = {
    'Utah': [
        'Moab, UT', 'Canyonlands, UT', 'Arches NP, UT', 'Capitol Reef, UT',
        'Zion NP, UT', 'Bryce Canyon, UT', 'Salt Lake City, UT', 'Park City, UT',
        'St. George, UT', 'Kanab, UT', 'Goblin Valley, UT', 'Bears Ears, UT',
    ],
    'Colorado': [
        'Durango, CO', 'Telluride, CO', 'Boulder, CO', 'Aspen, CO',
        'Denver, CO', 'Colorado Springs, CO', 'Ouray, CO', 'Crested Butte, CO',
        'Steamboat Springs, CO', 'Estes Park, CO', 'Glenwood Springs, CO',
    ],
    'California': [
        'Big Sur, CA', 'Joshua Tree, CA', 'Yosemite, CA', 'Lake Tahoe, CA',
        'San Diego, CA', 'Santa Barbara, CA', 'Mammoth Lakes, CA', 'Death Valley, CA',
        'Sequoia NP, CA', 'Bishop, CA', 'Morro Bay, CA', 'Mendocino, CA',
    ],
    'Nevada': [
        'Las Vegas, NV', 'Reno, NV', 'Valley of Fire, NV', 'Lake Mead, NV',
        'Great Basin NP, NV', 'Black Rock Desert, NV', 'Red Rock Canyon, NV',
    ],
}

# Vehicle configurations
VEHICLE_CONFIGS = [
    ('van', 'Ford', 'Transit', ['The Office', 'Wanderer', 'Freedom Machine']),
    ('van', 'Mercedes', 'Sprinter', ['Sprinter Life', 'The Beast', 'Home Base']),
    ('van', 'Ram', 'ProMaster', ['ProHome', 'The Nomad', 'Rolling Thunder']),
    ('van', 'Chevy', 'Express', ['Express Lane', 'The Cruiser', 'Roadrunner']),
    ('rv', 'Winnebago', 'View', ['The View', 'Big Bertha', 'Road Palace']),
    ('rv', 'Airstream', 'Interstate', ['Silver Bullet', 'The Airstream', 'Shiny']),
    ('truck_camper', 'Toyota', 'Tacoma', ['Taco Truck', 'The Taco', 'Trailblazer']),
    ('truck_camper', 'Ford', 'F-150', ['The Truck', 'Basecamp', 'Adventure Rig']),
    ('skoolie', 'International', 'School Bus', ['The Skoolie', 'Big Yellow', 'Bus Life']),
    ('trailer', 'Airstream', 'Bambi', ['Little Bambi', 'The Trailer', 'Tiny Home']),
    ('car', 'Subaru', 'Outback', ['Subie', 'The Outback', 'Trail Runner']),
]

# 40 user personas with detailed info
USER_PERSONAS = [
    # Solo travelers - dating focused
    ('aaron', 'Aaron Mitchell', 'man', 35, 'Solo van lifer balancing remote work with adventure. Slow travel enthusiast who loves finding quiet spots off the beaten path. 🌄', 'solo', True, False, ['hiking', 'photography', 'remote_work', 'stargazing']),
    ('maya', 'Maya Chen', 'woman', 29, 'Digital nomad chasing sunsets and good coffee. Currently exploring the Southwest one canyon at a time. ☕🏜️', 'solo', True, False, ['photography', 'yoga', 'coffee', 'hiking']),
    ('jake', 'Jake Thompson', 'man', 32, 'Full-time van dweller and rock climbing addict. If I\'m not working, I\'m probably on a wall somewhere.', 'solo', True, False, ['rock_climbing', 'camping', 'cooking', 'music']),
    ('sofia', 'Sofia Rodriguez', 'woman', 27, 'Adventure photographer living the van life dream. Always looking for the next epic shot and good company.', 'solo', True, False, ['photography', 'hiking', 'surfing', 'yoga']),
    ('marcus', 'Marcus Williams', 'man', 38, 'Retired early to live on the road. Now I wake up to a new view every week. Best decision ever.', 'solo', True, False, ['fishing', 'stargazing', 'reading', 'cooking']),
    ('emma', 'Emma Davis', 'woman', 31, 'Writer and wanderer. My van is my mobile office and my home. Currently working on my first novel.', 'solo', True, False, ['writing', 'reading', 'coffee', 'hiking']),
    
    # Solo travelers - friends focused
    ('river', 'River Stone', 'non_binary', 28, 'Nomadic soul seeking community on the road. Let\'s share a campfire and swap stories! 🔥', 'solo', False, True, ['camping', 'music', 'cooking', 'stargazing']),
    ('alex', 'Alex Rivera', 'man', 34, 'Weekend warrior turned full-timer. Looking for hiking buddies and coffee companions.', 'solo', False, True, ['hiking', 'mountain_biking', 'coffee', 'photography']),
    ('luna', 'Luna Park', 'woman', 26, 'Yoga instructor on wheels. Teaching classes wherever I park. Namaste from the road! 🧘‍♀️', 'solo', False, True, ['yoga', 'meditation', 'hiking', 'cooking']),
    ('kai', 'Kai Nakamura', 'man', 30, 'Surf bum with a van. Chasing waves up and down the coast. Always down for a dawn patrol.', 'solo', False, True, ['surfing', 'photography', 'camping', 'music']),
    
    # Solo travelers - both dating and friends
    ('brenda', 'Brenda Foster', 'woman', 38, 'RV life with my adventure pup Luna 🐕 Love basecamping and exploring dog-friendly trails!', 'solo', True, True, ['hiking', 'photography', 'dog_training', 'camping']),
    ('charles', 'Charles Wright', 'man', 32, 'Digital nomad exploring by bus and rental car. Slow travel advocate - quality over quantity.', 'solo', True, True, ['writing', 'photography', 'reading', 'coffee']),
    ('diana', 'Diana Reyes', 'woman', 33, 'Former tech worker, now full-time explorer. My van is smaller than my old apartment and I love it.', 'solo', True, True, ['remote_work', 'hiking', 'yoga', 'cooking']),
    ('ethan', 'Ethan Brooks', 'man', 29, 'Mountain biker and van lifer. Building trails and friendships wherever I go.', 'solo', True, True, ['mountain_biking', 'camping', 'photography', 'music']),
    ('fiona', 'Fiona O\'Brien', 'woman', 36, 'Irish lass exploring America one national park at a time. Always up for a pint and a hike!', 'solo', True, True, ['hiking', 'photography', 'music', 'camping']),
    ('gabriel', 'Gabriel Santos', 'man', 31, 'Chef turned van lifer. Cooking gourmet meals in my tiny kitchen. Food is love! 🍳', 'solo', True, True, ['cooking', 'hiking', 'photography', 'camping']),
    
    # Couples
    ('sam_taylor', 'Sam & Taylor', 'woman', 34, 'Couple living the dream in our converted Sprinter. Two years on the road and counting!', 'couple', False, True, ['hiking', 'photography', 'cooking', 'stargazing']),
    ('mike_sarah', 'Mike & Sarah', 'man', 37, 'Adventure couple with two dogs. We quit our jobs to travel and never looked back.', 'couple', False, True, ['hiking', 'camping', 'dog_training', 'kayaking']),
    ('jordan_casey', 'Jordan & Casey', 'non_binary', 29, 'Queer couple exploring the Southwest. Our van is small but our love is big! 🏳️‍🌈', 'couple', False, True, ['rock_climbing', 'yoga', 'photography', 'music']),
    ('ben_lisa', 'Ben & Lisa', 'man', 42, 'Empty nesters on a new adventure. Sold the house, bought an RV, no regrets.', 'couple', False, True, ['birdwatching', 'hiking', 'photography', 'reading']),
    
    # More solo travelers with varied intents
    ('harper', 'Harper Quinn', 'woman', 25, 'Recent grad living in my Subaru. Proving you don\'t need a fancy rig to live the dream.', 'solo', True, True, ['hiking', 'camping', 'photography', 'yoga']),
    ('noah', 'Noah Kim', 'man', 28, 'Software engineer working remotely from national parks. Living my best life.', 'solo', True, False, ['remote_work', 'hiking', 'photography', 'coffee']),
    ('olivia', 'Olivia Martinez', 'woman', 30, 'Travel nurse funding my van life adventures. New assignment, new views every few months.', 'solo', True, True, ['yoga', 'hiking', 'cooking', 'reading']),
    ('liam', 'Liam O\'Connor', 'man', 35, 'Irish musician touring the US in my van. Catch me busking in a town near you! 🎸', 'solo', False, True, ['music', 'camping', 'coffee', 'photography']),
    ('ava', 'Ava Thompson', 'woman', 27, 'Former corporate lawyer, now full-time adventurer. Best career change ever.', 'solo', True, False, ['hiking', 'rock_climbing', 'yoga', 'reading']),
    ('mason', 'Mason Lee', 'man', 33, 'Photographer documenting van life culture. Your story could be my next project!', 'solo', False, True, ['photography', 'hiking', 'coffee', 'writing']),
    ('isabella', 'Isabella Rossi', 'woman', 31, 'Italian chef cooking my way across America. Van life + food blog = dream job.', 'solo', True, True, ['cooking', 'photography', 'hiking', 'yoga']),
    ('jackson', 'Jackson Reed', 'man', 40, 'Retired firefighter living simply on the road. Peace, quiet, and mountain views.', 'solo', False, True, ['fishing', 'hiking', 'stargazing', 'reading']),
    ('mia', 'Mia Patel', 'woman', 26, 'Aspiring van lifer currently in a Prius. Saving up for my dream rig!', 'solo', True, True, ['yoga', 'hiking', 'meditation', 'photography']),
    ('william', 'William Chen', 'man', 36, 'Tech entrepreneur who sold his startup to travel. Now my office is wherever I park.', 'solo', True, False, ['remote_work', 'hiking', 'photography', 'coffee']),
    
    # More diverse profiles
    ('zoe', 'Zoe Anderson', 'woman', 29, 'Artist painting landscapes from my van. Every sunset is a new canvas. 🎨', 'solo', True, True, ['painting', 'hiking', 'photography', 'yoga']),
    ('james', 'James Wilson', 'man', 44, 'Veteran finding peace on the road. The open highway is my therapy.', 'solo', False, True, ['hiking', 'fishing', 'stargazing', 'meditation']),
    ('chloe', 'Chloe Brown', 'woman', 24, 'Just graduated and hitting the road! Learning van life as I go.', 'solo', True, True, ['hiking', 'photography', 'music', 'camping']),
    ('daniel', 'Daniel Garcia', 'man', 31, 'Climbing bum with a van. Red rocks are my playground. 🧗', 'solo', True, False, ['rock_climbing', 'hiking', 'camping', 'yoga']),
    ('grace', 'Grace Kim', 'woman', 35, 'Former teacher, now teaching yoga from my van. Life is the best classroom.', 'solo', False, True, ['yoga', 'meditation', 'hiking', 'reading']),
    ('henry', 'Henry Taylor', 'man', 39, 'Birder and nature photographer. My van takes me to the best spots.', 'solo', False, True, ['birdwatching', 'photography', 'hiking', 'camping']),
    ('lily', 'Lily Nguyen', 'woman', 28, 'Coffee snob and van dweller. I\'ve rated every coffee shop from here to the coast. ☕', 'solo', True, True, ['coffee', 'photography', 'yoga', 'hiking']),
    ('owen', 'Owen Murphy', 'man', 30, 'Irish lad on a year-long US road trip. Making friends and memories!', 'solo', True, True, ['hiking', 'music', 'photography', 'camping']),
    ('scarlett', 'Scarlett James', 'woman', 32, 'Podcast host interviewing van lifers across America. Got a story? Let\'s chat!', 'solo', False, True, ['writing', 'photography', 'coffee', 'hiking']),
    ('leo', 'Leo Fernandez', 'man', 27, 'Skateboarder and van lifer. Hitting every skate park on the West Coast.', 'solo', True, True, ['music', 'photography', 'camping', 'coffee']),
]


# Prompt answers by type
TRAVEL_PROMPT_ANSWERS = {
    'next_stop_journey': [
        'Southern Utah - chasing red rock sunsets and quiet BLM spots',
        'The Rockies for some high altitude adventures',
        'California coast for some beach time and surfing',
        'Nevada desert for stargazing and solitude',
        'Colorado mountains for hiking and hot springs',
        'Moab area - can\'t get enough of those canyons',
        'Lake Tahoe region for summer vibes',
        'Joshua Tree for some desert magic',
    ],
    'always_down_team_up': [
        'sunrise hikes and coffee with a view',
        'finding the best local taco spots',
        'impromptu photo shoots with epic backdrops',
        'campfire hangs and stargazing sessions',
        'exploring hidden hot springs',
        'mountain biking new trails',
        'sunset viewpoint hunting',
        'coffee shop hopping in small towns',
    ],
    'looking_for_travel_buddy': [
        'explore all the slot canyons in Utah',
        'drive the Pacific Coast Highway',
        'summit some Colorado 14ers',
        'find every hot spring in the Southwest',
        'photograph the Milky Way in dark sky parks',
        'kayak the Colorado River',
        'bike the White Rim Trail',
        'explore Death Valley in winter',
    ],
    'best_hidden_gem': [
        'A quiet BLM spot near Valley of the Gods - incredible views, zero crowds',
        'A secret hot spring in Nevada with mountain views',
        'A free campsite in the Sierras with a private lake view',
        'A canyon in Utah that\'s not on any map',
        'A beach in Big Sur that locals keep secret',
        'A mountain meadow in Colorado with wildflowers everywhere',
        'A desert oasis in Joshua Tree area',
        'A riverside spot in Sedona with no tourists',
    ],
    'perfect_vanlife_meetup': [
        'A vans-and-coffee morning in a national park lot',
        'Potluck dinner at a beach camp with sunset views',
        'Group hike followed by campfire stories',
        'Coffee and trail planning at a scenic overlook',
        'Sunrise yoga session with fellow travelers',
        'Impromptu music jam around the fire',
        'Group stargazing in a dark sky area',
        'Convoy to a hidden hot spring',
    ],
    'best_part_meeting_vanlifers': [
        'Trading renovation tips and learning from different builds',
        'Hearing wild travel stories around the campfire',
        'The instant understanding of this crazy lifestyle',
        'Making friends who get why you live this way',
        'Sharing favorite spots and hidden gems',
        'The spontaneous adventures that happen',
        'Learning new skills from fellow travelers',
        'Building a community that spans the country',
    ],
}

DATING_PROMPT_ANSWERS = {
    'ideal_vanlife_date': [
        'Stargazing by a campfire after cooking dinner together',
        'Sunrise hike followed by coffee with a view',
        'Beach sunset with wine and good conversation',
        'Exploring a new town and finding the best local food',
        'Hot springs under the stars',
        'Cooking a fancy meal in my tiny kitchen',
        'Watching the sunset from a scenic overlook',
        'Dancing to music under the Milky Way',
    ],
    'well_get_along_if': [
        'chasing sunsets and waking up for sunrises',
        'morning hikes and afternoon naps',
        'coffee brewed over a camp stove',
        'spontaneous road trip detours',
        'quiet mornings and campfire evenings',
        'exploring without a strict itinerary',
        'good food and better conversation',
        'adventure during the day, cozy evenings',
    ],
    'impress_me_road_trip': [
        'curate the perfect driving playlist',
        'know a secret free campsite with amazing views',
        'brew amazing pour-over coffee at sunrise',
        'be spontaneous about changing plans',
        'cook something delicious on a camp stove',
        'find the best local food spots',
        'know all the constellations',
        'be comfortable with comfortable silence',
    ],
    'quickest_way_to_heart': [
        'making s\'mores under the Milky Way',
        'being calm during unexpected van troubles',
        'surprising me with a scenic detour',
        'cooking breakfast while I sleep in',
        'finding the perfect sunset spot',
        'being genuinely curious about my stories',
        'sharing your favorite hidden gems',
        'making me laugh on a long drive',
    ],
    'dating_me_means': [
        'accepting that my van is my home and I love it',
        'being okay with campground Wi-Fi dates',
        'understanding I own more hiking boots than fancy shoes',
        'spontaneous adventures are the norm',
        'home is wherever we park',
        'showers are sometimes optional',
        'the best dates involve nature',
        'my dog/cat comes everywhere with us',
    ],
    'swipe_right_if': [
        'you also love national parks and hiking',
        'skinny-dipping in hot springs sounds fun',
        'you appreciate a good road trip playlist',
        'you\'re comfortable with minimalist living',
        'adventure is your love language',
        'you can appreciate a good sunset',
        'you\'re not afraid of dirt and dust',
        'you value experiences over things',
    ],
    'most_romantic_spot': [
        'A hidden beach cove in Big Sur with nobody around',
        'A hot spring in the mountains under the stars',
        'A cliff overlooking the Grand Canyon at sunset',
        'A meadow in the Sierras with wildflowers',
        'A quiet spot in Zion with canyon views',
        'A beach in Baja with perfect sunsets',
        'A mountain lake in Colorado at sunrise',
        'A desert camp in Joshua Tree under the Milky Way',
    ],
}

FRIENDSHIP_PROMPT_ANSWERS = {
    'friend_need': [
        'watch your van while you take a supply run',
        'start a campfire and share some stories',
        'go on a spontaneous hike',
        'help with van repairs or troubleshooting',
        'explore a new area together',
        'share a meal and good conversation',
        'be your hiking buddy for the day',
        'jam on guitar around the fire',
    ],
    'go_to_campfire_story': [
        'that time I got my van stuck in mud with cows watching',
        'the bear encounter that made me rethink food storage',
        'when I accidentally camped on private land and met the nicest rancher',
        'the epic sunset that made me quit my job',
        'my first week of van life and everything that went wrong',
        'the time I drove 100 miles for a hot spring that was closed',
        'meeting my best van life friends at a random campsite',
        'the storm that tested my van build',
    ],
    'best_vanlife_hack': [
        'using fairy lights as a cozy nightlight',
        'a secret chocolate supply hidden from myself',
        'magnetic spice jars on the wall',
        'a collapsible everything - bowls, cups, you name it',
        'baby wipes are your best friend',
        'always keep a full water jug for emergencies',
        'a good headlamp changes everything',
        'befriend locals for the best spot recommendations',
    ],
    'friends_know_me_as': [
        'the early-riser sunrise chaser',
        'the one who can fix anything with duct tape',
        'the laid-back hammock enthusiast',
        'the one with the best snack stash',
        'the spontaneous adventure planner',
        'the campfire chef',
        'the one who knows all the free camping spots',
        'the eternal optimist even when things break',
    ],
    'instant_friends_if': [
        'you wave at other van dwellers on the highway',
        'you can name at least 5 constellations',
        'you don\'t mind a little sand in your bed',
        'you appreciate a good sunset as much as I do',
        'you\'ve ever driven hours for a good taco',
        'you understand the joy of a hot shower after days without',
        'you\'ve named your vehicle',
        'you think "home" is wherever you park',
    ],
    'motto_i_travel_by': [
        'Adventure before comfort',
        'Leave no trace, take only memories',
        'Home is where I park it',
        'The journey is the destination',
        'Less stuff, more life',
        'Say yes to detours',
        'Collect moments, not things',
        'The best views come after the hardest climbs',
    ],
    'traveling_with_my_pet': [
        'that every window is a TV for my dog',
        'patience is everything when finding pet-friendly spots',
        'dogs make the best co-pilots and conversation starters',
        'my cat is more adaptable than I expected',
        'pet-friendly doesn\'t always mean pet-welcoming',
        'the best adventures are shared with four-legged friends',
        'my dog has more Instagram followers than me now',
        'finding dog-friendly hikes is an art form',
    ],
}


class Command(BaseCommand):
    help = 'Seeds 40 diverse users traveling around Utah, Colorado, Nevada, and California'

    def add_arguments(self, parser):
        parser.add_argument(
            '--delete-existing',
            action='store_true',
            help='Delete all existing users (except superusers) before seeding',
        )

    def handle(self, *args, **options):
        if options['delete_existing']:
            self.stdout.write('Deleting existing non-superuser accounts...')
            deleted_count = User.objects.filter(is_superuser=False).delete()[0]
            self.stdout.write(self.style.WARNING(f'Deleted {deleted_count} records'))

        self.stdout.write('Starting user seeding...')
        
        # Create hobby tags
        self.stdout.write('Creating hobby tags...')
        for name, slug in HOBBY_DATA:
            HobbyTag.objects.get_or_create(name=name, slug=slug)
        
        # Get USA and regions
        usa = Country.objects.get(code='US')
        regions = {
            'Utah': Region.objects.get(country=usa, name='Utah'),
            'Colorado': Region.objects.get(country=usa, name='Colorado'),
            'California': Region.objects.get(country=usa, name='California'),
            'Nevada': Region.objects.get(country=usa, name='Nevada'),
        }
        
        # Load prompts
        prompts = {p.prompt_name: p for p in Prompt.objects.all()}
        
        today = timezone.now().date()
        created_count = 0
        
        for i, persona in enumerate(USER_PERSONAS):
            username, display_name, gender, age, bio, profile_type, looking_dating, looking_friends, hobby_slugs = persona
            
            # Create user
            user, created = User.objects.get_or_create(
                username=username,
                defaults={'email': f'{username}@example.com', 'is_active': True}
            )
            if created:
                user.set_password('testpass123')
                user.save()
            
            # Skip if profile already complete
            if hasattr(user, 'profile') and user.profile.has_completed_onboarding:
                self.stdout.write(self.style.WARNING(f'Skipping {username} - already complete'))
                continue
            
            # Random selections
            state_names = list(regions.keys())
            now_state = random.choice(state_names)
            next_week_state = random.choice(state_names)
            next_month_state = random.choice(state_names)
            
            has_vehicle = random.random() < 0.85  # 85% have vehicles
            has_pets = random.random() < 0.3  # 30% have pets
            
            # Create/update profile
            profile, _ = Profile.objects.update_or_create(
                user=user,
                defaults={
                    'display_name': display_name,
                    'bio': bio,
                    'gender': gender,
                    'profile_type': profile_type,
                    'looking_for_dating': looking_dating,
                    'looking_for_friends': looking_friends,
                    'has_completed_onboarding': True,
                    'has_van': has_vehicle,
                    'avatar_url': AVATAR_URLS[i % len(AVATAR_URLS)],
                    'cover_url': random.choice(COVER_URLS),
                    # Location regions
                    'now_in': regions[now_state],
                    'next_week_in': regions[next_week_state],
                    'next_month_in': regions[next_month_state],
                    # City strings
                    'now_in_city': random.choice(CITY_AREAS[now_state]),
                    'next_week_in_city': random.choice(CITY_AREAS[next_week_state]),
                    'next_month_in_city': random.choice(CITY_AREAS[next_month_state]),
                    # Travel & lifestyle
                    'travel_status': random.choice(['full-time', 'part-time', 'weekender', 'aspiring']),
                    'travel_pace': random.choice(['slow', 'mixed', 'fast']),
                    'work_status': random.choice(['remote_worker', 'retired', 'seasonal_worker', 'other']),
                    'rig_status': random.choice(['van', 'rv', 'truck_camper', 'skoolie', 'car', 'no_vehicle']) if not has_vehicle else random.choice(['van', 'rv', 'truck_camper', 'skoolie']),
                    'social_vibe': random.choice(['introvert', 'balanced', 'social']),
                    'meetup_interest': random.choice(['actively_looking', 'open_to_it', 'selective']),
                    'lifestyle_schedule': random.choice(['early_bird', 'night_owl']),
                    'lifestyle_social': random.choice(['quiet', 'party']),
                    'lifestyle_environment': random.choice(['outdoors', 'city_mix']),
                    'has_pets': has_pets,
                    'pet_type': random.choice(['dog', 'cat']) if has_pets else None,
                    'pet_friendly_only': has_pets and random.random() < 0.5,
                    'relationship_status': random.choice(['single', 'in_relationship', 'married', 'prefer_not_to_say']) if profile_type == 'solo' else 'in_relationship',
                    'looking_for_friend_type': random.choice(['any', 'singles_only', 'couples_only', 'no_preference']),
                    # Gender preferences for dating
                    'interested_in_men': looking_dating and (gender == 'woman' or gender == 'non_binary' or random.random() < 0.3),
                    'interested_in_women': looking_dating and (gender == 'man' or gender == 'non_binary' or random.random() < 0.3),
                    'interested_in_nonbinary': looking_dating and random.random() < 0.5,
                }
            )
            
            # Set hobbies
            hobbies = HobbyTag.objects.filter(slug__in=hobby_slugs)
            profile.hobbies.set(hobbies)
            
            # Create vehicle if applicable
            if has_vehicle:
                Vehicle.objects.filter(profile=profile).delete()
                vtype, make, model, nicknames = random.choice(VEHICLE_CONFIGS)
                Vehicle.objects.create(
                    profile=profile,
                    vehicle_type=vtype,
                    make=make,
                    model=model,
                    year=random.randint(2015, 2024),
                    build_status=random.choice(['stock', 'partial', 'full']),
                    nickname=random.choice(nicknames),
                )
            
            # Create in-town windows
            InTownWindow.objects.filter(profile=profile).delete()
            
            InTownWindow.objects.create(
                profile=profile,
                city_area=random.choice(CITY_AREAS[now_state]),
                start_date=today,
                end_date=today + timedelta(days=random.randint(7, 14)),
            )
            InTownWindow.objects.create(
                profile=profile,
                city_area=random.choice(CITY_AREAS[next_week_state]),
                start_date=today + timedelta(days=14),
                end_date=today + timedelta(days=28),
            )
            InTownWindow.objects.create(
                profile=profile,
                city_area=random.choice(CITY_AREAS[next_month_state]),
                start_date=today + timedelta(days=28),
                end_date=today + timedelta(days=60),
            )
            
            # Create profile prompts (2-3 per user)
            ProfilePrompt.objects.filter(profile=profile).delete()
            
            prompt_count = 0
            # Add a travel prompt
            if prompts and 'next_stop_journey' in prompts:
                travel_prompt_name = random.choice(list(TRAVEL_PROMPT_ANSWERS.keys()))
                if travel_prompt_name in prompts:
                    ProfilePrompt.objects.create(
                        profile=profile,
                        prompt=prompts[travel_prompt_name],
                        prompt_answer=random.choice(TRAVEL_PROMPT_ANSWERS[travel_prompt_name]),
                        display_order=prompt_count,
                    )
                    prompt_count += 1
            
            # Add dating or friendship prompt based on intent
            if looking_dating and prompts:
                dating_prompt_name = random.choice(list(DATING_PROMPT_ANSWERS.keys()))
                if dating_prompt_name in prompts:
                    ProfilePrompt.objects.create(
                        profile=profile,
                        prompt=prompts[dating_prompt_name],
                        prompt_answer=random.choice(DATING_PROMPT_ANSWERS[dating_prompt_name]),
                        display_order=prompt_count,
                    )
                    prompt_count += 1
            
            if looking_friends and prompts:
                friend_prompt_name = random.choice(list(FRIENDSHIP_PROMPT_ANSWERS.keys()))
                if friend_prompt_name in prompts:
                    ProfilePrompt.objects.create(
                        profile=profile,
                        prompt=prompts[friend_prompt_name],
                        prompt_answer=random.choice(FRIENDSHIP_PROMPT_ANSWERS[friend_prompt_name]),
                        display_order=prompt_count,
                    )
            
            intent = []
            if looking_dating:
                intent.append('dating')
            if looking_friends:
                intent.append('friends')
            intent_str = ' & '.join(intent) or 'neither'
            
            self.stdout.write(self.style.SUCCESS(
                f'✓ {username}: {display_name} ({profile_type}, {intent_str}) - {profile.now_in_city}'
            ))
            created_count += 1
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully seeded {created_count} users!'))
        self.stdout.write('All users have password: testpass123')
