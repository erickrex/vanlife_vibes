from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core.services.hosted_events import HostedEventAutoPlanner


class Command(BaseCommand):
    help = (
        "Generate one Vanlife Vibes hosted direct-join event per city (3+ travelers in 50 miles). "
        "Intended to run hourly; each city generates at local midnight."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Run for candidate cities regardless of local midnight.",
        )
        parser.add_argument(
            "--city",
            type=str,
            default=None,
            help="Optional city display name (e.g. 'Moab, UT').",
        )
        parser.add_argument(
            "--days-ahead",
            type=int,
            default=7,
            help="How many upcoming days to scan for the first qualifying date (default: 7).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Plan events without writing to the database.",
        )
        parser.add_argument(
            "--reference-time",
            type=str,
            default=None,
            help="Override current time in ISO format for testing.",
        )

    def handle(self, *args, **options):
        days_ahead = int(options["days_ahead"])
        if days_ahead < 1:
            raise CommandError("--days-ahead must be >= 1")

        reference_time = self._parse_reference_time(options.get("reference_time"))
        planner = HostedEventAutoPlanner()
        result = planner.generate(
            reference_time=reference_time,
            days_ahead=days_ahead,
            force_run=bool(options["force"]),
            specific_city=options.get("city"),
            dry_run=bool(options["dry_run"]),
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Hosted event generation complete: "
                f"cities_evaluated={result['cities_evaluated']}, "
                f"cities_due={result['cities_due']}, "
                f"created={result['events_created']}, "
                f"skipped_existing={result['events_skipped_existing']}, "
                f"skipped_low_demand={result['events_skipped_low_demand']}"
            )
        )

        for plan in result["events_planned"][:20]:
            self.stdout.write(
                f"- {plan['date']} · {plan['city']} · {plan['event_type']} · {plan['title']}"
            )
        if len(result["events_planned"]) > 20:
            self.stdout.write(
                f"... and {len(result['events_planned']) - 20} more planned events"
            )

    def _parse_reference_time(self, value: str | None):
        if not value:
            return timezone.now()
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:
            raise CommandError("--reference-time must be ISO-8601") from exc

        if timezone.is_naive(parsed):
            return timezone.make_aware(parsed, dt_timezone.utc)
        return parsed
