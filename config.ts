/**
 * Server-Side Configuration
 * 
 * Configuration Loading Strategy (Layered Approach):
 * 1. Replit Secrets / OS Environment Variables (highest priority)
 * 2. .env file (fallback when OS env vars not set)
 * 
 * This means:
 * - In Replit: Secrets are used (recommended approach)
 * - In local/VPS: .env file is used as fallback
 * - OS environment variables ALWAYS override .env file values
 * 
 * For VPS deployment: Copy the .env.example file to .env and update all values
 * with your production credentials. The .env file will be read automatically.
 * 
 * IMPORTANT: This file is for SERVER-SIDE configuration only.
 * For client-side configuration, use client/src/config.ts
 */

// Load .env file with override:false so OS environment variables take precedence
import dotenv from "dotenv";
dotenv.config({ override: false });

// Helper to validate required environment variables
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} is not set. Please configure it in your .env file or environment variables.`
    );
  }
  return value;
}

// Helper to get optional environment variable with default
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Helper to determine if running in development
const isDevelopment = process.env.NODE_ENV !== "production";

export const config = {
  /**
   * Database Configuration
   * Required: PostgreSQL connection URL
   * 
   * This will throw a clear error if not set, guiding users to configure it
   */
  get DATABASE_URL(): string {
    return getRequiredEnv("DATABASE_URL");
  },

  /**
   * Etherscan API Key
   * Optional: Required for contract verification
   * Get from: https://etherscan.io/myapikey
   */
  get ETHERSCAN_API_KEY(): string {
    return getOptionalEnv("ETHERSCAN_API_KEY", "");
  },

  /**
   * Reown (WalletConnect) Project ID
   * Optional: Used for server-side wallet operations if needed
   * Get from: https://cloud.reown.com
   * 
   * Note: Client-side uses client/src/config.ts for REOWN_PROJECT_ID
   */
  get REOWN_PROJECT_ID(): string {
    return getOptionalEnv("REOWN_PROJECT_ID", "");
  },

  /**
   * Session Secret
   * Used for session encryption
   * 
   * Development: Uses a default value
   * Production: Requires explicit configuration
   */
  get SESSION_SECRET(): string {
    if (!isDevelopment && !process.env.SESSION_SECRET) {
      throw new Error(
        "SESSION_SECRET must be set in production. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    return getOptionalEnv("SESSION_SECRET", "dev-secret-key-change-in-production");
  },

  /**
   * Server Port
   */
  get PORT(): number {
    return parseInt(getOptionalEnv("PORT", "5000"), 10);
  },

  /**
   * Node Environment
   */
  get NODE_ENV(): "development" | "production" {
    return (process.env.NODE_ENV as "development" | "production") || "development";
  },
} as const;
