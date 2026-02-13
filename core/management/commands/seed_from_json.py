"""
Management command to seed users from core/seed_data.json.
Creates users, profiles, vehicles, hobbies, in-town windows, and prompt answers.
"""
import json
import os

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from core.models import (
    HobbyTag,
    InTownWindow,
    Profile,
    ProfilePhoto,
    ProfileHobby,
    ProfilePrompt,
    Prompt,
    Vehicle,
)

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed users from core/seed_data.json'

    @staticmethod
    def _clean_seed_urls(values):
        """Return de-duplicated non-empty URL strings in original order."""
        cleaned = []
        seen = set()

        for raw in values or []:
            if not isinstance(raw, str):
                continue
            value = raw.strip()
            if not value or value in seen:
                continue
            cleaned.append(value)
            seen.add(value)

        return cleaned

    def _sync_profile_photos(self, profile, user_payload):
        """
        Keep seeded profile photos deterministic:
        - 1 avatar
        - 1 cover
        - enough gallery photos to reach 5 total (normally 3 gallery photos)
        """
        avatar_url = (user_payload.get('avatar_url') or '').strip()
        cover_url = (user_payload.get('cover_url') or '').strip()

        provided_gallery_urls = self._clean_seed_urls(user_payload.get('gallery_urls', []))
        fallback_gallery_urls = [
            f'https://picsum.photos/seed/{profile.user.username}-gallery-{idx}/900/1200'
            for idx in range(1, 6)
        ]
        gallery_pool = self._clean_seed_urls(provided_gallery_urls + fallback_gallery_urls)

        base_count = 0
        if avatar_url:
            base_count += 1
        if cover_url:
            base_count += 1
        required_gallery_count = max(0, 5 - base_count)
        gallery_urls = gallery_pool[:required_gallery_count]

        ProfilePhoto.objects.filter(
            profile=profile,
            photo_type__in=['avatar', 'cover', 'gallery'],
        ).delete()

        if avatar_url:
            ProfilePhoto.objects.create(
                profile=profile,
                photo_type='avatar',
                image=avatar_url,
                display_order=0,
            )
        if cover_url:
            ProfilePhoto.objects.create(
                profile=profile,
                photo_type='cover',
                image=cover_url,
                display_order=0,
            )

        for display_order, gallery_url in enumerate(gallery_urls):
            ProfilePhoto.objects.create(
                profile=profile,
                photo_type='gallery',
                image=gallery_url,
                display_order=display_order,
            )

    def add_arguments(self, parser):
        parser.add_argument(
            '--delete-existing',
            action='store_true',
            help='Delete all existing non-superuser accounts before seeding',
        )

    def handle(self, *args, **options):
        json_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'core', 'seed_data.json')
        json_path = os.path.normpath(json_path)
        if not os.path.exists(json_path):
            # Try relative to manage.py
            json_path = os.path.join('core', 'seed_data.json')
        with open(json_path, 'r') as f:
            data = json.load(f)

        if options['delete_existing']:
            deleted = User.objects.filter(is_superuser=False).delete()[0]
            self.stdout.write(self.style.WARNING(f'Deleted {deleted} records'))

        # 1. Seed hobby tags
        self.stdout.write('Seeding hobby tags...')
        for ht in data.get('hobby_tags', []):
            HobbyTag.objects.get_or_create(name=ht['name'], defaults={'slug': ht['slug']})

        # 2. Seed prompts
        self.stdout.write('Seeding prompts...')
        for p in data.get('prompts', []):
            Prompt.objects.get_or_create(
                prompt_name=p['prompt_name'],
                defaults={
                    'prompt_question': p['prompt_question'],
                    'prompt_type': p['prompt_type'],
                    'prompt_placeholder': p.get('prompt_placeholder', ''),
                },
            )

        prompts_by_name = {p.prompt_name: p for p in Prompt.objects.all()}
        hobby_tags_by_slug = {h.slug: h for h in HobbyTag.objects.all()}

        # 3. Seed users
        self.stdout.write('Seeding users...')
        created_count = 0
        skipped_count = 0

        for u in data.get('users', []):
            user, user_created = User.objects.get_or_create(
                username=u['username'],
                defaults={'email': u['email'], 'is_active': True},
            )
            if user_created:
                user.set_password(u['password'])
                user.save()

            # Skip if already onboarded
            if hasattr(user, 'profile') and user.profile.has_completed_onboarding:
                skipped_count += 1
                continue

            # Build profile fields
            profile_fields = {
                'display_name': u.get('display_name', ''),
                'bio': u.get('bio', ''),
                'gender': u.get('gender'),
                'profile_type': u.get('profile_type', 'solo'),
                'looking_for_dating': u.get('looking_for_dating', False),
                'looking_for_friends': u.get('looking_for_friends', True),
                'interested_in_men': u.get('interested_in_men', False),
                'interested_in_women': u.get('interested_in_women', False),
                'interested_in_nonbinary': u.get('interested_in_nonbinary', False),
                'travel_status': u.get('travel_status'),
                'travel_companions': u.get('travel_companions'),
                'travel_pace': u.get('travel_pace'),
                'work_status': u.get('work_status'),
                'rig_status': u.get('rig_status'),
                'social_vibe': u.get('social_vibe'),
                'meetup_interest': u.get('meetup_interest', 'open_to_it'),
                'lifestyle_schedule': u.get('lifestyle_schedule'),
                'lifestyle_social': u.get('lifestyle_social'),
                'lifestyle_environment': u.get('lifestyle_environment'),
                'has_van': u.get('has_van', False),
                'has_pets': u.get('has_pets', False),
                'pet_type': u.get('pet_type'),
                'pet_friendly_only': u.get('pet_friendly_only', False),
                'relationship_status': u.get('relationship_status', 'prefer_not_to_say'),
                'looking_for_friend_type': u.get('looking_for_friend_type', 'no_preference'),
                'avatar_url': u.get('avatar_url'),
                'cover_url': u.get('cover_url'),
                'current_location': u.get('current_location', ''),
                'home_base': u.get('home_base', ''),
                'has_completed_onboarding': True,
            }

            profile, _ = Profile.objects.update_or_create(
                user=user, defaults=profile_fields,
            )
            self._sync_profile_photos(profile, u)

            # Hobbies
            profile.hobbies.clear()
            for slug in u.get('hobbies', []):
                tag = hobby_tags_by_slug.get(slug)
                if tag:
                    ProfileHobby.objects.get_or_create(profile=profile, hobby_tag=tag)

            # In-town windows
            InTownWindow.objects.filter(profile=profile).delete()
            for w in u.get('in_town_windows', []):
                InTownWindow.objects.create(
                    profile=profile,
                    city_area=w['city_area'],
                    start_date=w['start_date'],
                    end_date=w['end_date'],
                )

            # Prompt answers
            ProfilePrompt.objects.filter(profile=profile).delete()
            for idx, pa in enumerate(u.get('prompt_answers', [])):
                prompt_obj = prompts_by_name.get(pa['prompt_name'])
                if prompt_obj:
                    ProfilePrompt.objects.create(
                        profile=profile,
                        prompt=prompt_obj,
                        prompt_answer=pa['answer'],
                        display_order=idx,
                    )

            # Vehicle
            Vehicle.objects.filter(profile=profile).delete()
            v = u.get('vehicle')
            if v:
                Vehicle.objects.create(
                    profile=profile,
                    vehicle_type=v['vehicle_type'],
                    make=v.get('make', ''),
                    model=v.get('model', ''),
                    year=v.get('year'),
                    build_status=v.get('build_status'),
                    nickname=v.get('nickname', ''),
                )

            created_count += 1
            self.stdout.write(f'  ✓ {u["username"]} ({u["display_name"]})')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Created/updated {created_count} users, skipped {skipped_count}.'
        ))
