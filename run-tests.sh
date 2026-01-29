#!/bin/bash

# VanlifeVibes Test Runner
# Runs both backend and frontend tests

echo "🧪 Running VanlifeVibes Test Suite"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
BACKEND_PASSED=0
FRONTEND_PASSED=0

# Run backend tests
echo "📦 Running Backend Tests..."
echo "================================"
if uv run python manage.py test core.tests --verbosity=2; then
    echo -e "${GREEN}✅ Backend tests passed${NC}"
    BACKEND_PASSED=1
else
    echo -e "${RED}❌ Backend tests failed${NC}"
fi
echo ""

# Run frontend tests
echo "🎨 Running Frontend Tests..."
echo "================================"
cd frontend
if npm test; then
    echo -e "${GREEN}✅ Frontend tests passed${NC}"
    FRONTEND_PASSED=1
else
    echo -e "${RED}❌ Frontend tests failed${NC}"
fi
cd ..
echo ""

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
if [ $BACKEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Backend: PASSED${NC}"
else
    echo -e "${RED}❌ Backend: FAILED${NC}"
fi

if [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Frontend: PASSED${NC}"
else
    echo -e "${RED}❌ Frontend: FAILED${NC}"
fi
echo ""

# Exit with error if any tests failed
if [ $BACKEND_PASSED -eq 1 ] && [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi
