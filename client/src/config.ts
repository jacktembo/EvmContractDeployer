/**
 * Client-Side Configuration
 * 
 * FOR VPS DEPLOYMENT:
 * 1. Get your Reown project ID from: https://cloud.reown.com
 * 2. Add your VPS domain to the allowed list in Reown dashboard
 * 3. Set VITE_REOWN_PROJECT_ID in your .env file OR update the value below
 * 
 * IMPORTANT: Wallet functionality will be DISABLED if REOWN_PROJECT_ID is not configured.
 * This prevents multiple MetaMask prompts and connection errors.
 */

export const clientConfig = {
  /**
   * Reown (WalletConnect) Project ID
   * Get from: https://cloud.reown.com
   * 
   * CRITICAL SETUP STEPS:
   * 1. Create a project at https://cloud.reown.com
   * 2. Copy your project ID
   * 3. Go to Project Settings → Domains
   * 4. Add your domain to the allowed list (e.g., yourdomain.com, *.replit.dev)
   * 5. Set the value in .env file as VITE_REOWN_PROJECT_ID or update the value below
   * 
   * WARNING: If your domain is not in the Reown allow list, wallet connections
   * will fail and cause multiple MetaMask prompts.
   * 
   * For VPS deployment: Replace empty string below with your project ID
   */
  REOWN_PROJECT_ID: import.meta.env.VITE_REOWN_PROJECT_ID || "",
} as const;
