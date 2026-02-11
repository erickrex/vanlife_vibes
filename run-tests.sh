#!/bin/bash

# VanlifeVibes Test Runner
# Runs backend tests and optional mobile tests

echo "🧪 Running VanlifeVibes Test Suite"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
BACKEND_PASSED=0
MOBILE_PASSED=1

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

# Run mobile tests (if configured)
echo "📱 Running Mobile Tests..."
echo "================================"
if [ -d "mobile-app" ]; then
    cd mobile-app
    if npm run | grep -qE "^[[:space:]]+test"; then
        if npm test; then
            echo -e "${GREEN}✅ Mobile tests passed${NC}"
            MOBILE_PASSED=1
        else
            echo -e "${RED}❌ Mobile tests failed${NC}"
            MOBILE_PASSED=0
        fi
    else
        echo -e "${YELLOW}⚠️  No mobile test script configured; skipping${NC}"
        MOBILE_PASSED=1
    fi
    cd ..
else
    echo -e "${YELLOW}⚠️  mobile-app directory not found; skipping mobile tests${NC}"
    MOBILE_PASSED=1
fi
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

if [ $MOBILE_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Mobile: PASSED${NC}"
else
    echo -e "${RED}❌ Mobile: FAILED${NC}"
fi
echo ""

# Exit with error if any tests failed
if [ $BACKEND_PASSED -eq 1 ] && [ $MOBILE_PASSED -eq 1 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi
