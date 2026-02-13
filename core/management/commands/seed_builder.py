"""
Management command to seed builder marketplace listings from
core/fixtures/builder_utah_marketplace_seed.json.
"""
import json
import os
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from core.models import BuilderListing, City, Profile, UserSubscription

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed builder marketplace from core/fixtures/builder_utah_marketplace_seed.json'

    def handle(self, *args, **options):
        json_path = os.path.join('core', 'fixtures', 'builder_utah_marketplace_seed.json')
        if not os.path.exists(json_path):
            self.stderr.write(self.style.ERROR(f'File not found: {json_path}'))
            return

        with open(json_path, 'r') as f:
            data = json.load(f)

        # 1. Create builder users
        self.stdout.write('Creating builder users...')
        for u in data.get('users', []):
            user, created = User.objects.get_or_create(
                username=u['username'],
                defaults={'email': u['email'], 'is_active': True},
            )
            if created:
                user.set_password(u['password'])
                user.save()

            profile, _ = Profile.objects.update_or_create(
                user=user,
                defaults={
                    'display_name': u.get('display_name', ''),
                    'bio': u.get('bio', ''),
                    'avatar_url': u.get('avatar_url'),
                    'current_location': u.get('current_location', ''),
                    'has_completed_onboarding': True,
                },
            )

            # Make them premium
            if u.get('is_premium'):
                UserSubscription.objects.update_or_create(
                    profile=profile,
                    defaults={'plan': 'premium', 'is_active': True},
                )

            status = 'created' if created else 'exists'
            self.stdout.write(f'  ✓ {u["username"]} ({status})')

        # 2. Create listings
        self.stdout.write('Creating builder listings...')
        city_cache = {}
        created_count = 0

        for listing in data.get('listings', []):
            try:
                owner = User.objects.get(username=listing['owner_username'])
            except User.DoesNotExist:
                self.stderr.write(f'  ✗ Owner not found: {listing["owner_username"]}')
                continue

            # Resolve city
            city_name = listing.get('city_display_name')
            city = None
            if city_name:
                if city_name not in city_cache:
                    city_cache[city_name] = City.objects.filter(
                        display_name__iexact=city_name
                    ).first()
                city = city_cache[city_name]

            # Skip if duplicate title+owner
            if BuilderListing.objects.filter(user=owner, title=listing['title']).exists():
                self.stdout.write(f'  - Skipping (exists): {listing["title"]}')
                continue

            BuilderListing.objects.create(
                user=owner,
                title=listing['title'],
                description=listing.get('description', ''),
                category=listing['category'],
                listing_type=listing['listing_type'],
                price=Decimal(str(listing['price'])) if listing.get('price') is not None else None,
                city=city,
                photo_url=listing.get('photo_url'),
                is_active=True,
            )
            created_count += 1
            self.stdout.write(f'  ✓ {listing["title"]}')

        self.stdout.write(self.style.SUCCESS(f'\nDone! Created {created_count} listings.'))
