"""Backfill Profile.avatar_url and Profile.cover_url from ProfilePhoto records."""

from django.core.management.base import BaseCommand

from core.models import Profile


class Command(BaseCommand):
    help = (
        "Backfill avatar_url and cover_url from latest ProfilePhoto.image.url values. "
        "Useful after enabling S3 storage or migrating media URL formats."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show planned updates without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        updated_profiles = 0
        updated_fields = 0

        profiles = Profile.objects.prefetch_related("photos").all()
        for profile in profiles:
            pending_updates = {}

            avatar_photo = next(
                (photo for photo in profile.photos.all() if photo.photo_type == "avatar"),
                None,
            )
            cover_photo = next(
                (photo for photo in profile.photos.all() if photo.photo_type == "cover"),
                None,
            )

            if avatar_photo and avatar_photo.image:
                next_avatar_url = avatar_photo.image.url
                if profile.avatar_url != next_avatar_url:
                    pending_updates["avatar_url"] = next_avatar_url

            if cover_photo and cover_photo.image:
                next_cover_url = cover_photo.image.url
                if profile.cover_url != next_cover_url:
                    pending_updates["cover_url"] = next_cover_url

            if not pending_updates:
                continue

            updated_profiles += 1
            updated_fields += len(pending_updates)

            if dry_run:
                self.stdout.write(
                    f"[dry-run] profile={profile.id} updates={pending_updates}"
                )
                continue

            for field_name, field_value in pending_updates.items():
                setattr(profile, field_name, field_value)
            profile.save(update_fields=list(pending_updates.keys()))

        mode = "Dry run complete" if dry_run else "Backfill complete"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode}: updated_profiles={updated_profiles}, updated_fields={updated_fields}"
            )
        )
