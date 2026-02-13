from datetime import date, datetime, timedelta, timezone as dt_timezone

from django.test import TestCase, override_settings

from core.models import City, Country, Event, EventAttendee, InTownWindow, Profile, UserAccount
from core.services.hosted_events import HostedEventAutoPlanner


def create_user_with_profile(username: str, email: str, *, has_pets=False, pet_type=None):
    user = UserAccount.objects.create_user(username=username, email=email, password="testpass123")
    profile = user.profile
    profile.display_name = username
    profile.has_pets = has_pets
    profile.pet_type = pet_type
    profile.save(update_fields=["display_name", "has_pets", "pet_type"])
    return user, profile


@override_settings(OPENAI_API_KEY="")
class HostedEventsPlannerTestCase(TestCase):
    def setUp(self):
        self.country, _ = Country.objects.get_or_create(
            code="US",
            defaults={"name": "United States"},
        )
        self.city, _ = City.objects.get_or_create(
            name="Moab",
            state_code="UT",
            country=self.country,
            defaults={
                "display_name": "Moab, UT",
                "latitude": 38.573315,
                "longitude": -109.549835,
                "timezone": "America/Denver",
            },
        )
        self.secondary_city, _ = City.objects.get_or_create(
            name="Boulder",
            state_code="CO",
            country=self.country,
            defaults={
                "display_name": "Boulder, CO",
                "latitude": 40.014986,
                "longitude": -105.270546,
                "timezone": "America/Denver",
            },
        )
        self.city.display_name = "Moab, UT"
        self.city.latitude = 38.573315
        self.city.longitude = -109.549835
        self.city.timezone = "America/Denver"
        self.city.save(update_fields=["display_name", "latitude", "longitude", "timezone"])

        self.secondary_city.display_name = "Boulder, CO"
        self.secondary_city.latitude = 40.014986
        self.secondary_city.longitude = -105.270546
        self.secondary_city.timezone = "America/Denver"
        self.secondary_city.save(update_fields=["display_name", "latitude", "longitude", "timezone"])
        self.reference_time = datetime(2026, 2, 13, 8, 0, tzinfo=dt_timezone.utc)
        self.event_date = self.reference_time.date()

    def _add_window(self, profile: Profile, city: City, start: date, end: date):
        InTownWindow.objects.create(
            profile=profile,
            city_area=city.display_name,
            start_date=start,
            end_date=end,
        )

    def test_generates_direct_platform_event_for_city_with_three_or_more_travelers(self):
        _, p1 = create_user_with_profile("traveler1", "traveler1@example.com", has_pets=True, pet_type="dog")
        _, p2 = create_user_with_profile("traveler2", "traveler2@example.com")
        _, p3 = create_user_with_profile("traveler3", "traveler3@example.com")

        for profile in (p1, p2, p3):
            self._add_window(profile, self.city, self.event_date, self.event_date + timedelta(days=3))

        planner = HostedEventAutoPlanner()
        result = planner.generate(
            reference_time=self.reference_time,
            days_ahead=1,
            force_run=True,
            specific_city=self.city.display_name,
        )

        self.assertEqual(result["events_created"], 1)
        event = Event.objects.get(is_platform_hosted=True, event_date=self.event_date)
        self.assertEqual(event.join_mode, "direct")
        self.assertEqual(event.location, self.city.display_name)
        self.assertEqual(event.status, "open")
        self.assertEqual(event.created_by.display_name, "Vanlife Vibes")

        host_attendee = EventAttendee.objects.get(event=event, user=event.created_by)
        self.assertEqual(host_attendee.status, "confirmed")

    def test_does_not_create_duplicate_platform_event_for_same_city_date(self):
        _, p1 = create_user_with_profile("traveler_a", "traveler_a@example.com")
        _, p2 = create_user_with_profile("traveler_b", "traveler_b@example.com")
        _, p3 = create_user_with_profile("traveler_c", "traveler_c@example.com")
        for profile in (p1, p2, p3):
            self._add_window(profile, self.city, self.event_date, self.event_date + timedelta(days=1))

        planner = HostedEventAutoPlanner()
        first = planner.generate(
            reference_time=self.reference_time,
            days_ahead=1,
            force_run=True,
            specific_city=self.city.display_name,
        )
        second = planner.generate(
            reference_time=self.reference_time,
            days_ahead=1,
            force_run=True,
            specific_city=self.city.display_name,
        )

        self.assertEqual(first["events_created"], 1)
        self.assertEqual(second["events_created"], 0)
        self.assertEqual(
            Event.objects.filter(
                is_platform_hosted=True,
                event_date=self.event_date,
                location=self.city.display_name,
            ).count(),
            1,
        )

    def test_skips_city_below_min_traveler_threshold(self):
        _, p1 = create_user_with_profile("lite1", "lite1@example.com")
        _, p2 = create_user_with_profile("lite2", "lite2@example.com")
        for profile in (p1, p2):
            self._add_window(profile, self.secondary_city, self.event_date, self.event_date + timedelta(days=2))

        planner = HostedEventAutoPlanner()
        result = planner.generate(
            reference_time=self.reference_time,
            days_ahead=1,
            force_run=True,
            specific_city=self.secondary_city.display_name,
        )

        self.assertEqual(result["events_created"], 0)
        self.assertGreaterEqual(result["events_skipped_low_demand"], 1)
        self.assertFalse(
            Event.objects.filter(
                is_platform_hosted=True,
                event_date=self.event_date,
                location=self.secondary_city.display_name,
            ).exists()
        )

    def test_creates_single_event_per_city_when_multiple_days_qualify(self):
        _, p1 = create_user_with_profile("multi1", "multi1@example.com")
        _, p2 = create_user_with_profile("multi2", "multi2@example.com")
        _, p3 = create_user_with_profile("multi3", "multi3@example.com")
        for profile in (p1, p2, p3):
            self._add_window(profile, self.city, self.event_date, self.event_date + timedelta(days=6))

        planner = HostedEventAutoPlanner()
        result = planner.generate(
            reference_time=self.reference_time,
            days_ahead=7,
            force_run=True,
            specific_city=self.city.display_name,
        )

        self.assertEqual(result["events_created"], 1)
        self.assertEqual(
            Event.objects.filter(
                is_platform_hosted=True,
                location=self.city.display_name,
                event_date__gte=self.event_date,
                event_date__lte=self.event_date + timedelta(days=6),
            ).count(),
            1,
        )

    def test_uses_first_future_day_that_meets_min_travelers(self):
        _, p1 = create_user_with_profile("future1", "future1@example.com")
        _, p2 = create_user_with_profile("future2", "future2@example.com")
        _, p3 = create_user_with_profile("future3", "future3@example.com")
        target_date = self.event_date + timedelta(days=2)
        for profile in (p1, p2, p3):
            self._add_window(profile, self.city, target_date, target_date + timedelta(days=1))

        planner = HostedEventAutoPlanner()
        result = planner.generate(
            reference_time=self.reference_time,
            days_ahead=7,
            force_run=True,
            specific_city=self.city.display_name,
        )

        self.assertEqual(result["events_created"], 1)
        event = Event.objects.get(is_platform_hosted=True, location=self.city.display_name)
        self.assertEqual(event.event_date, target_date)

    def test_requires_city_local_midnight_when_not_forced(self):
        _, p1 = create_user_with_profile("tz1", "tz1@example.com")
        _, p2 = create_user_with_profile("tz2", "tz2@example.com")
        _, p3 = create_user_with_profile("tz3", "tz3@example.com")
        for profile in (p1, p2, p3):
            self._add_window(profile, self.city, self.event_date, self.event_date + timedelta(days=1))

        planner = HostedEventAutoPlanner()
        not_midnight = planner.generate(
            reference_time=datetime(2026, 2, 13, 8, 0, tzinfo=dt_timezone.utc),
            days_ahead=1,
            force_run=False,
            specific_city=self.city.display_name,
        )
        self.assertEqual(not_midnight["cities_due"], 0)
        self.assertEqual(not_midnight["events_created"], 0)

        at_midnight = planner.generate(
            reference_time=datetime(2026, 2, 13, 7, 0, tzinfo=dt_timezone.utc),
            days_ahead=1,
            force_run=False,
            specific_city=self.city.display_name,
        )
        self.assertEqual(at_midnight["events_created"], 1)

    def test_counts_travelers_in_nearby_city_within_radius(self):
        nearby_city, _ = City.objects.get_or_create(
            name="Spanish Valley",
            state_code="UT",
            country=self.country,
            defaults={
                "display_name": "Spanish Valley, UT",
                "latitude": 38.45,
                "longitude": -109.51,
                "timezone": "America/Denver",
            },
        )
        nearby_city.display_name = "Spanish Valley, UT"
        nearby_city.latitude = 38.45
        nearby_city.longitude = -109.51
        nearby_city.timezone = "America/Denver"
        nearby_city.save(update_fields=["display_name", "latitude", "longitude", "timezone"])

        _, p1 = create_user_with_profile("near1", "near1@example.com")
        _, p2 = create_user_with_profile("near2", "near2@example.com")
        _, p3 = create_user_with_profile("near3", "near3@example.com")
        for profile in (p1, p2, p3):
            self._add_window(profile, nearby_city, self.event_date, self.event_date + timedelta(days=1))

        planner = HostedEventAutoPlanner()
        result = planner.generate(
            reference_time=self.reference_time,
            days_ahead=1,
            force_run=True,
            specific_city=self.city.display_name,
        )

        self.assertEqual(result["events_created"], 1)
        self.assertTrue(
            Event.objects.filter(
                is_platform_hosted=True,
                event_date=self.event_date,
                location=self.city.display_name,
            ).exists()
        )
