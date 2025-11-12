#!/bin/bash

# EVM Smart Contract Platform - VPS Deployment Script
# This script automates the deployment process to an Ubuntu VPS

set -e

echo "================================================"
echo "EVM Contract Platform - VPS Deployment Script"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="evm-contracts"
APP_DIR="/var/www/${APP_NAME}"
LOG_DIR="/var/log/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
SYSTEMD_SERVICE="/etc/systemd/system/${APP_NAME}.service"

echo -e "${BLUE}This script will:${NC}"
echo "1. Install required dependencies"
echo "2. Set up the application directory"
echo "3. Build the application"
echo "4. Configure Nginx reverse proxy"
echo "5. Set up PM2 or systemd service"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root or with sudo${NC}" 
   exit 1
fi

# Step 1: Install dependencies
echo ""
echo -e "${YELLOW}[1/7] Installing system dependencies...${NC}"
apt update
apt install -y curl git nginx postgresql postgresql-contrib

# Install Node.js 20.x if not installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"

# Step 2: Create application directory
echo ""
echo -e "${YELLOW}[2/7] Setting up application directory...${NC}"
mkdir -p ${APP_DIR}
mkdir -p ${LOG_DIR}

# Copy files (assumes script is run from project directory)
echo "Copying application files..."
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'dist' ./ ${APP_DIR}/

cd ${APP_DIR}
echo -e "${GREEN}✓ Application directory created${NC}"

# Step 3: Install npm dependencies
echo ""
echo -e "${YELLOW}[3/7] Installing npm dependencies...${NC}"
npm install --production
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 4: Build the application
echo ""
echo -e "${YELLOW}[4/7] Building application...${NC}"
npm run build
echo -e "${GREEN}✓ Application built${NC}"

# Step 5: Set up environment file
echo ""
echo -e "${YELLOW}[5/7] Environment configuration...${NC}"
if [ ! -f ${APP_DIR}/.env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    cp ${APP_DIR}/.env.template ${APP_DIR}/.env
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 64)
    sed -i "s/your-random-secret-key-change-this-in-production/${SESSION_SECRET}/" ${APP_DIR}/.env
    
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠ IMPORTANT: Edit ${APP_DIR}/.env and update:${NC}"
    echo "  - DATABASE_URL with your PostgreSQL credentials"
    echo "  - ETHERSCAN_API_KEY"
    echo "  - VITE_REOWN_PROJECT_ID"
    echo "  - ALLOWED_ORIGINS with your domain"
    echo "  - COOKIE_DOMAIN with your domain"
    echo ""
    read -p "Press Enter after updating .env file..."
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Step 6: Configure Nginx
echo ""
echo -e "${YELLOW}[6/7] Configuring Nginx...${NC}"
cp ${APP_DIR}/nginx.conf ${NGINX_CONF}

echo "Enter your domain name (e.g., example.com):"
read DOMAIN_NAME

if [ ! -z "$DOMAIN_NAME" ]; then
    sed -i "s/your-domain.com/${DOMAIN_NAME}/g" ${NGINX_CONF}
    echo -e "${GREEN}✓ Nginx configured for ${DOMAIN_NAME}${NC}"
else
    echo -e "${YELLOW}⚠ No domain provided. Edit ${NGINX_CONF} manually${NC}"
fi

# Enable nginx site
ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo -e "${GREEN}✓ Nginx configured and reloaded${NC}"

# Step 7: Choose process manager
echo ""
echo -e "${YELLOW}[7/7] Setting up process manager...${NC}"
echo "Choose process manager:"
echo "1) PM2 (recommended for multiple instances)"
echo "2) systemd (native Linux service)"
read -p "Enter choice (1 or 2): " PM_CHOICE

if [ "$PM_CHOICE" = "1" ]; then
    # Install and configure PM2
    echo "Installing PM2..."
    npm install -g pm2
    
    # Start app with PM2
    pm2 delete ${APP_NAME} 2>/dev/null || true
    pm2 start ${APP_DIR}/ecosystem.config.js
    pm2 save
    pm2 startup | tail -n 1 | bash
    
    echo -e "${GREEN}✓ Application started with PM2${NC}"
    echo ""
    echo "Useful PM2 commands:"
    echo "  pm2 status          - Check status"
    echo "  pm2 logs ${APP_NAME}     - View logs"
    echo "  pm2 restart ${APP_NAME}  - Restart app"
    echo "  pm2 stop ${APP_NAME}     - Stop app"
    
elif [ "$PM_CHOICE" = "2" ]; then
    # Configure systemd
    echo "Configuring systemd service..."
    
    # Update service file with correct paths
    sed -i "s|/var/www/evm-contracts|${APP_DIR}|g" ${APP_DIR}/evm-contracts.service
    cp ${APP_DIR}/evm-contracts.service ${SYSTEMD_SERVICE}
    
    # Set permissions
    chown -R www-data:www-data ${APP_DIR}
    chown -R www-data:www-data ${LOG_DIR}
    
    # Enable and start service
    systemctl daemon-reload
    systemctl enable ${APP_NAME}
    systemctl start ${APP_NAME}
    
    echo -e "${GREEN}✓ Application started with systemd${NC}"
    echo ""
    echo "Useful systemd commands:"
    echo "  systemctl status ${APP_NAME}   - Check status"
    echo "  journalctl -u ${APP_NAME} -f   - View logs"
    echo "  systemctl restart ${APP_NAME}  - Restart app"
    echo "  systemctl stop ${APP_NAME}     - Stop app"
else
    echo -e "${RED}Invalid choice. Please configure process manager manually.${NC}"
fi

# Database setup reminder
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Deployment Complete! 🚀${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Set up PostgreSQL database:"
echo "   sudo -u postgres psql"
echo "   CREATE DATABASE evm_contracts;"
echo "   CREATE USER evm_user WITH ENCRYPTED PASSWORD 'your_password';"
echo "   GRANT ALL PRIVILEGES ON DATABASE evm_contracts TO evm_user;"
echo "   \c evm_contracts"
echo "   GRANT ALL ON SCHEMA public TO evm_user;"
echo "   ALTER DATABASE evm_contracts OWNER TO evm_user;"
echo ""
echo "2. Push database schema:"
echo "   cd ${APP_DIR}"
echo "   npm run db:push"
echo ""
echo "3. Set up SSL with Let's Encrypt (recommended):"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d ${DOMAIN_NAME}"
echo ""
echo "4. Configure firewall:"
echo "   sudo ufw allow 'Nginx Full'"
echo "   sudo ufw enable"
echo ""
echo "5. Test your application:"
echo "   http://${DOMAIN_NAME} (or http://your-server-ip)"
echo ""
echo -e "${YELLOW}Security Reminders:${NC}"
echo "- Update .env with strong passwords and secrets"
echo "- Enable SSL/HTTPS before going to production"
echo "- Set up regular backups for your database"
echo "- Keep your system and dependencies updated"
echo ""
