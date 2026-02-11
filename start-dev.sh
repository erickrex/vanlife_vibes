#!/bin/bash

# VanlifeVibes Development Startup Script
# This script starts both backend and frontend servers

echo "🚀 Starting VanlifeVibes Development Environment"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your database credentials."
    echo ""
fi

# Check if frontend/.env exists
if [ ! -f frontend/.env ]; then
    echo "⚠️  frontend/.env file not found. Creating from frontend/.env.example..."
    cp frontend/.env.example frontend/.env
    echo "✅ Created frontend/.env file."
    echo ""
fi

# Check if UV is installed
if ! command -v uv &> /dev/null; then
    echo "❌ UV is not installed. Please install it first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check if node_modules exists in frontend
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    echo "✅ Frontend dependencies installed."
    echo ""
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "🔧 Starting Backend Server..."
uv run python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

echo "🎨 Starting Frontend Server..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo ""
echo "📍 Access the application at:"
echo "   Frontend:     http://localhost:5173"
echo "   Backend API:  http://0.0.0.0:8000/api/v1"
echo "   Django Admin: http://0.0.0.0:8000/admin"
echo "   Mobile LAN:   http://<your-lan-ip>:8000/api/v1"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
