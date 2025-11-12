#!/bin/bash

# EVM Smart Contract Platform - Ubuntu Setup Script
# This script helps automate the setup process

set -e

echo "======================================"
echo "EVM Contract Platform - Ubuntu Setup"
echo "======================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js is installed: $NODE_VERSION${NC}"
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠ PostgreSQL is not installed${NC}"
    read -p "Install PostgreSQL? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo apt update
        sudo apt install postgresql postgresql-contrib -y
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        echo -e "${GREEN}✓ PostgreSQL installed and started${NC}"
    fi
else
    echo -e "${GREEN}✓ PostgreSQL is installed${NC}"
fi

# Install npm dependencies
echo ""
echo "Installing project dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo -e "${YELLOW}Creating .env file...${NC}"
    
    # Generate random session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://evm_user:your_secure_password@localhost:5432/evm_contracts

# Session Secret (auto-generated)
SESSION_SECRET=$SESSION_SECRET

# Etherscan API Key (for contract verification)
# Get your API key from: https://etherscan.io/myapikey
ETHERSCAN_API_KEY=your_etherscan_api_key

# Reown (WalletConnect) Project ID (for wallet connection)
# Get your project ID from: https://cloud.reown.com/
VITE_REOWN_PROJECT_ID=your_reown_project_id
EOF
    
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠ IMPORTANT: Edit .env file and add your API keys:${NC}"
    echo "  1. Set your PostgreSQL password"
    echo "  2. Add ETHERSCAN_API_KEY from https://etherscan.io/myapikey"
    echo "  3. Add VITE_REOWN_PROJECT_ID from https://cloud.reown.com/"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Database setup
echo ""
echo -e "${YELLOW}Database Setup${NC}"
echo "To set up PostgreSQL database, run these commands:"
echo ""
echo "sudo -u postgres psql << 'EOSQL'"
echo "CREATE DATABASE evm_contracts;"
echo "CREATE USER evm_user WITH ENCRYPTED PASSWORD 'your_secure_password';"
echo "GRANT ALL PRIVILEGES ON DATABASE evm_contracts TO evm_user;"
echo "\c evm_contracts"
echo "GRANT ALL ON SCHEMA public TO evm_user;"
echo "ALTER DATABASE evm_contracts OWNER TO evm_user;"
echo "EOSQL"
echo ""

read -p "Have you set up the database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Pushing database schema..."
    npm run db:push || npm run db:push -- --force
    echo -e "${GREEN}✓ Database schema initialized${NC}"
else
    echo -e "${YELLOW}⚠ Remember to set up the database and run: npm run db:push${NC}"
fi

echo ""
echo -e "${GREEN}======================================"
echo "Setup Complete! 🚀"
echo "======================================${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Set up PostgreSQL database (if not done)"
echo "3. Run: npm run dev"
echo "4. Open: http://localhost:5000"
echo ""
echo "For detailed instructions, see: LOCAL_SETUP_UBUNTU.md"
echo ""
