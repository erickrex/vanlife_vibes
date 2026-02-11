#!/bin/bash

# VanlifeVibes Development Startup Script
# This script starts backend and mobile Expo servers

echo "🚀 Starting VanlifeVibes Development Environment"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your database credentials."
    echo ""
fi

# Check if mobile-app/.env exists
if [ ! -f mobile-app/.env ] && [ -f mobile-app/.env.example ]; then
    echo "⚠️  mobile-app/.env file not found. Creating from mobile-app/.env.example..."
    cp mobile-app/.env.example mobile-app/.env
    echo "✅ Created mobile-app/.env file."
    echo ""
fi

# Check if UV is installed
if ! command -v uv &> /dev/null; then
    echo "❌ UV is not installed. Please install it first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check if node_modules exists in mobile-app
if [ ! -d "mobile-app/node_modules" ]; then
    echo "📦 Installing mobile dependencies..."
    cd mobile-app && npm install && cd ..
    echo "✅ Mobile dependencies installed."
    echo ""
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $MOBILE_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "🔧 Starting Backend Server..."
uv run python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

echo "📱 Starting Mobile Expo Server..."
cd mobile-app && npx expo start --lan &
MOBILE_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo ""
echo "📍 Access the application at:"
echo "   Expo DevTools: (opened by Expo CLI)"
echo "   Backend API:  http://0.0.0.0:8000/api/v1"
echo "   Django Admin: http://0.0.0.0:8000/admin"
echo "   Mobile LAN:   http://<your-lan-ip>:8000/api/v1"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $MOBILE_PID
