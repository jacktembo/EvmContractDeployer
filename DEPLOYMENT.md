# Production Deployment Guide - Ubuntu VPS

Complete guide for deploying the EVM Smart Contract Platform to an Ubuntu VPS.

## Quick Deployment

For automated deployment, run:

```bash
chmod +x deploy-vps.sh
sudo ./deploy-vps.sh
```

## Manual Deployment Steps

### Prerequisites

- Ubuntu 20.04 LTS or later
- Root or sudo access
- Domain name (optional but recommended)
- At least 2GB RAM and 20GB storage

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git nginx postgresql postgresql-contrib ufw

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node --version
npm --version
psql --version
```

### 2. PostgreSQL Setup

```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOSQL'
CREATE DATABASE evm_contracts;
CREATE USER evm_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE evm_contracts TO evm_user;
\c evm_contracts
GRANT ALL ON SCHEMA public TO evm_user;
ALTER DATABASE evm_contracts OWNER TO evm_user;
EOSQL
```

### 3. Application Setup

```bash
# Create application directory
sudo mkdir -p /var/www/evm-contracts
sudo mkdir -p /var/log/evm-contracts

# Clone or upload your project
# Option 1: Git clone
git clone <your-repo-url> /var/www/evm-contracts

# Option 2: Upload files via SCP
scp -r ./* user@your-server:/var/www/evm-contracts/

# Navigate to directory
cd /var/www/evm-contracts

# Install dependencies
npm install --production

# Build application
npm run build
```

### 4. Environment Configuration

```bash
# Copy environment template
cp .env.template .env

# Generate secure session secret
SESSION_SECRET=$(openssl rand -base64 64)

# Edit .env file
nano .env
```

Update the following variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://evm_user:your_secure_password@localhost:5432/evm_contracts
SESSION_SECRET=<generated-secret>
ETHERSCAN_API_KEY=<your-key>
VITE_REOWN_PROJECT_ID=<your-project-id>
ALLOWED_ORIGINS=https://your-domain.com
COOKIE_DOMAIN=your-domain.com
```

### 5. Database Schema Migration

```bash
# Push schema to database
npm run db:push
```

### 6. Process Manager Setup

Choose one of the following options:

#### Option A: PM2 (Recommended)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Enable startup on boot
pm2 startup
pm2 save

# View logs
pm2 logs evm-contract-platform

# Monitor
pm2 monit
```

#### Option B: systemd Service

```bash
# Copy service file
sudo cp evm-contracts.service /etc/systemd/system/

# Set correct permissions
sudo chown -R www-data:www-data /var/www/evm-contracts
sudo chown -R www-data:www-data /var/log/evm-contracts

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable evm-contracts
sudo systemctl start evm-contracts

# Check status
sudo systemctl status evm-contracts

# View logs
sudo journalctl -u evm-contracts -f
```

### 7. Nginx Configuration

```bash
# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/evm-contracts

# Update domain name in config
sudo nano /etc/nginx/sites-available/evm-contracts
# Replace 'your-domain.com' with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/evm-contracts /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 8. SSL/HTTPS Setup with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

The certbot will automatically update your nginx configuration for HTTPS.

### 9. Firewall Configuration

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 10. Verify Deployment

```bash
# Check application is running
curl http://localhost:5000

# Check from outside
curl https://your-domain.com

# Monitor logs
# With PM2:
pm2 logs evm-contract-platform

# With systemd:
sudo journalctl -u evm-contracts -f
```

## Post-Deployment

### Security Checklist

- [ ] Strong database password
- [ ] Secure SESSION_SECRET generated
- [ ] SSL/HTTPS enabled
- [ ] Firewall configured
- [ ] Regular backups set up
- [ ] Keep system updated
- [ ] Monitor logs regularly
- [ ] Use environment-specific API keys

### Backup Strategy

```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump evm_contracts > $BACKUP_DIR/evm_contracts_$DATE.sql

# Keep last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
```

### Monitoring

Set up monitoring with:
- PM2 monitoring: `pm2 monit`
- Nginx access logs: `/var/log/nginx/access.log`
- Application logs: `/var/log/evm-contracts/` or PM2 logs
- Database logs: `/var/log/postgresql/`

### Updating the Application

```bash
# Navigate to app directory
cd /var/www/evm-contracts

# Pull latest changes (if using git)
git pull origin main

# Install dependencies
npm install --production

# Build application
npm run build

# Restart application
# With PM2:
pm2 restart evm-contract-platform

# With systemd:
sudo systemctl restart evm-contracts
```

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs evm-contract-platform
# or
sudo journalctl -u evm-contracts -n 50

# Check if port is in use
sudo lsof -i :5000

# Check environment variables
pm2 env 0
```

### Database Connection Issues

```bash
# Test database connection
psql -U evm_user -d evm_contracts -h localhost

# Check PostgreSQL is running
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Nginx Issues

```bash
# Test nginx config
sudo nginx -t

# Check nginx is running
sudo systemctl status nginx

# View nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Performance Tuning

For production environments with high traffic:

1. **Increase PM2 instances**: Edit `ecosystem.config.js` and set `instances: 4`
2. **Enable nginx caching**: Add caching directives to nginx config
3. **Optimize PostgreSQL**: Tune `postgresql.conf` for your server resources
4. **Add Redis**: Implement Redis for session storage and caching

## Support & Resources

- Application logs: `/var/log/evm-contracts/`
- Nginx logs: `/var/log/nginx/`
- PostgreSQL logs: `/var/log/postgresql/`
- PM2 docs: https://pm2.keymetrics.io/
- Nginx docs: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/

## Rollback Procedure

If deployment fails:

```bash
# Stop application
pm2 stop evm-contract-platform
# or
sudo systemctl stop evm-contracts

# Restore database backup
sudo -u postgres psql evm_contracts < /var/backups/postgresql/backup.sql

# Revert code changes
git reset --hard <previous-commit>

# Rebuild
npm install --production
npm run build

# Restart
pm2 restart evm-contract-platform
```
