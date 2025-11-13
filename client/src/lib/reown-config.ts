/**
 * Reown AppKit config — production-safe
 * - Only initialize in browser (prevents Node/server WebSocket/TLS issues)
 * - Use cloud relay only for DEV/localhost
 * - In production, metadata.url = window.location.origin (must be whitelisted in Reown)
 * - Ensure autoConnect is disabled to avoid repeated MetaMask signing prompts
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
import { createConfig } from 'wagmi';
import * as viemChains from 'viem/chains';
import { clientConfig } from '../config';

// Project ID source (client config preferred; Vite env fallback)
const projectId = clientConfig?.REOWN_PROJECT_ID ?? import.meta.env.VITE_REOWN_PROJECT_ID ?? '';

// Origins / relay selection
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
const useCloudRelay = import.meta.env.DEV || isLocal;
const metadataUrl = import.meta.env.PROD ? origin : (useCloudRelay ? 'https://cloud.reown.com' : origin);

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

// fallback wagmi config (no autoConnect)
const makeFallbackConfig = () =>
  createConfig({
    autoConnect: false,
    chains: [
      viemChains.mainnet,
      viemChains.sepolia,
      viemChains.bsc,
      viemChains.bscTestnet,
      viemChains.polygon,
      viemChains.polygonAmoy,
      viemChains.arbitrum,
      viemChains.arbitrumSepolia,
      viemChains.optimism,
      viemChains.optimismSepolia,
      viemChains.avalanche,
      viemChains.avalancheFuji
    ]
  });

let wagmiAdapter: WagmiAdapter | null = null;
let config: any = makeFallbackConfig();
let appKitInstance: any = null;

// Only initialize in browser and only once (singleton) to avoid repeated prompts
if (typeof window !== 'undefined') {
  const globalAny = window as any;
  if (!globalAny.__REOWN_APPKIT_INITIALIZED) {
    globalAny.__REOWN_APPKIT_INITIALIZED = true;

    if (!projectId || projectId.trim() === '') {
      console.warn(
        '[Reown] REOWN_PROJECT_ID not set. Wallet connections disabled. To enable, set REOWN_PROJECT_ID and whitelist your production domain in Reown dashboard.'
      );
      config = makeFallbackConfig();
    } else {
      try {
        wagmiAdapter = new WagmiAdapter({
          networks,
          projectId,
          ssr: false,
          // hint to adapter to avoid autoConnect
          autoConnect: false as any
        } as any);

        // enforce autoConnect: false on wagmi config if present
        if (wagmiAdapter?.wagmiConfig) {
          wagmiAdapter.wagmiConfig = {
            ...wagmiAdapter.wagmiConfig,
            autoConnect: false
          };
        }

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

        config = wagmiAdapter.wagmiConfig ?? makeFallbackConfig();
      } catch (err) {
        console.error('[Reown] Failed to initialize AppKit — wallet connections disabled:', err);
        config = makeFallbackConfig();
      }
    }
  } else {
    // reuse existing config (hot reload / multiple modules)
    config = (globalAny.__REOWN_WAGMI_CONFIG ?? config) as any;
  }

  try {
    (window as any).__REOWN_WAGMI_CONFIG = config;
  } catch {}
}

export { wagmiAdapter, config };
