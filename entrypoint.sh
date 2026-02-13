#!/bin/bash
set -e
uv run python manage.py migrate --noinput

if [ "${ENABLE_HOSTED_EVENTS_SCHEDULER:-false}" = "true" ]; then
  echo "Starting hosted events scheduler loop..."
  (
    while true; do
      uv run python manage.py generate_hosted_events || true
      sleep "${HOSTED_EVENTS_SCHEDULER_INTERVAL_SECONDS:-3600}"
    done
  ) &
fi

exec uv run daphne -b 0.0.0.0 -p 8000 vanlifevibes.asgi:application
