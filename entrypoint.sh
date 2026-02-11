#!/bin/bash
set -e
uv run python manage.py migrate --noinput
exec uv run daphne -b 0.0.0.0 -p 8000 vanlifevibes.asgi:application
