# Repository Guidelines

## Project Structure & Module Organization
This repository is a monorepo with a Django backend and Expo React Native mobile client.

- `core/`: main Django app (`models.py`, `views/`, `serializers/`, `services/`, `tests/`, `migrations/`).
- `vanlifevibes/`: Django project config (`settings.py`, `urls.py`, `asgi.py`, `wsgi.py`).
- `mobile-app/`: mobile app (`src/screens`, `src/components`, `src/navigation`, `src/services`).
- `templates/`: Django email/auth templates.
- Ops and docs: `Dockerfile`, `entrypoint.sh`, `.ebextensions/`, `DEPLOYMENT.md`.

## Build, Test, and Development Commands
- Install backend deps: `uv sync`
- Run backend locally: `uv run python manage.py runserver 0.0.0.0:8000`
- Apply migrations: `uv run python manage.py migrate`
- Run backend tests: `uv run python manage.py test core.tests`
- Install mobile deps: `cd mobile-app && npm install`
- Start Expo: `cd mobile-app && npx expo start --lan`

Use `README.md` commands as source of truth.

## Coding Style & Naming Conventions
- Python: PEP 8 style, 4-space indentation, `snake_case` for functions/variables, `PascalCase` for classes.
- Django: keep business logic in `core/services/` when it does not belong in serializers/views.
- JavaScript/React Native: functional components, `PascalCase` component filenames (for example `LoginScreen.js`), `camelCase` for variables/hooks.
- Keep modules focused; prefer small serializers/services over large multi-purpose files.

## Testing Guidelines
- Backend tests live in `core/tests/` and follow `test_*.py` naming.
- Pytest is configured in `pyproject.toml`, but `manage.py test` is the standard workflow used here.
- Add or update tests with every behavior change (API contract, matching logic, subscriptions, messaging).

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `refactor: ...`, `chore: ...`.
- Keep commits scoped to one logical change.
- PRs should include:
  - concise summary of behavior changes,
  - linked issue/task,
  - test evidence (command + result),
  - screenshots/video for mobile UI changes.

## Security & Configuration Tips
- Copy env templates: `.env.example` and mobile env files before local runs.
- Never commit secrets, tokens, or production credentials.
- Validate CORS/auth changes carefully; these affect both API and mobile login flows.
