import json
import logging
import math
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone as dt_timezone
from typing import Iterable
from urllib import error as url_error
from urllib import request as url_request
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import City, Event, EventAttendee, InTownWindow, Profile, UserAccount

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_EVENT_SPOTS = 12
DEFAULT_MAX_MILES = 50
DEFAULT_MIN_TRAVELERS = 3

STATE_TIMEZONES = {
    "AK": "America/Anchorage",
    "AL": "America/Chicago",
    "AR": "America/Chicago",
    "AZ": "America/Phoenix",
    "CA": "America/Los_Angeles",
    "CO": "America/Denver",
    "CT": "America/New_York",
    "DC": "America/New_York",
    "DE": "America/New_York",
    "FL": "America/New_York",
    "GA": "America/New_York",
    "HI": "Pacific/Honolulu",
    "IA": "America/Chicago",
    "ID": "America/Boise",
    "IL": "America/Chicago",
    "IN": "America/Indiana/Indianapolis",
    "KS": "America/Chicago",
    "KY": "America/New_York",
    "LA": "America/Chicago",
    "MA": "America/New_York",
    "MD": "America/New_York",
    "ME": "America/New_York",
    "MI": "America/Detroit",
    "MN": "America/Chicago",
    "MO": "America/Chicago",
    "MS": "America/Chicago",
    "MT": "America/Denver",
    "NC": "America/New_York",
    "ND": "America/Chicago",
    "NE": "America/Chicago",
    "NH": "America/New_York",
    "NJ": "America/New_York",
    "NM": "America/Denver",
    "NV": "America/Los_Angeles",
    "NY": "America/New_York",
    "OH": "America/New_York",
    "OK": "America/Chicago",
    "OR": "America/Los_Angeles",
    "PA": "America/New_York",
    "RI": "America/New_York",
    "SC": "America/New_York",
    "SD": "America/Chicago",
    "TN": "America/Chicago",
    "TX": "America/Chicago",
    "UT": "America/Denver",
    "VA": "America/New_York",
    "VT": "America/New_York",
    "WA": "America/Los_Angeles",
    "WI": "America/Chicago",
    "WV": "America/New_York",
    "WY": "America/Denver",
}

OUTDOOR_SPOT_HINTS = {
    "Moab, UT": "Mill Creek Parkway Trail",
    "Salt Lake City, UT": "Liberty Park",
    "Denver, CO": "City Park and the Cherry Creek Trail",
    "Boulder, CO": "Chautauqua Park",
    "Austin, TX": "Auditorium Shores on Lady Bird Lake",
    "San Diego, CA": "Balboa Park",
    "Portland, OR": "Tom McCall Waterfront Park",
    "Seattle, WA": "Gas Works Park",
}


@dataclass
class CitySignal:
    city: City
    event_date: date
    traveler_count: int
    dog_owner_count: int
    pet_owner_count: int
    top_hobbies: list[str]


def _normalize_city(value: str) -> str:
    return (value or "").strip().lower()


def _to_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _haversine_miles(lat1, lon1, lat2, lon2) -> float | None:
    lat1 = _to_float(lat1)
    lon1 = _to_float(lon1)
    lat2 = _to_float(lat2)
    lon2 = _to_float(lon2)
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None

    radius_miles = 3958.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_miles * c


class HostedEventAutoPlanner:
    """Creates one Vanlife Vibes hosted direct-join event per city from demand signals."""

    def __init__(self):
        self.max_miles = int(getattr(settings, "HOSTED_EVENT_RADIUS_MILES", DEFAULT_MAX_MILES))
        self.min_travelers = int(
            getattr(settings, "HOSTED_EVENT_MIN_TRAVELERS", DEFAULT_MIN_TRAVELERS)
        )
        self.spots = int(getattr(settings, "HOSTED_EVENT_SPOTS", DEFAULT_EVENT_SPOTS))
        self.openai_api_key = getattr(settings, "OPENAI_API_KEY", "")
        self.openai_model = getattr(settings, "OPENAI_MODEL", DEFAULT_OPENAI_MODEL)

    def generate(
        self,
        *,
        reference_time: datetime | None = None,
        days_ahead: int = 7,
        force_run: bool = False,
        specific_city: str | None = None,
        dry_run: bool = False,
    ) -> dict:
        reference_time = reference_time or timezone.now()
        if timezone.is_naive(reference_time):
            reference_time = timezone.make_aware(reference_time, dt_timezone.utc)
        planning_days = max(int(days_ahead), 1)

        city_lookup = {
            _normalize_city(city.display_name): city
            for city in City.objects.select_related("country").all()
        }
        candidate_cities = self._get_candidate_cities(
            city_lookup=city_lookup,
            reference_time=reference_time,
            days_ahead=planning_days,
            specific_city=specific_city,
        )

        due_cities = [
            city
            for city in candidate_cities
            if force_run or self._city_is_at_local_midnight(city, reference_time)
        ]
        if not due_cities:
            return {
                "cities_evaluated": len(candidate_cities),
                "cities_due": 0,
                "events_created": 0,
                "events_skipped_existing": 0,
                "events_skipped_low_demand": 0,
                "events_planned": [],
            }

        host_profile = self._get_or_create_host_profile(dry_run=dry_run)
        created_count = 0
        skipped_existing = 0
        skipped_low_demand = 0
        plans = []

        for city in due_cities:
            city_tz = ZoneInfo(self._city_timezone(city))
            city_today = reference_time.astimezone(city_tz).date()
            horizon_end = city_today + timedelta(days=planning_days - 1)
            if self._platform_event_exists_in_range(
                city=city,
                start_date=city_today,
                end_date=horizon_end,
            ):
                skipped_existing += 1
                continue

            selected_signal = None
            for day_offset in range(planning_days):
                target_date = city_today + timedelta(days=day_offset)
                signal = self._build_city_signal(
                    city=city,
                    event_date=target_date,
                    city_lookup=city_lookup,
                )
                if signal.traveler_count >= self.min_travelers:
                    selected_signal = signal
                    break

            if selected_signal is None:
                skipped_low_demand += 1
                continue

            plan = self._build_event_plan(selected_signal)
            plans.append(
                {
                    "city": city.display_name,
                    "date": selected_signal.event_date.isoformat(),
                    "title": plan["title"],
                    "event_type": plan["event_type"],
                    "time_window": plan["time_window"],
                    "traveler_count": selected_signal.traveler_count,
                }
            )

            if dry_run:
                continue

            created = self._create_platform_event(
                host_profile=host_profile,
                city=city,
                signal=selected_signal,
                plan=plan,
            )
            if created:
                created_count += 1
            else:
                skipped_existing += 1

        return {
            "cities_evaluated": len(candidate_cities),
            "cities_due": len(due_cities),
            "events_created": created_count,
            "events_skipped_existing": skipped_existing,
            "events_skipped_low_demand": skipped_low_demand,
            "events_planned": plans,
        }

    def _get_candidate_cities(
        self,
        *,
        city_lookup: dict[str, City],
        reference_time: datetime,
        days_ahead: int,
        specific_city: str | None,
    ) -> list[City]:
        if specific_city:
            city = city_lookup.get(_normalize_city(specific_city))
            return [city] if city else []

        today = reference_time.date()
        horizon = today + timedelta(days=max(days_ahead, 1) + 7)
        active_city_names = (
            InTownWindow.objects.filter(start_date__lte=horizon, end_date__gte=today)
            .values_list("city_area", flat=True)
            .distinct()
        )

        cities = []
        for city_name in active_city_names:
            city = city_lookup.get(_normalize_city(city_name))
            if city:
                cities.append(city)
        return cities

    def _city_timezone(self, city: City) -> str:
        if city.timezone:
            return city.timezone
        return STATE_TIMEZONES.get(city.state_code, "UTC")

    def _city_is_at_local_midnight(self, city: City, reference_time: datetime) -> bool:
        tz = ZoneInfo(self._city_timezone(city))
        local_time = reference_time.astimezone(tz)
        return local_time.hour == 0

    def _build_city_signal(
        self,
        *,
        city: City,
        event_date: date,
        city_lookup: dict[str, City],
    ) -> CitySignal:
        windows = (
            InTownWindow.objects.filter(start_date__lte=event_date, end_date__gte=event_date)
            .select_related("profile")
            .prefetch_related("profile__hobbies")
        )
        matched_profiles: dict[str, Profile] = {}

        for window in windows:
            window_city = city_lookup.get(_normalize_city(window.city_area))
            if not self._city_is_within_radius(host_city=city, traveler_city=window_city, raw_city=window.city_area):
                continue
            matched_profiles[str(window.profile_id)] = window.profile

        traveler_count = len(matched_profiles)
        dog_owner_count = sum(1 for profile in matched_profiles.values() if profile.pet_type == "dog")
        pet_owner_count = sum(1 for profile in matched_profiles.values() if profile.has_pets)

        hobby_counter = Counter()
        for profile in matched_profiles.values():
            for hobby in profile.hobbies.all():
                if hobby.name:
                    hobby_counter[hobby.name.strip().lower()] += 1

        return CitySignal(
            city=city,
            event_date=event_date,
            traveler_count=traveler_count,
            dog_owner_count=dog_owner_count,
            pet_owner_count=pet_owner_count,
            top_hobbies=[name for name, _count in hobby_counter.most_common(4)],
        )

    def _city_is_within_radius(
        self,
        *,
        host_city: City,
        traveler_city: City | None,
        raw_city: str | None,
    ) -> bool:
        if _normalize_city(raw_city) == _normalize_city(host_city.display_name):
            return True
        if traveler_city is None:
            return False
        if traveler_city.id == host_city.id:
            return True
        distance = _haversine_miles(
            host_city.latitude,
            host_city.longitude,
            traveler_city.latitude,
            traveler_city.longitude,
        )
        if distance is None:
            return False
        return distance <= float(self.max_miles)

    def _platform_event_exists_in_range(
        self,
        *,
        city: City,
        start_date: date,
        end_date: date,
    ) -> bool:
        return Event.objects.filter(
            is_platform_hosted=True,
            join_mode="direct",
            status="open",
            event_date__gte=start_date,
            event_date__lte=end_date,
            location__iexact=city.display_name,
        ).exists()

    def _build_event_plan(self, signal: CitySignal) -> dict:
        ai_plan = self._generate_plan_with_openai(signal)
        if ai_plan:
            return ai_plan
        return self._fallback_plan(signal)

    def _generate_plan_with_openai(self, signal: CitySignal) -> dict | None:
        if not self.openai_api_key:
            return None

        system_prompt = (
            "You generate concise, practical vanlife meetup event plans.\n"
            "Return strict JSON with keys: title, description, event_type, time_window, location_hint.\n"
            "Constraints:\n"
            "- title <= 100 chars\n"
            "- description <= 500 chars\n"
            "- event_type one of: coffee,potluck,campfire,cowork,hiking,sunrise_hike,sunset,climbing,biking,kayaking,surfing,camping,snowboarding,skiing,dog_walk,other\n"
            "- time_window one of: morning,afternoon,evening,flexible\n"
            "- location_hint should name a likely outdoor/public meetup spot in the same city."
        )

        user_payload = {
            "city": signal.city.display_name,
            "timezone": self._city_timezone(signal.city),
            "event_date": signal.event_date.isoformat(),
            "traveler_count": signal.traveler_count,
            "dog_owner_count": signal.dog_owner_count,
            "pet_owner_count": signal.pet_owner_count,
            "top_hobbies": signal.top_hobbies,
            "hint": "If many dog owners, prefer a dog_walk event in a dog-friendly outdoor spot.",
        }

        body = {
            "model": self.openai_model,
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload)},
            ],
        }
        request = url_request.Request(
            OPENAI_CHAT_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.openai_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with url_request.urlopen(request, timeout=18) as response:
                payload = json.loads(response.read().decode("utf-8"))
            content = payload["choices"][0]["message"]["content"]
            parsed = json.loads(content)
        except (url_error.URLError, TimeoutError, KeyError, IndexError, ValueError, TypeError) as exc:
            logger.warning("OpenAI event planning fallback used: %s", exc)
            return None

        return self._sanitize_plan(
            signal=signal,
            title=parsed.get("title"),
            description=parsed.get("description"),
            event_type=parsed.get("event_type"),
            time_window=parsed.get("time_window"),
            location_hint=parsed.get("location_hint"),
        )

    def _fallback_plan(self, signal: CitySignal) -> dict:
        if signal.dog_owner_count >= 5:
            event_type = "dog_walk"
            time_window = "morning"
            theme = "Dog Walk Meetup"
        elif "hiking" in signal.top_hobbies:
            event_type = "hiking"
            time_window = "morning"
            theme = "Trail Meetup"
        elif "cowork" in signal.top_hobbies:
            event_type = "cowork"
            time_window = "afternoon"
            theme = "Cowork Hangout"
        else:
            event_type = "campfire"
            time_window = "evening"
            theme = "Campfire Meetup"

        location_hint = OUTDOOR_SPOT_HINTS.get(signal.city.display_name, signal.city.display_name)
        title = f"{signal.city.name} {theme}"
        description = (
            f"Vanlife Vibes community-hosted meetup for {signal.traveler_count} travelers around "
            f"{signal.city.display_name}. Suggested spot: {location_hint}."
        )
        if signal.dog_owner_count >= 3:
            description += " Dog-friendly meetup encouraged."
        if signal.top_hobbies:
            description += f" Popular interests here: {', '.join(signal.top_hobbies[:3])}."

        return self._sanitize_plan(
            signal=signal,
            title=title,
            description=description,
            event_type=event_type,
            time_window=time_window,
            location_hint=location_hint,
        )

    def _sanitize_plan(
        self,
        *,
        signal: CitySignal,
        title,
        description,
        event_type,
        time_window,
        location_hint,
    ) -> dict:
        valid_event_types = {choice[0] for choice in Event.EVENT_TYPE_CHOICES}
        valid_time_windows = {choice[0] for choice in Event.TIME_WINDOW_CHOICES}

        clean_event_type = event_type if event_type in valid_event_types else "campfire"
        clean_time_window = time_window if time_window in valid_time_windows else "evening"
        clean_title = (title or "").strip()[:100] or f"{signal.city.name} Community Meetup"
        clean_hint = (location_hint or "").strip()[:120]
        clean_description = (description or "").strip()[:500]

        if clean_hint and clean_hint.lower() not in clean_description.lower():
            clean_description = f"{clean_description} Suggested spot: {clean_hint}.".strip()
        if not clean_description:
            clean_description = (
                f"Vanlife Vibes hosted meetup for {signal.traveler_count} travelers in {signal.city.display_name}."
            )

        return {
            "title": clean_title,
            "description": clean_description[:500],
            "event_type": clean_event_type,
            "time_window": clean_time_window,
            "location": signal.city.display_name,
        }

    def _get_or_create_host_profile(self, *, dry_run: bool) -> Profile:
        if dry_run:
            profile = Profile.objects.filter(display_name__iexact="Vanlife Vibes").first()
            if profile:
                return profile
            return Profile(
                user=UserAccount(username="vanlifevibes_host"),
                display_name="Vanlife Vibes",
                has_completed_onboarding=True,
            )

        user, created = UserAccount.objects.get_or_create(
            username="vanlifevibes_host",
            defaults={
                "email": "host@vanlifevibes.app",
                "is_active": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        profile, _profile_created = Profile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": "Vanlife Vibes",
                "has_completed_onboarding": True,
                "looking_for_friends": False,
                "looking_for_dating": False,
            },
        )
        if profile.display_name != "Vanlife Vibes":
            profile.display_name = "Vanlife Vibes"
            profile.save(update_fields=["display_name"])
        return profile

    def _create_platform_event(
        self,
        *,
        host_profile: Profile,
        city: City,
        signal: CitySignal,
        plan: dict,
    ) -> bool:
        with transaction.atomic():
            existing = Event.objects.select_for_update().filter(
                is_platform_hosted=True,
                join_mode="direct",
                event_date=signal.event_date,
                location__iexact=city.display_name,
            ).first()
            if existing:
                return False

            event = Event.objects.create(
                created_by=host_profile,
                title=plan["title"],
                event_type=plan["event_type"],
                description=plan["description"],
                join_mode="direct",
                spots=max(self.spots, self.min_travelers + 1),
                event_date=signal.event_date,
                time_window=plan["time_window"],
                location=plan["location"],
                is_platform_hosted=True,
                status="open",
            )

            EventAttendee.objects.get_or_create(
                event=event,
                user=host_profile,
                defaults={"status": "confirmed", "confirmed_at": timezone.now()},
            )
            return True
