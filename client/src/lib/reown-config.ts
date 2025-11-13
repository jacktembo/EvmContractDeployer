/**
 * Reown AppKit config — production-safe
 * - Only initialize in browser (prevents Node/server WebSocket/TLS issues)
 * - Use cloud relay only for DEV/localhost
 * - In production, metadata.url = window.location.origin (must be whitelisted in Reown)
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
  avalancheFuji,
  type AppKitNetwork
} from '@reown/appkit/networks';
import { cookieStorage, createStorage } from 'wagmi';
import { clientConfig } from '../config';

// Project ID source (client config preferred; Vite env fallback)
const projectId = clientConfig?.REOWN_PROJECT_ID ?? import.meta.env.VITE_REOWN_PROJECT_ID ?? '';

// Origins / relay selection
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
const metadataUrl = import.meta.env.PROD ? origin : 'https://cloud.reown.com';

// metadata MUST match the domain registered in Reown dashboard when running PROD
const metadata = {
  name: 'EVM Smart Contract Deployer',
  description: 'Deploy Solidity smart contracts to multiple EVM networks',
  url: metadataUrl,
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

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

let wagmiAdapter: WagmiAdapter | null = null;

// Only initialize in browser and only once (singleton)
if (typeof window !== 'undefined' && projectId && projectId.trim() !== '') {
  const globalAny = window as any;
  
  if (!globalAny.__REOWN_APPKIT_INSTANCE) {
    try {
      // Create WagmiAdapter with proper config
      wagmiAdapter = new WagmiAdapter({
        networks,
        projectId
      });

      // Create AppKit instance
      const appKit = createAppKit({
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

      // Store in global to prevent re-initialization
      globalAny.__REOWN_APPKIT_INSTANCE = appKit;
      globalAny.__REOWN_WAGMI_ADAPTER = wagmiAdapter;
      
      console.log('[Reown] AppKit initialized successfully');
    } catch (err) {
      console.error('[Reown] Failed to initialize AppKit:', err);
    }
  } else {
    // Reuse existing adapter
    wagmiAdapter = globalAny.__REOWN_WAGMI_ADAPTER;
  }
} else if (typeof window !== 'undefined') {
  console.warn(
    '[Reown] REOWN_PROJECT_ID not set. Wallet connections disabled. To enable, set REOWN_PROJECT_ID and whitelist your production domain in Reown dashboard.'
  );
}

// Export the wagmi config (will be null if not initialized)
export const config = wagmiAdapter?.wagmiConfig ?? null;
export { wagmiAdapter };