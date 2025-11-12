/**
 * Wagmi/Viem to Ethers.js Adapter
 * 
 * Converts Wagmi's viem WalletClient to an ethers.js Signer for compatibility
 * with libraries that still require ethers signers.
 * 
 * Based on official Wagmi documentation:
 * https://wagmi.sh/core/guides/ethers
 */

import { BrowserProvider, JsonRpcSigner } from 'ethers';
import type { Account, Chain, Client, Transport } from 'viem';
import { type Config, getConnectorClient } from '@wagmi/core';

export function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  
  // Only include ensAddress if it exists (e.g., Ethereum mainnet/testnets)
  // Networks like BNB, Polygon, etc. don't support ENS
  const network: { chainId: number; name: string; ensAddress?: string } = {
    chainId: chain.id,
    name: chain.name,
  };
  
  // Only set ensAddress if the network actually has ENS support
  if (chain.contracts?.ensRegistry?.address) {
    network.ensAddress = chain.contracts.ensRegistry.address;
  }
  
  const provider = new BrowserProvider(transport, network);
  const signer = new JsonRpcSigner(provider, account.address);
  return signer;
}

/** Action to convert a viem Wallet Client to an ethers.js Signer. */
export async function getEthersSigner(
  config: Config,
  { chainId }: { chainId?: number } = {},
) {
  const client = await getConnectorClient(config, { chainId });
  return clientToSigner(client);
}
