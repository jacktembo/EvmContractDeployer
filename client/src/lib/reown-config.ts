/**
 * Reown AppKit Configuration
 * 
 * Configures Reown (formerly WalletConnect) AppKit for universal wallet connections.
 * Supports 600+ wallets including MetaMask, Coinbase Wallet, Trust Wallet, and more.
 */

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy, arbitrum, arbitrumSepolia, optimism, optimismSepolia, avalanche, avalancheFuji } from '@reown/appkit/networks';

// Get Reown Project ID from environment variable
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error('VITE_REOWN_PROJECT_ID is not defined. Please set up your Reown Project ID in environment variables.');
}

// Define metadata for the app
const metadata = {
  name: 'EVM Smart Contract Deployer',
  description: 'Deploy Solidity smart contracts to multiple EVM networks',
  url: typeof window !== 'undefined' ? window.location.origin : '',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// Define all supported networks for the app
const networks = [
  mainnet,
  sepolia,
  bsc,
  bscTestnet,
  polygon,
  polygonAmoy,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  avalanche,
  avalancheFuji
];

// Create Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false
});

// Create AppKit modal instance
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata,
  features: {
    analytics: true // Enable analytics for better insights
  }
});

// Export Wagmi config for use in providers
export const config = wagmiAdapter.wagmiConfig;
