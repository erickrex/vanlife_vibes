"""Seed hosted events from the JSON fixture file."""

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Event, EventAttendee, Profile, UserAccount


class Command(BaseCommand):
    help = "Seed hosted events from core/fixtures/hosted_events_next_weekend_seed.json"

    def handle(self, *args, **options):
        fixture_path = Path(__file__).resolve().parent.parent.parent / "fixtures" / "hosted_events_next_weekend_seed.json"
        if not fixture_path.exists():
            self.stderr.write(self.style.ERROR(f"Fixture not found: {fixture_path}"))
            return

        data = json.loads(fixture_path.read_text())
        events_data = data.get("events", [])

        # Ensure host profile exists
        host_username = data["insert_ready"]["host_profile_username"]
        host_user, created = UserAccount.objects.get_or_create(
            username=host_username,
            defaults={"email": f"{host_username}@vanlifevibes.app", "is_active": True},
        )
        if created:
            host_user.set_unusable_password()
            host_user.save()
            self.stdout.write(f"Created host user: {host_username}")

        try:
            host_profile = host_user.profile
        except Profile.DoesNotExist:
            host_profile = Profile.objects.create(
                user=host_user,
                display_name="VanlifeVibes",
                bio="Official VanlifeVibes platform host",
                has_completed_onboarding=True,
            )
            self.stdout.write(f"Created host profile for {host_username}")

        created_count = 0
        skipped_count = 0

        for ev in events_data:
            # Check for duplicate by date + location + join_mode + platform flag
            exists = Event.objects.filter(
                event_date=ev["event_date"],
                location=ev["location"],
                join_mode=ev["join_mode"],
                is_platform_hosted=True,
            ).exists()

            if exists:
                skipped_count += 1
                self.stdout.write(f"  Skipped (duplicate): {ev['title']}")
                continue

            event = Event.objects.create(
                created_by=host_profile,
                title=ev["title"],
                event_type=ev["event_type"],
                description=ev.get("description", ""),
                image_url=ev.get("image_url", ""),
                join_mode=ev["join_mode"],
                spots=ev["spots"],
                event_date=ev["event_date"],
                time_window=ev["time_window"],
                location=ev["location"],
                status=ev.get("status", "open"),
                is_platform_hosted=ev.get("is_platform_hosted", True),
            )

            # Auto-add host as confirmed attendee
            if data["insert_ready"].get("expects_host_attendee"):
                EventAttendee.objects.create(
                    event=event,
                    user=host_profile,
                    status=data["insert_ready"].get("recommended_attendee_status", "confirmed"),
                    confirmed_at=timezone.now(),
                )

            created_count += 1
            self.stdout.write(f"  Created: {ev['title']} ({ev['location']}, {ev['event_date']})")

        self.stdout.write(self.style.SUCCESS(f"\nDone: {created_count} created, {skipped_count} skipped"))
