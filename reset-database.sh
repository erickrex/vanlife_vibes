#!/bin/bash

# VanlifeVibes Database Reset Script
# This script drops and recreates the database with fresh migrations

echo "⚠️  WARNING: This will DELETE ALL DATA in the vanlifevibes database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "🗑️  Dropping existing database..."
psql -U postgres -c "DROP DATABASE IF EXISTS vanlifevibes;"

echo "📦 Creating fresh database..."
psql -U postgres -c "CREATE DATABASE vanlifevibes;"

echo "🔄 Removing old migrations..."
rm -rf core/migrations/
mkdir -p core/migrations
touch core/migrations/__init__.py

echo "✨ Generating fresh migrations from current models..."
uv run python manage.py makemigrations core

echo "🚀 Applying migrations..."
uv run python manage.py migrate

echo ""
echo "✅ Database reset complete!"
echo ""
echo "Next steps:"
echo "1. Create a superuser: uv run python manage.py createsuperuser"
echo "2. Start the development server: ./start-dev.sh"
echo "3. Run tests: ./run-tests.sh"
