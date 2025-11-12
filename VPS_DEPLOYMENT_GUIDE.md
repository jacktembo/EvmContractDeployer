# Complete VPS Deployment Guide

## Understanding Environment Variables in Production

**Important:** This application uses TWO types of environment variables:

### 1. Backend Variables (Runtime)
- `DATABASE_URL`, `SESSION_SECRET`, etc.
- These are loaded when the server **starts**
- Can be set via `.env` file on the VPS

### 2. Frontend Variables (Build-time)
- `VITE_REOWN_PROJECT_ID` and any `VITE_*` variables
- These are **baked into the frontend** during the `npm run build` step
- **MUST be present BEFORE building**
- Cannot be changed after building without rebuilding

## Deployment Methods

### Method 1: Build on VPS (Recommended)

This is the **proper way** - you build directly on the VPS where environment variables are already set.

#### Step 1: Upload Project to VPS

```bash
# On your local machine, create a zip without node_modules
tar -czf evm-deployer.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  .

# Upload to VPS
scp evm-deployer.tar.gz user@your-vps-ip:/var/www/

# Or use git
ssh user@your-vps-ip
cd /var/www
git clone <your-repo-url> evm-contracts
```

#### Step 2: Set Up Environment on VPS

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Navigate to project
cd /var/www/evm-contracts

# Create .env file with ALL variables
nano .env
```

**Complete .env file:**
```env
# Node Environment
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://evm_user:your_password@localhost:5432/evm_contracts

# Session Secret (generate with: openssl rand -base64 64)
SESSION_SECRET=your_generated_secret_here

# API Keys for Contract Verification
ETHERSCAN_API_KEY=your_etherscan_key
BSCSCAN_API_KEY=your_bscscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key

# Frontend Variable (MUST be set before building!)
VITE_REOWN_PROJECT_ID=your_reown_project_id

# Server Configuration
PORT=5000
ALLOWED_ORIGINS=https://your-domain.com
SECURE_COOKIES=true
COOKIE_DOMAIN=your-domain.com
```

#### Step 3: Install and Build on VPS

```bash
# Install dependencies
npm install --production

# IMPORTANT: The .env file MUST exist before this step!
# Build with environment variables
npm run build

# The build will include VITE_REOWN_PROJECT_ID in the frontend bundle
```

#### Step 4: Verify Build

```bash
# Check that the build includes environment variables
grep -r "VITE_REOWN_PROJECT_ID" dist/ || echo "Variable not found in build!"

# If not found, rebuild:
# 1. Verify .env has VITE_REOWN_PROJECT_ID
# 2. Run: npm run build again
```

#### Step 5: Start with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start application (PM2 will load .env automatically)
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up auto-start on reboot
pm2 startup
```

---

### Method 2: Build Locally, Deploy Binary

If you want to build on your local machine and deploy to VPS:

#### Step 1: Set Environment Variables Locally

```bash
# Create .env.production locally
cat > .env.production << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://evm_user:password@YOUR_VPS_IP:5432/evm_contracts
SESSION_SECRET=your_session_secret
ETHERSCAN_API_KEY=your_etherscan_key
VITE_REOWN_PROJECT_ID=your_reown_project_id
EOF

# Copy to .env for build
cp .env.production .env
```

#### Step 2: Build Locally

```bash
# Build with production environment
npm run build

# This creates dist/ folder with everything baked in
```

#### Step 3: Deploy to VPS

```bash
# Create deployment package
tar -czf deploy.tar.gz dist/ node_modules/ package.json ecosystem.config.js

# Upload to VPS
scp deploy.tar.gz user@your-vps-ip:/var/www/

# SSH and extract
ssh user@your-vps-ip
cd /var/www
mkdir -p evm-contracts
cd evm-contracts
tar -xzf ../deploy.tar.gz

# Create .env on VPS (for runtime backend variables)
nano .env
```

**VPS .env (runtime only):**
```env
NODE_ENV=production
DATABASE_URL=postgresql://evm_user:password@localhost:5432/evm_contracts
SESSION_SECRET=your_session_secret
ETHERSCAN_API_KEY=your_etherscan_key
PORT=5000
```

Note: You DON'T need `VITE_REOWN_PROJECT_ID` here because it's already baked into the build.

#### Step 4: Start on VPS

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Troubleshooting

### Problem: Wallet Connection Not Working in Production

**Symptom:** Console shows "VITE_REOWN_PROJECT_ID is not defined"

**Cause:** The frontend was built without the environment variable.

**Solution:**
1. On VPS, verify `.env` has `VITE_REOWN_PROJECT_ID=your_id`
2. Rebuild: `npm run build`
3. Restart: `pm2 restart evm-contract-platform`

### Problem: Database Connection Fails

**Symptom:** "Error: password authentication failed"

**Cause:** Database URL not set or incorrect.

**Solution:**
1. Verify `.env` has correct `DATABASE_URL`
2. Test connection: `psql postgresql://evm_user:password@localhost:5432/evm_contracts`
3. Restart PM2: `pm2 restart evm-contract-platform`

### Problem: Changes to .env Not Taking Effect

**For Backend Variables:**
```bash
# Just restart PM2
pm2 restart evm-contract-platform
```

**For Frontend Variables (VITE_*):**
```bash
# Must rebuild!
npm run build
pm2 restart evm-contract-platform
```

---

## Validation Script

Before deploying, validate your environment:

```bash
# Make script executable
chmod +x scripts/build-production.sh

# Run validation and build
bash scripts/build-production.sh
```

This script will:
- Check all required variables are set
- Warn about missing optional variables
- Build the application with environment validation

---

## Quick Reference

### Environment Variable Checklist

- [ ] **DATABASE_URL** - PostgreSQL connection string
- [ ] **SESSION_SECRET** - Random secure string (64+ chars)
- [ ] **ETHERSCAN_API_KEY** - For contract verification
- [ ] **VITE_REOWN_PROJECT_ID** - For wallet connection
- [ ] **.env file exists on VPS before building**
- [ ] **Built on VPS OR built locally with production .env**

### Commands Cheat Sheet

```bash
# Build on VPS
npm install --production
npm run build
pm2 start ecosystem.config.js

# Check PM2 status
pm2 status
pm2 logs evm-contract-platform

# Restart after .env changes
pm2 restart evm-contract-platform

# Rebuild after VITE_* changes
npm run build && pm2 restart evm-contract-platform

# Check environment in PM2
pm2 env 0
```

---

## Security Best Practices

1. **Never commit .env to git**
   ```bash
   echo ".env" >> .gitignore
   echo ".env.production" >> .gitignore
   ```

2. **Generate strong secrets**
   ```bash
   openssl rand -base64 64
   ```

3. **Restrict file permissions**
   ```bash
   chmod 600 /var/www/evm-contracts/.env
   chown www-data:www-data /var/www/evm-contracts/.env
   ```

4. **Use environment-specific keys**
   - Don't use production database in development
   - Use separate API keys for staging/production

---

## Why Can't We Just Hardcode Everything?

**Security Risks:**
- Database passwords exposed in code
- API keys visible to anyone with code access
- Can't rotate credentials without redeploying code
- Violates security compliance standards

**Better Approach:**
- Environment variables keep secrets separate from code
- Can update credentials without code changes
- Different values for dev/staging/production
- Industry standard security practice

The proper solution is to ensure `.env` file exists on the VPS with all required variables BEFORE building.
