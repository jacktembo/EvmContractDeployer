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
import { http, createConfig } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
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

// Map AppKit networks to wagmi chains
const wagmiChains = [
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
] as const;

/**
 * Build a minimal, safe fallback wagmi config.
 * IMPORTANT: autoConnect: false prevents wagmi from silently reconnecting on page load,
 * which is a typical cause of repeated signature / permission prompts.
 */
const makeFallbackConfig = () =>
  createConfig({
    autoConnect: false, // <- explicitly disable auto connect
    chains: wagmiChains,
    connectors: [
      // keep injected as the minimal connector; shimDisconnect reduces some re-prompt behavior
      injected({ shimDisconnect: true })
    ],
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
      [bsc.id]: http(),
      [bscTestnet.id]: http(),
      [polygon.id]: http(),
      [polygonAmoy.id]: http(),
      [arbitrum.id]: http(),
      [arbitrumSepolia.id]: http(),
      [optimism.id]: http(),
      [optimismSepolia.id]: http(),
      [avalanche.id]: http(),
      [avalancheFuji.id]: http()
    }
  });

let wagmiAdapter: WagmiAdapter | null = null;
let config: any = makeFallbackConfig();
let appKitInstance: any = null;

// Only initialize in browser and only once (singleton) to avoid repeated prompts
if (typeof window !== 'undefined') {
  const globalAny = window as any;

  // Reuse previously stored config/adapter if present
  if (globalAny.__REOWN_WAGMI_CONFIG && globalAny.__REOWN_WAGMI_ADAPTER) {
    config = globalAny.__REOWN_WAGMI_CONFIG;
    wagmiAdapter = globalAny.__REOWN_WAGMI_ADAPTER;
    console.log('[Reown] Reusing existing AppKit instance');
  } else if (!globalAny.__REOWN_APPKIT_INITIALIZED) {
    globalAny.__REOWN_APPKIT_INITIALIZED = true;

    if (!projectId || projectId.trim() === '') {
      console.warn(
        '[Reown] REOWN_PROJECT_ID not set. Wallet connections disabled. To enable, set REOWN_PROJECT_ID and whitelist your production domain in Reown dashboard.'
      );
      config = makeFallbackConfig();
    } else {
      try {
        console.log('[Reown] Initializing AppKit with projectId:', projectId.substring(0, 8) + '...');

        // Create WagmiAdapter with minimal config.
        // Note: We intentionally do NOT autoConnect anywhere.
        // Build connectors array: injected always available; WalletConnect only if we have a projectId and cloud relay allowed.
        const connectors = [
          injected({ shimDisconnect: true })
        ];

        // Add WalletConnect only if projectId and cloud relay allowed (avoids unnecessary initializations)
        if (projectId && (useCloudRelay || import.meta.env.DEV)) {
          try {
            connectors.push(
              walletConnect({
                projectId,
                // don't enable auto connect behavior here (walletConnect connector config varies by wagmi version)
                // For walletConnect v2 + wagmi, you may need to pass additional options (relayUrl, metadata).
                // We'll let the WagmiAdapter handle specifics, but avoid automatically calling connect anywhere.
                showQrModal: true
              } as any)
            );
            console.log('[Reown] WalletConnect connector added');
          } catch (wcErr) {
            console.warn('[Reown] Could not create WalletConnect connector:', wcErr);
          }
        }

        wagmiAdapter = new WagmiAdapter({
          networks,
          projectId
          // WagmiAdapter should not autoConnect itself — we leave autoConnect false in configs.
        });

        console.log('[Reown] WagmiAdapter created');

        // Create AppKit instance
        appKitInstance = createAppKit({
          adapters: [wagmiAdapter],
          projectId,
          networks,
          metadata,
          features: {
            analytics: false
          }
        });

        console.log('[Reown] AppKit instance created');

        // Get the config from adapter (if provided). Ensure autoConnect is explicitly set false.
        if (wagmiAdapter?.wagmiConfig) {
          config = {
            ...wagmiAdapter.wagmiConfig,
            autoConnect: false
          };
          console.log('[Reown] Using wagmiConfig from adapter (autoConnect disabled)');
        } else {
          console.warn('[Reown] No wagmiConfig from adapter, using fallback');
          config = makeFallbackConfig();
        }

        // Store config & adapter for reuse
        globalAny.__REOWN_WAGMI_CONFIG = config;
        globalAny.__REOWN_WAGMI_ADAPTER = wagmiAdapter;

        console.log('[Reown] AppKit initialized successfully');
      } catch (err) {
        console.error('[Reown] Failed to initialize AppKit — wallet connections disabled:', err);
        config = makeFallbackConfig();
      }
    }
  }

  try {
    // ensure global set for any consumers that import { config } from this file
    (window as any).__REOWN_WAGMI_CONFIG = config;
  } catch {}
}

export { wagmiAdapter, config };
