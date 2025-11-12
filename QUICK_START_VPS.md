# Quick Start - VPS Deployment

**Fast deployment guide** - Get your EVM Smart Contract Platform running on Ubuntu VPS in minutes.

## Prerequisites

- Ubuntu 20.04+ VPS
- Root/sudo access
- Domain name (optional)

## The Key Rule

⚠️ **CRITICAL**: Create your `.env` file on the VPS **BEFORE** running `npm run build`

Frontend variables like `VITE_REOWN_PROJECT_ID` are baked into the build at compile time!

## 5-Minute Deployment

### 1. Prepare VPS

```bash
# SSH into VPS
ssh user@your-vps-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y curl git nginx postgresql postgresql-contrib

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Setup PostgreSQL

```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE evm_contracts;
CREATE USER evm_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE evm_contracts TO evm_user;
\c evm_contracts
GRANT ALL ON SCHEMA public TO evm_user;
ALTER DATABASE evm_contracts OWNER TO evm_user;
EOF
```

### 3. Upload Project

**Option A: Git Clone**
```bash
cd /var/www
sudo git clone YOUR_REPO_URL evm-contracts
cd evm-contracts
```

**Option B: Direct Upload**
```bash
# On local machine
tar -czf evm-deployer.tar.gz --exclude='node_modules' --exclude='dist' .

# Upload
scp evm-deployer.tar.gz user@your-vps-ip:/tmp/

# On VPS
sudo mkdir -p /var/www/evm-contracts
cd /var/www/evm-contracts
sudo tar -xzf /tmp/evm-deployer.tar.gz
```

### 4. Create .env File (MOST IMPORTANT STEP!)

```bash
cd /var/www/evm-contracts

# Create .env file
sudo nano .env
```

**Paste this and fill in your values:**

```env
NODE_ENV=production

# Database (use the password you set in step 2)
DATABASE_URL=postgresql://evm_user:YOUR_SECURE_PASSWORD@localhost:5432/evm_contracts

# Generate session secret: openssl rand -base64 64
SESSION_SECRET=PASTE_GENERATED_SECRET_HERE

# Get from https://etherscan.io/myapikey
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Optional (for BSC/Polygon verification)
BSCSCAN_API_KEY=your_bscscan_key_optional
POLYGONSCAN_API_KEY=your_polygonscan_key_optional

# Get from https://cloud.reown.com/ (REQUIRED for wallet connection!)
VITE_REOWN_PROJECT_ID=your_reown_project_id_here

# Server settings
PORT=5000
ALLOWED_ORIGINS=https://your-domain.com
SECURE_COOKIES=true
COOKIE_DOMAIN=your-domain.com
```

Save and close (Ctrl+X, Y, Enter)

### 5. Build and Deploy

```bash
# Install dependencies
npm install --production

# Push database schema
npm run db:push

# Build application (this uses the .env file you just created!)
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Configure auto-start
pm2 save
pm2 startup   # Follow the instruction it prints
```

### 6. Configure Nginx

```bash
# Update nginx config
sudo nano /etc/nginx/sites-available/default
```

Replace contents with:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Configure firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow 22
sudo ufw enable
```

### 7. Setup SSL (Optional but Recommended)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 8. Verify Deployment

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs evm-contract-platform

# Test the application
curl http://localhost:5000
```

Visit `https://your-domain.com` in your browser!

---

## Common Issues & Quick Fixes

### ❌ "VITE_REOWN_PROJECT_ID is not defined"

**Problem:** Built without the environment variable

**Fix:**
```bash
cd /var/www/evm-contracts
# Verify .env has VITE_REOWN_PROJECT_ID
cat .env | grep VITE_REOWN_PROJECT_ID

# If missing, add it to .env, then rebuild:
npm run build
pm2 restart evm-contract-platform
```

### ❌ Database connection fails

**Fix:**
```bash
# Test database connection
psql "postgresql://evm_user:YOUR_PASSWORD@localhost:5432/evm_contracts"

# If fails, recreate database (step 2)
```

### ❌ Port 5000 already in use

**Fix:**
```bash
sudo lsof -i :5000
# Kill the process or change PORT in .env
```

---

## Useful Commands

```bash
# View application logs
pm2 logs evm-contract-platform

# Restart application
pm2 restart evm-contract-platform

# Stop application
pm2 stop evm-contract-platform

# Monitor resources
pm2 monit

# After changing .env (backend variables only)
pm2 restart evm-contract-platform

# After changing .env (VITE_* variables)
npm run build && pm2 restart evm-contract-platform
```

---

## Getting API Keys

### Etherscan API Key (Required)
1. Go to https://etherscan.io/
2. Create account
3. Visit https://etherscan.io/myapikey
4. Create API key
5. Add to `.env` as `ETHERSCAN_API_KEY`

### Reown Project ID (Required for Wallet)
1. Go to https://cloud.reown.com/
2. Create account
3. Create new project
4. Copy Project ID
5. Add to `.env` as `VITE_REOWN_PROJECT_ID`

---

## Next Steps

- [ ] Setup regular database backups
- [ ] Configure monitoring (PM2 Plus, etc.)
- [ ] Setup log rotation
- [ ] Configure rate limiting
- [ ] Add domain to Reown allowed domains

---

## Need More Details?

- **Full deployment guide:** See `VPS_DEPLOYMENT_GUIDE.md`
- **Ubuntu setup:** See `LOCAL_SETUP_UBUNTU.md`  
- **Automated deployment:** Run `sudo ./deploy-vps.sh`

---

**🎉 You're live!** Your smart contract deployment platform is now running on your VPS.
