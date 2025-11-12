# Running EVM Smart Contract Platform Locally on Ubuntu

Complete step-by-step guide to set up and run this project on your Ubuntu machine.

## Prerequisites

Before you begin, make sure you have the following installed on your Ubuntu system:

### 1. Install Node.js (v20 or higher)

```bash
# Install Node.js 20.x LTS using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x or higher
```

### 2. Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib -y

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo systemctl status postgresql
```

### 3. Install Git (if not already installed)

```bash
sudo apt install git -y
git --version
```

## Project Setup

### Step 1: Download the Project

If you're working from Replit, you can download the project or clone it:

**Option A: Download from Replit**
1. In Replit, click the three dots menu (⋮) in the file explorer
2. Select "Download as zip"
3. Extract the zip file on your Ubuntu machine

**Option B: Clone via Git (if available)**
```bash
# Navigate to your desired directory
cd ~/projects

# Clone the repository
git clone <your-repository-url>
cd <project-folder>
```

### Step 2: Install Project Dependencies

```bash
# Install all npm packages
npm install
```

This will install all required dependencies from `package.json`.

### Step 3: Set Up PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, create a database and user
CREATE DATABASE evm_contracts;
CREATE USER evm_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE evm_contracts TO evm_user;

# Grant schema permissions (required for PostgreSQL 15+)
\c evm_contracts
GRANT ALL ON SCHEMA public TO evm_user;
ALTER DATABASE evm_contracts OWNER TO evm_user;

# Exit PostgreSQL
\q
```

### Step 4: Create Environment Variables File

Create a `.env` file in the project root:

```bash
# Create .env file
touch .env
```

Add the following content to `.env`:

```env
# Database Configuration
DATABASE_URL=postgresql://evm_user:your_secure_password@localhost:5432/evm_contracts

# Session Secret (generate a random string for security)
SESSION_SECRET=your-random-secret-key-change-this-in-production

# Etherscan API Key (for contract verification)
# Get your API key from: https://etherscan.io/myapikey
ETHERSCAN_API_KEY=your_etherscan_api_key

# Reown (WalletConnect) Project ID (for wallet connection)
# Get your project ID from: https://cloud.reown.com/
VITE_REOWN_PROJECT_ID=your_reown_project_id
```

**Important Notes:**
- Replace `your_secure_password` with the password you set in Step 3
- Replace `your-random-secret-key-change-this-in-production` with a random string (at least 32 characters)
- You can generate a random secret with: `openssl rand -base64 32`

### Step 5: Get Required API Keys

#### Etherscan API Key (Required for contract verification)
1. Go to https://etherscan.io/
2. Create an account (if you don't have one)
3. Go to https://etherscan.io/myapikey
4. Create a new API key
5. Copy the API key and add it to your `.env` file

#### Reown Project ID (Required for wallet connection)
1. Go to https://cloud.reown.com/
2. Sign in or create an account
3. Create a new project
4. Copy the Project ID
5. Add it to your `.env` file as `VITE_REOWN_PROJECT_ID`

### Step 6: Initialize Database Schema

```bash
# Push database schema to PostgreSQL
npm run db:push
```

If you see a warning about data loss, use:
```bash
npm run db:push -- --force
```

### Step 7: Run the Development Server

```bash
# Start the application
npm run dev
```

The application will start on **http://localhost:5000**

You should see output like:
```
Starting gas tracker...
Seeding contract templates...
✓ Templates seeded successfully
serving on port 5000
```

### Step 8: Access the Application

1. Open your web browser
2. Navigate to: **http://localhost:5000**
3. Connect your wallet (MetaMask, Coinbase Wallet, etc.)
4. Start deploying smart contracts!

## Troubleshooting

### Port 5000 Already in Use

If port 5000 is already in use, you can:

**Option 1: Stop the service using port 5000**
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill the process (replace PID with actual process ID)
sudo kill -9 <PID>
```

**Option 2: Change the port**
Edit `server/index.ts` and change the port number (line ~40):
```typescript
const PORT = 3000; // Change to any available port
```

### Database Connection Issues

If you get database connection errors:

1. **Check PostgreSQL is running:**
```bash
sudo systemctl status postgresql
```

2. **Verify database credentials:**
```bash
# Test connection manually
psql -U evm_user -d evm_contracts -h localhost -W
```

3. **Check DATABASE_URL in .env:**
Make sure the format is correct:
```
postgresql://username:password@host:port/database_name
```

### Missing Dependencies

If you see module not found errors:
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Wallet Connection Issues

If wallet connection doesn't work:

1. Make sure you have a browser wallet extension installed (MetaMask, Coinbase Wallet, etc.)
2. Verify `VITE_REOWN_PROJECT_ID` is set correctly in `.env`
3. Try clearing browser cache and reloading

## Production Deployment

For production deployment, you'll need to:

1. **Build the application:**
```bash
npm run build
```

2. **Start the production server:**
```bash
npm start
```

3. **Use a process manager (PM2 recommended):**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name evm-contracts

# Make PM2 start on system boot
pm2 startup
pm2 save
```

4. **Set up a reverse proxy (nginx recommended):**
```bash
# Install nginx
sudo apt install nginx -y

# Configure nginx to proxy requests to your app
# Edit: /etc/nginx/sites-available/default
```

## Useful Commands

```bash
# Development
npm run dev          # Start development server

# Production
npm run build        # Build for production
npm start           # Start production server

# Database
npm run db:push     # Push schema changes to database

# Code Quality
npm run check       # TypeScript type checking
```

## Additional Resources

- **Replit Documentation**: https://docs.replit.com/
- **Etherscan API Docs**: https://docs.etherscan.io/
- **Reown (WalletConnect) Docs**: https://docs.reown.com/
- **Drizzle ORM Docs**: https://orm.drizzle.team/

## Support

If you encounter issues:

1. Check the console output for error messages
2. Verify all environment variables are set correctly
3. Make sure PostgreSQL is running
4. Ensure all API keys are valid

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env` file to version control**
   - Add `.env` to `.gitignore`
   
2. **Use strong passwords and secrets in production**
   - Generate SESSION_SECRET with: `openssl rand -base64 64`
   
3. **Keep API keys secure**
   - Don't share your Etherscan API key or Reown Project ID publicly
   
4. **Use environment-specific configurations**
   - Different settings for development vs production

---

**You're all set!** 🚀

Your EVM Smart Contract Deployment Platform should now be running locally on Ubuntu.
