/**
 * Reown AppKit Configuration
 * 
 * Configures Reown (formerly WalletConnect) AppKit for universal wallet connections.
 * Supports 600+ wallets including MetaMask, Coinbase Wallet, Trust Wallet, and more.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Get your project ID from: https://cloud.reown.com
 * 2. Add your domain to the allowed list at: https://cloud.reown.com → Your Project → Settings → Domains
 * 3. Update client/src/config.ts with your project ID
 * 
 * NOTE: If you see errors about "origin not in allow list", you need to add your domain
 * to the Reown dashboard. This can cause multiple MetaMask prompts if not configured correctly.
 */

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy, arbitrum, arbitrumSepolia, optimism, optimismSepolia, avalanche, avalancheFuji, type AppKitNetwork } from '@reown/appkit/networks';
import { createConfig, http } from 'wagmi';
import * as viemChains from 'viem/chains';
import { clientConfig } from '../config';

// Get Reown Project ID from client config
const projectId = clientConfig.REOWN_PROJECT_ID;

if (!projectId || projectId.trim() === "") {
  console.warn('[Wallet Connection Disabled] REOWN_PROJECT_ID is not configured. To enable wallet connections:\n1. Get project ID from https://cloud.reown.com\n2. Add your domain to the allowed list in Reown dashboard\n3. Update client/src/config.ts with your project ID');
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

// Create Wagmi adapter and AppKit only if projectId is properly configured
// Wallet functionality is DISABLED if projectId is missing or empty
let wagmiAdapter: WagmiAdapter | null = null;
let config: any;
let appKitInstance: any = null;

// Only initialize if we have a valid project ID
// This prevents multiple MetaMask prompts when configuration is missing
if (projectId && projectId.trim() !== "") {
  // Create Wagmi adapter
  wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: false
  });

  // Create AppKit modal instance
  try {
    appKitInstance = createAppKit({
      adapters: [wagmiAdapter],
      projectId,
      networks,
      metadata,
      features: {
        analytics: false,
        email: false,
        socials: []
      }
    });
    
    // Export Wagmi config for use in providers
    config = wagmiAdapter.wagmiConfig;
  } catch (error) {
    console.error('[Wallet Error] Failed to initialize Reown AppKit. Check that your domain is whitelisted:', error);
    // Fallback to config without wallet connection
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
} else {
  // Create a minimal fallback config without wallet connection
  // This is used when Reown project ID is not configured
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
