#!/bin/bash

# Production Build Script with Environment Variable Validation
# This ensures all required variables are set before building

set -e

echo "=========================================="
echo "Production Build with Environment Checks"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load .env file if it exists
if [ -f .env ]; then
    echo -e "${GREEN}✓ Found .env file${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}✗ .env file not found!${NC}"
    echo "Please create a .env file with your configuration."
    exit 1
fi

# Check required backend environment variables
echo ""
echo "Checking backend environment variables..."

REQUIRED_BACKEND_VARS=(
    "DATABASE_URL"
    "SESSION_SECRET"
)

MISSING_BACKEND=0
for var in "${REQUIRED_BACKEND_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}✗ Missing: $var${NC}"
        MISSING_BACKEND=1
    else
        echo -e "${GREEN}✓ $var is set${NC}"
    fi
done

# Check optional but recommended backend variables
echo ""
echo "Checking optional backend variables..."

OPTIONAL_BACKEND_VARS=(
    "ETHERSCAN_API_KEY"
    "BSCSCAN_API_KEY"
    "POLYGONSCAN_API_KEY"
)

for var in "${OPTIONAL_BACKEND_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}⚠ Optional: $var is not set (contract verification may not work)${NC}"
    else
        echo -e "${GREEN}✓ $var is set${NC}"
    fi
done

# Check frontend environment variables (VITE_*)
echo ""
echo "Checking frontend environment variables..."

if [ -z "$VITE_REOWN_PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠ VITE_REOWN_PROJECT_ID is not set${NC}"
    echo -e "${YELLOW}  Wallet connection will be disabled in production${NC}"
    read -p "Continue without wallet connection? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Build cancelled. Please add VITE_REOWN_PROJECT_ID to .env"
        exit 1
    fi
else
    echo -e "${GREEN}✓ VITE_REOWN_PROJECT_ID is set${NC}"
fi

# Stop if required variables are missing
if [ $MISSING_BACKEND -eq 1 ]; then
    echo ""
    echo -e "${RED}Build cancelled due to missing required variables${NC}"
    exit 1
fi

# Show build environment
echo ""
echo "Building with environment:"
echo "  NODE_ENV: ${NODE_ENV:-production}"
echo "  Database: $(echo $DATABASE_URL | sed 's/:[^@]*@/:***@/')"
echo "  Session Secret: $(echo ${SESSION_SECRET:0:10})..."
echo "  Reown Project ID: ${VITE_REOWN_PROJECT_ID:-[not set]}"
echo ""

read -p "Proceed with build? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled."
    exit 1
fi

# Build the application
echo ""
echo -e "${YELLOW}Building application...${NC}"

# Build frontend and backend
npm run build

echo ""
echo -e "${GREEN}=========================================="
echo "Build Complete! 🚀"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Start the production server with: npm start"
echo "2. Or use PM2: pm2 start ecosystem.config.js"
echo ""
