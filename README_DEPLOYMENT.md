# EVM Smart Contract Platform - Deployment Documentation

Complete deployment resources for Ubuntu VPS.

## 📚 Available Documentation

### 🚀 Quick Start
- **[QUICK_START_VPS.md](QUICK_START_VPS.md)** - 5-minute deployment guide
  - Fast setup for experienced users
  - Copy-paste commands
  - Essential configuration only

### 📖 Complete Guides
- **[VPS_DEPLOYMENT_GUIDE.md](VPS_DEPLOYMENT_GUIDE.md)** - Complete VPS deployment guide
  - Understanding environment variables
  - Two deployment methods explained
  - Detailed troubleshooting
  - Security best practices

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Detailed manual deployment
  - Step-by-step instructions
  - PM2 and systemd options
  - Nginx configuration
  - SSL setup with Let's Encrypt

- **[LOCAL_SETUP_UBUNTU.md](LOCAL_SETUP_UBUNTU.md)** - Local development setup
  - Running locally on Ubuntu
  - Development environment
  - Troubleshooting tips

### 🤖 Automated Deployment
- **[deploy-vps.sh](deploy-vps.sh)** - Automated deployment script
  - One-command deployment
  - Interactive prompts
  - Validates configuration

## 🎯 Choose Your Path

### For Quick Deployment (Experienced Users)
```bash
# Follow QUICK_START_VPS.md
# 5 minutes to deployment
```

### For First-Time Deployment
```bash
# Read VPS_DEPLOYMENT_GUIDE.md first
# Then follow QUICK_START_VPS.md
```

### For Automated Deployment
```bash
chmod +x deploy-vps.sh
sudo ./deploy-vps.sh
```

## ⚠️ CRITICAL: Environment Variables

**The #1 Deployment Issue**: Frontend variables must be set BEFORE building!

### ✅ Correct Process
```bash
# 1. Create .env file with ALL variables including VITE_*
nano .env

# 2. THEN build (this bakes VITE_* into the frontend)
npm run build

# 3. Start application
pm2 start ecosystem.config.js
```

### ❌ Wrong Process
```bash
# Building first WITHOUT .env
npm run build  # ❌ VITE_* not included!

# Creating .env after build
nano .env      # ❌ Too late for frontend variables!

# Starting application
pm2 start      # ❌ Wallet connection won't work
```

## 🔑 Required Environment Variables

### Backend (Runtime)
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption key
- `ETHERSCAN_API_KEY` - Contract verification (optional but recommended)

### Frontend (Build-time)
- `VITE_REOWN_PROJECT_ID` - Wallet connection (MUST be set before building!)

See `.env.template` for complete list.

## 📋 Deployment Checklist

- [ ] VPS with Ubuntu 20.04+
- [ ] Node.js 20+ installed
- [ ] PostgreSQL installed and configured
- [ ] Database created with user permissions
- [ ] `.env` file created with ALL variables
- [ ] `VITE_REOWN_PROJECT_ID` added to `.env` BEFORE building
- [ ] Application built: `npm run build`
- [ ] Database schema pushed: `npm run db:push`
- [ ] PM2 or systemd configured
- [ ] Nginx reverse proxy set up
- [ ] Firewall configured (allow 80, 443, 22)
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Application accessible via domain

## 🆘 Quick Troubleshooting

### Wallet Connection Not Working
```bash
# Check if VITE_REOWN_PROJECT_ID was set before build
grep -r "VITE_REOWN_PROJECT_ID" dist/

# If not found, add to .env and rebuild:
npm run build
pm2 restart evm-contract-platform
```

### Database Connection Fails
```bash
# Test database connection
psql "postgresql://evm_user:password@localhost:5432/evm_contracts"

# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Port Already in Use
```bash
# Find what's using port 5000
sudo lsof -i :5000

# Kill it or change PORT in .env
```

## 🛠️ Helper Scripts

```bash
# Validate environment before building
bash scripts/build-production.sh

# Validate environment variables
node scripts/validate-env.js

# Automated deployment
sudo ./deploy-vps.sh

# Manual Ubuntu setup
bash ./setup-ubuntu.sh
```

## 🔒 Security Checklist

- [ ] Strong PostgreSQL password
- [ ] Secure SESSION_SECRET (64+ chars, use `openssl rand -base64 64`)
- [ ] SSL/HTTPS enabled
- [ ] Firewall configured (ufw)
- [ ] .env file permissions restricted (`chmod 600 .env`)
- [ ] .env not committed to git
- [ ] Regular database backups configured
- [ ] Separate API keys for production

## 🎓 Understanding the Deployment

### Why Can't I Change VITE_* Variables After Building?

Vite (the frontend build tool) performs **static code replacement** during build:

```javascript
// Before build (source code)
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

// After build (compiled code)
const projectId = "abc123def456";  // Value baked in!
```

This means:
1. ✅ Fast runtime (no environment lookup)
2. ❌ Can't change without rebuilding
3. ⚠️ MUST be set before `npm run build`

### Backend vs Frontend Variables

| Type | Example | When Loaded | Can Change After Build? |
|------|---------|-------------|------------------------|
| Backend | `DATABASE_URL` | Runtime | ✅ Yes (restart needed) |
| Backend | `SESSION_SECRET` | Runtime | ✅ Yes (restart needed) |
| Frontend | `VITE_REOWN_PROJECT_ID` | Build-time | ❌ No (rebuild needed) |

## 📞 Support Resources

- Check logs: `pm2 logs evm-contract-platform`
- Check status: `pm2 status`
- View environment: `pm2 env 0`
- Nginx logs: `/var/log/nginx/error.log`
- PostgreSQL logs: `/var/log/postgresql/`

## 🚀 Deployment Commands Reference

```bash
# On VPS
cd /var/www/evm-contracts

# Install dependencies
npm install --production

# Build application (ensure .env exists!)
npm run build

# Push database schema
npm run db:push

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs evm-contract-platform

# Restart after .env changes
pm2 restart evm-contract-platform

# Rebuild after VITE_* changes
npm run build && pm2 restart evm-contract-platform
```

---

**Ready to deploy?** Start with [QUICK_START_VPS.md](QUICK_START_VPS.md) for the fastest path to production! 🚀
