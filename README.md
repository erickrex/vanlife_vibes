# VanlifeVibes

VanlifeVibes is a social network and dating app for van lifers and nomadic travelers. It helps people living the mobile lifestyle connect with others who share their passion for travel, adventure, and life on the road.

## Overview

- **Profile & Vehicle Showcase** – Instagram-style profiles with vehicle details, hobbies, and lifestyle tags
- **Location-Based Discovery** – Find travelers in your area now, next week, or next month
- **Dating & Friends** – Swipe-based matching for dating, friendships, or both
- **Events** – Create and discover local meetups and gatherings
- **Per-Match Chat** – Real-time messaging tied to each match
- **Premium Subscription** – Free tier with 3 daily swipes, Premium ($4.99/mo) for unlimited via RevenueCat + Google Play

## Tech Stack

- **Backend**: Django 5.2, Django REST Framework, Django Channels (WebSocket), PostgreSQL
- **Mobile App**: React Native (Expo 54), React Navigation, Axios
- **Auth**: Token-based auth via DRF + django-allauth for email verification
- **Payments**: RevenueCat (`react-native-purchases`) with Google Play Billing
- **Storage**: S3 via django-storages (production), local filesystem (development)
- **ASGI Server**: Daphne (production)
- **Deployment**: AWS Elastic Beanstalk (Docker)
- **Package Managers**: UV (Python), npm (mobile)

## Project Structure

```
├── core/                # Django app (models, views, serializers, services, tests)
├── vanlifevibes/        # Django project settings, URLs, ASGI config
├── mobile-app/          # React Native / Expo app (Android)
│   ├── src/
│   │   ├── components/  # Reusable UI (SwipeDeck, PaywallModal, SwipeCounter, etc.)
│   │   ├── contexts/    # AuthContext
│   │   ├── navigation/  # React Navigation stacks and tabs
│   │   ├── screens/     # App screens (Discovery, Matches, Profile, Events, etc.)
│   │   ├── services/    # API client, RevenueCat, WebSocket
│   │   └── theme/       # Colors and styling constants
│   └── App.js           # Entry point
├── templates/           # Django email templates (allauth)
├── .ebextensions/       # Elastic Beanstalk config
├── Dockerfile           # Production Docker image
├── entrypoint.sh        # Container entrypoint (migrate + Daphne)
├── DEPLOYMENT.md        # EB deployment guide
└── manage.py            # Django entrypoint
```

## Quick Start

### 1. Install Dependencies

```bash
# Python dependencies
uv sync

# Mobile app dependencies
cd mobile-app && npm install && cd ..
```

### 2. Configure Environment

```bash
# Backend
cp .env.example .env
# Edit .env with your database credentials

# Mobile app
cd mobile-app
cp .env.example .env
# Edit .env with your LAN IP
cd ..
```

### 3. Setup Database

```bash
psql -U postgres -c "CREATE DATABASE vanlifevibes;"
uv run python manage.py migrate
uv run python manage.py createsuperuser
```

### 4. Start Development

```bash
# Terminal 1 — Backend (bind to LAN for mobile access)
uv run python manage.py runserver 0.0.0.0:8000

# Terminal 2 — Mobile app
cd mobile-app && npx expo start --lan
```

### 5. Access

- **API**: http://localhost:8000/api/v1
- **Admin Panel**: http://localhost:8000/admin
- **Mobile over LAN**: http://\<your-lan-ip\>:8000/api/v1

## API Endpoints

**Auth**
- `POST /api/v1/auth/signup/` – Register
- `POST /api/v1/auth/login/` – Login
- `POST /api/v1/auth/logout/` – Logout
- `GET /api/v1/auth/me/` – Current user

**Profiles**
- `GET /api/v1/profiles/me/` – My profile
- `PATCH /api/v1/profiles/me/` – Update profile
- `GET /api/v1/profiles/:id/` – View profile

**Discovery**
- `GET /api/v1/discovery/dating/` – Dating feed
- `GET /api/v1/discovery/friends/` – Friends feed
- `POST /api/v1/discovery/swipe/` – Cast swipe

**Matches**
- `GET /api/v1/matches/` – List matches
- `GET /api/v1/matches/:id/messages/` – Match messages
- `POST /api/v1/matches/:id/messages/` – Send message

**Events**
- `GET /api/v1/events/` – List events
- `POST /api/v1/events/` – Create event

**Subscription**
- `GET /api/v1/subscription/status/` – Subscription status
- `POST /api/v1/webhooks/revenuecat/` – RevenueCat webhook

**Health**
- `GET /api/v1/health/` – Health check (used by EB)

## Testing

```bash
# All backend tests
uv run python manage.py test core.tests

# Or use the helper script
./run-tests.sh
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full Elastic Beanstalk deployment guide.

## Mobile App Troubleshooting

If the mobile app can't reach the backend:

1. Start Django bound to LAN: `uv run python manage.py runserver 0.0.0.0:8000`
2. Set `EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:8000/api/v1` in `mobile-app/.env`
3. Restart Expo with cache clear: `cd mobile-app && npx expo start --lan -c`
4. Confirm phone and laptop are on the same Wi-Fi network
5. Test from phone browser: `http://<your-lan-ip>:8000/api/v1/auth/login/` (a 404/405 confirms connectivity)
