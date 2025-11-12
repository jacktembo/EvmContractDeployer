# Quick Start - Running Locally on Ubuntu

## Two Ways to Set Up

### Option 1: Automated Setup (Recommended)

Run the setup script:

```bash
chmod +x setup-ubuntu.sh
./setup-ubuntu.sh
```

The script will:
- ✓ Check and install Node.js if needed
- ✓ Check and install PostgreSQL if needed
- ✓ Install npm dependencies
- ✓ Create .env file with auto-generated session secret
- ✓ Guide you through database setup

### Option 2: Manual Setup

See the complete step-by-step guide: **[LOCAL_SETUP_UBUNTU.md](./LOCAL_SETUP_UBUNTU.md)**

## After Setup

1. **Edit your `.env` file:**
   ```bash
   nano .env
   ```
   
   Add your API keys:
   - `DATABASE_URL` - Update password
   - `ETHERSCAN_API_KEY` - Get from https://etherscan.io/myapikey
   - `VITE_REOWN_PROJECT_ID` - Get from https://cloud.reown.com/

2. **Set up PostgreSQL database:**
   ```bash
   sudo -u postgres psql
   ```
   ```sql
   CREATE DATABASE evm_contracts;
   CREATE USER evm_user WITH ENCRYPTED PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE evm_contracts TO evm_user;
   \c evm_contracts
   GRANT ALL ON SCHEMA public TO evm_user;
   ALTER DATABASE evm_contracts OWNER TO evm_user;
   \q
   ```

3. **Initialize database schema:**
   ```bash
   npm run db:push
   ```

4. **Start the application:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   ```
   http://localhost:5000
   ```

## That's It! 🚀

Your EVM Smart Contract Deployment Platform is now running locally!

---

**Need Help?** See the detailed guide in [LOCAL_SETUP_UBUNTU.md](./LOCAL_SETUP_UBUNTU.md)
