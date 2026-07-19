#!/bin/sh
set -e

python manage.py migrate --noinput

exec gunicorn sokens_backend.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 3
