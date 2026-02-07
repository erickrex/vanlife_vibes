# Repository Guidelines

## Project Structure & Module Organization
- `core/`: Django app (models, API endpoints, matching/services).
- `vanlifevibes/`: Django project settings and URL config.
- `frontend/`: React + Vite app (`src/pages`, `src/components`, `src/services/api.js`, `src/contexts`).
- `templates/`: Server-rendered templates (if used).
- `manage.py`: Django entrypoint.
- `start-dev.sh`, `run-tests.sh`: Local dev and test helpers.

## Build, Test, and Development Commands
- **Always use `uv run` to execute Python** - never use `python` or `python3` directly.
- `uv sync`: Install Python dependencies.
- `./start-dev.sh`: Run backend (`manage.py runserver`) + frontend (`npm run dev`).
- `uv run python manage.py migrate`: Apply DB migrations.
- `uv run python manage.py createsuperuser`: Create admin user.
- `./run-tests.sh`: Run backend and frontend tests together.
- `uv run python manage.py test core.tests`: Backend test suite.
- `cd frontend && npm test`: Frontend tests (Vitest).
- `cd frontend && npm run build`: Build frontend bundle.

## Coding Style & Naming Conventions
- Follow existing patterns in `core/` and `frontend/src/`.
- Python: 4-space indentation, Django naming (apps, models, serializers, services).
- Frontend: ESLint (`cd frontend && npm run lint`), keep components and hooks small and focused.
- Use descriptive names for services and UI components; avoid abbreviations.

## Testing Guidelines
- Backend tests live in `core/tests/` and follow `test_*.py` or `*_test.py`.
- Frontend tests use Vitest + React Testing Library.
- Favor unit tests for services and serializers; add UI tests for key flows.

## Commit & Pull Request Guidelines
- Commit messages use a conventional style (e.g., `feat: ...`, `fix: ...`).
- PRs should include a short summary, tests run, and screenshots for UI changes.

## Architecture Overview
- API lives in `core/views.py` and `core/serializers.py`.
- Matching logic is centralized in `core/services/matching.py` and invoked from views/signals.
- Frontend calls the API via `frontend/src/services/api.js`.

## Frontend Conventions
- Pages go in `frontend/src/pages/`; reusable UI in `frontend/src/components/`.
- Keep API calls in `frontend/src/services/` and state in `frontend/src/contexts/`.
- Prefer explicit route components and co-locate page-specific helpers.

## Local Setup Prerequisites
- Python 3.12+, Node.js, and `uv`.
- PostgreSQL database named `vanlifevibes`.
- Copy env files if missing: `.env.example` -> `.env`, `frontend/.env.example` -> `frontend/.env`.

## Configuration & Security Tips
- Store secrets in `.env` / `frontend/.env`; never commit credentials.
- Keep local config out of version control; rely on examples for defaults.
