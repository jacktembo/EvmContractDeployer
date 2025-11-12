#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Ensures all required environment variables are set before starting the application
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: join(__dirname, '..', '.env') });

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

console.log('==========================================');
console.log('Environment Variable Validation');
console.log('==========================================\n');

// Required backend variables
const requiredBackend = [
  'DATABASE_URL',
  'SESSION_SECRET'
];

// Optional backend variables
const optionalBackend = [
  'ETHERSCAN_API_KEY',
  'BSCSCAN_API_KEY',
  'POLYGONSCAN_API_KEY'
];

// Frontend variables (VITE_*)
const frontendVars = [
  'VITE_REOWN_PROJECT_ID'
];

let hasErrors = false;
let hasWarnings = false;

// Check required backend variables
console.log('Backend Variables (Required):');
requiredBackend.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`${colors.red}✗ ${varName} - MISSING${colors.reset}`);
    hasErrors = true;
  } else {
    // Mask sensitive values
    const maskedValue = varName.includes('SECRET') || varName.includes('PASSWORD')
      ? value.substring(0, 10) + '...'
      : varName.includes('DATABASE_URL')
      ? value.replace(/:[^@]*@/, ':***@')
      : 'set';
    console.log(`${colors.green}✓ ${varName} - ${maskedValue}${colors.reset}`);
  }
});

// Check optional backend variables
console.log('\nBackend Variables (Optional):');
optionalBackend.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`${colors.yellow}⚠ ${varName} - not set (some features may be limited)${colors.reset}`);
    hasWarnings = true;
  } else {
    console.log(`${colors.green}✓ ${varName} - set${colors.reset}`);
  }
});

// Check frontend variables
console.log('\nFrontend Variables:');
frontendVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`${colors.yellow}⚠ ${varName} - not set (wallet connection will be disabled)${colors.reset}`);
    hasWarnings = true;
  } else {
    console.log(`${colors.green}✓ ${varName} - ${value}${colors.reset}`);
  }
});

// Summary
console.log('\n==========================================');
if (hasErrors) {
  console.log(`${colors.red}✗ Validation Failed${colors.reset}`);
  console.log('\nMissing required environment variables.');
  console.log('Please create a .env file with the required values.\n');
  console.log('See .env.template for reference.\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log(`${colors.yellow}⚠ Validation Passed with Warnings${colors.reset}`);
  console.log('\nSome optional features may be disabled.\n');
  process.exit(0);
} else {
  console.log(`${colors.green}✓ All Variables Set${colors.reset}\n`);
  process.exit(0);
}
