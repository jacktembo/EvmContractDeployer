require('dotenv').config();

module.exports = {
  apps: [{
    name: 'evm-contract-platform',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    
    // Environment variables loaded from .env file
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 5000,
      DATABASE_URL: process.env.DATABASE_URL,
      SESSION_SECRET: process.env.SESSION_SECRET,
      ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,
      BSCSCAN_API_KEY: process.env.BSCSCAN_API_KEY,
      POLYGONSCAN_API_KEY: process.env.POLYGONSCAN_API_KEY,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      SECURE_COOKIES: process.env.SECURE_COOKIES,
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN
    },
    
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
