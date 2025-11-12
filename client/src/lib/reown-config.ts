/**
 * Reown AppKit Configuration
 * 
 * Configures Reown (formerly WalletConnect) AppKit for universal wallet connections.
 * Supports 600+ wallets including MetaMask, Coinbase Wallet, Trust Wallet, and more.
 */

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy, arbitrum, arbitrumSepolia, optimism, optimismSepolia, avalanche, avalancheFuji, type AppKitNetwork } from '@reown/appkit/networks';
import { createConfig, http } from 'wagmi';
import * as viemChains from 'viem/chains';

// Get Reown Project ID from environment variable
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

if (!projectId) {
  console.warn('VITE_REOWN_PROJECT_ID is not defined. Wallet connection features will be disabled. Please set up your Reown Project ID in environment variables to enable wallet connections.');
}

// Define metadata for the app
const metadata = {
  name: 'EVM Smart Contract Deployer',
  description: 'Deploy Solidity smart contracts to multiple EVM networks',
  url: typeof window !== 'undefined' ? window.location.origin : '',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// Define all supported networks for the app
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
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

// Create Wagmi adapter and AppKit only if projectId is available
let wagmiAdapter: WagmiAdapter | null = null;
let config: any;

if (projectId) {
  // Create Wagmi adapter
  wagmiAdapter = new WagmiAdapter({
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
  config = wagmiAdapter.wagmiConfig;
} else {
  // Create a minimal fallback config without wallet connection
  config = createConfig({
    chains: [viemChains.mainnet, viemChains.sepolia, viemChains.bsc, viemChains.bscTestnet, viemChains.polygon, viemChains.polygonAmoy, viemChains.arbitrum, viemChains.arbitrumSepolia, viemChains.optimism, viemChains.optimismSepolia, viemChains.avalanche, viemChains.avalancheFuji],
    transports: {
      [viemChains.mainnet.id]: http(),
      [viemChains.sepolia.id]: http(),
      [viemChains.bsc.id]: http(),
      [viemChains.bscTestnet.id]: http(),
      [viemChains.polygon.id]: http(),
      [viemChains.polygonAmoy.id]: http(),
      [viemChains.arbitrum.id]: http(),
      [viemChains.arbitrumSepolia.id]: http(),
      [viemChains.optimism.id]: http(),
      [viemChains.optimismSepolia.id]: http(),
      [viemChains.avalanche.id]: http(),
      [viemChains.avalancheFuji.id]: http(),
    },
  });
}

export { wagmiAdapter, config };
