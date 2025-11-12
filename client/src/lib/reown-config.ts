/**
 * Reown AppKit Configuration
 *
 * Configures Reown (formerly WalletConnect) AppKit for universal wallet connections.
 * Avoids initializing AppKit on the server to prevent wss://localhost TLS errors.
 */

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
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
} from '@reown/appkit/networks';

// Get Reown Project ID from environment variable
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

// Prefer cloud relay when developing or running on localhost to avoid wss://localhost issues
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const useCloudRelay = import.meta.env.DEV || origin.includes('localhost');
const metadataUrl = useCloudRelay ? 'https://cloud.reown.com' : origin;

// Define metadata for the app
const metadata = {
  name: 'EVM Smart Contract Deployer',
  description: 'Deploy Solidity smart contracts to multiple EVM networks',
  url: metadataUrl,
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

// Create Wagmi adapter and AppKit only in browser to avoid server-side WebSocket attempts
let wagmiAdapter: any = undefined;

if (typeof window !== 'undefined') {
  if (!projectId) {
    throw new Error('VITE_REOWN_PROJECT_ID is not defined. Please set up your Reown Project ID in environment variables.');
  }

  wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: false
  });

  // Create AppKit modal instance (browser only)
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    metadata,
    features: {
      analytics: true
    }
  });
}

// Export Wagmi config for use in providers; provide a safe fallback on server-side
export const config = wagmiAdapter ? wagmiAdapter.wagmiConfig : ({} as any);