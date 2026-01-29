# VanlifeVibes

VanlifeVibes is the multi-user "Tinder for X" template that keeps the group-level swiping rules you already love while letting any team curate its own decision pool. Each session locks in a vote rule (unanimous or threshold), the group swipes collectively, and matches unlock with their own mini chat so the group can keep the conversation focused.

## Overview

VanlifeVibes keeps things intentionally flexible:

- **Group-first matching** – Sessions belong to a group, and matches are computed once at the group level so every member's vote counts toward the same outcome.
- **Swipable options** – Add any option you want (projects, venues, candidates, ideas, etc.), optionally attaching an `image_url` to make cards more expressive.
- **Per-match chat** – Every match spawns a lightweight discussion thread so follow-up conversations stay tied to the choice.
- **N-person rules** – Support unanimous approvals or numeric thresholds so groups ranging from 2 to 50 can operate without extra work.
- **Template friendly** – VanlifeVibes ships as a clean canvas for "Tinder for X" experiments and can be rebranded in minutes.

## How It Works

1. **Create a crew** – Invite teammates, let them accept, and grant admin roles for future sessions.
2. **Launch a session** – Pick an approval rule and upload a batch of options with labels, metadata, and optional visuals.
3. **Swipe together** – Session members swipe "like" or "pass" in real time. Each vote updates the shared state.
4. **Unlock matches** – Once the group satisfies the session rule, the option becomes a match.
5. **Discuss matches** – A dedicated chat per match keeps follow-up discussion contained to that option.
6. **Share & repeat** – Share sessions across groups, archive old ones, and keep building new decision templates.

## Key Concepts

| Term | Meaning |
|------|---------|
| **Group** | The crew of users making joint decisions |
| **Session** | A swipe-driven round with an approval rule |
| **Candidate** | Any option you can swipe on (optional `image_url` allowed) |
| **Swipe** | A user's like/pass for a candidate |
| **Match** | A candidate that hit the group's approval rule |
| **MatchMessage** | Messages attached to a match so the conversation stays focused |

## Quick Start

### 1. Install Dependencies

```bash
# Install UV (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Python dependencies
uv sync

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
# Backend configuration
cp .env.example .env
# Edit .env and set your database password

# Frontend configuration
cd frontend
cp .env.example .env
cd ..
```

### 3. Setup Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE vanlifevibes;"

# Run migrations (just 1 migration!)
uv run python manage.py migrate

# Create admin user
uv run python manage.py createsuperuser
```

### 4. Start Development Servers

```bash
# Option 1: Use the helper script
./start-dev.sh

# Option 2: Start manually
# Terminal 1 - Backend
uv run python manage.py runserver

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000/api/v1
- **Admin Panel**: http://localhost:8000/admin

## Tech Stack

- **Backend**: Django 5.2.10, Django REST Framework, PostgreSQL
- **Frontend**: React 18, Vite, React Router
- **Runtime**: UV (backend) + Vite dev server

## Project Structure

```
├── core/              # Django app (models, APIs, matching logic)
├── frontend/          # React app
├── vanlifevibes/      # Django settings
├── start-dev.sh       # Starts backend & frontend
├── run-tests.sh       # Runs all tests
└── reset-database.sh  # Resets database (development only)
```

## Testing

```bash
# Run all tests
./run-tests.sh

# Backend tests only
uv run python manage.py test core.tests

# Frontend tests only
cd frontend && npm test
```

**Test Coverage**: 17/17 tests passing ✅
- 7 matching logic tests
- 10 API endpoint tests

## Architecture

### Matching System
The project uses **Django signals** for automatic match evaluation:
- When a user swipes on a candidate, a `post_save` signal triggers `evaluate_match_for_candidate()`
- The matching service (`core/services/matching.py`) checks if approval rules are met
- Matches are created automatically when thresholds are reached
- No database triggers needed - everything runs in Python

### API Endpoints

**Authentication**
- `POST /api/v1/auth/signup/` - Register new user
- `POST /api/v1/auth/login/` - Login
- `POST /api/v1/auth/logout/` - Logout
- `GET /api/v1/auth/me/` - Get current user

**Groups**
- `GET /api/v1/groups/` - List user's groups
- `POST /api/v1/groups/` - Create group
- `GET /api/v1/groups/:id/members/` - List members
- `POST /api/v1/groups/:id/members/` - Invite member

**Sessions**
- `GET /api/v1/sessions/` - List sessions
- `POST /api/v1/sessions/` - Create session
- `GET /api/v1/sessions/:id/candidates/` - List candidates
- `POST /api/v1/sessions/:id/candidates/` - Add candidate
- `GET /api/v1/sessions/:id/matches/` - List matches

**Swipes**
- `POST /api/v1/swipes/candidates/:id/swipes/` - Cast swipe
- `GET /api/v1/swipes/candidates/:id/swipes/me/` - Get my swipe
- `DELETE /api/v1/swipes/candidates/:id/swipes/` - Delete swipe

## Development

### Reset Database

If you need to start fresh:

```bash
./reset-database.sh
```

This will:
1. Drop the existing database
2. Create a new database
3. Run migrations
4. Prompt you to create a superuser

### Helper Scripts

- `./start-dev.sh` - Start both backend and frontend servers
- `./run-tests.sh` - Run all tests with colored output
- `./reset-database.sh` - Reset database (development only)

## Troubleshooting

### Database Connection Issues

Make sure PostgreSQL is running and your `.env` file has the correct credentials:

```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Verify database exists
psql -U postgres -c "\l" | grep vanlifevibes
```

### Migration Issues

If you encounter migration problems:

```bash
# Check migration status
uv run python manage.py showmigrations

# Reset database (will delete all data!)
./reset-database.sh
```

### Frontend Issues

```bash
# Clear node modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf .vite
```

## Notes

- Every candidate supports an optional `image_url` for visual presentation
- Matches are evaluated at the group level using Django signals
- Each match has its own chat thread accessible via `/api/v1/match-messages`
- The project uses a single clean migration - no historical baggage

## Documentation

- `README.md` - This file
- `QUICK_START.md` - Quick start guide
- `PROJECT_STATUS.md` - Current project status and features
- `FIXES_APPLIED.md` - Detailed changelog of fixes

## License

See LICENSE file for details.
