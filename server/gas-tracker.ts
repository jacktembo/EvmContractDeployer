import { JsonRpcProvider } from "ethers";
import { NETWORKS } from "@shared/schema";
import { storage } from "./storage";

// Interval for fetching gas prices (5 minutes)
const GAS_FETCH_INTERVAL = 5 * 60 * 1000;

// Provider cache keyed by chainId
const providerCache = new Map<number, JsonRpcProvider>();

function getOrCreateProvider(chainId: number): JsonRpcProvider {
  if (providerCache.has(chainId)) {
    return providerCache.get(chainId)!;
  }

  const network = NETWORKS.find((n) => n.chainId === chainId);
  if (!network) {
    throw new Error(`Unsupported network with chainId ${chainId}`);
  }

  const provider = new JsonRpcProvider(network.rpcUrl, chainId);
  providerCache.set(chainId, provider);
  return provider;
}

async function fetchGasPriceForNetwork(chainId: number): Promise<void> {
  try {
    const network = NETWORKS.find((n) => n.chainId === chainId);
    if (!network) {
      console.error(`Network not found for chainId ${chainId}`);
      return;
    }

    const provider = getOrCreateProvider(chainId);
    const feeData = await provider.getFeeData();

    // Check if network supports EIP-1559
    const supportsEIP1559 = feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;

    let baseFee: string | null = null;
    let priorityFee: string | null = null;
    let slowPrice: string;
    let standardPrice: string;
    let fastPrice: string;

    if (supportsEIP1559) {
      // EIP-1559 network
      baseFee = (feeData.maxFeePerGas! - feeData.maxPriorityFeePerGas!).toString();
      const standardPriorityFee = feeData.maxPriorityFeePerGas!;
      priorityFee = standardPriorityFee.toString();

      // Calculate priority fee tiers
      const slowPriorityFee = (standardPriorityFee * BigInt(60)) / BigInt(100);
      const fastPriorityFee = (standardPriorityFee * BigInt(200)) / BigInt(100);

      // Calculate maxFeePerGas for each tier (2 × baseFee + priorityFee)
      const baseFeeNum = BigInt(baseFee);
      slowPrice = ((baseFeeNum * BigInt(2)) + slowPriorityFee).toString();
      standardPrice = ((baseFeeNum * BigInt(2)) + standardPriorityFee).toString();
      fastPrice = ((baseFeeNum * BigInt(2)) + fastPriorityFee).toString();
    } else {
      // Legacy network
      const baseGasPrice = feeData.gasPrice || BigInt(0);
      if (baseGasPrice === BigInt(0)) {
        console.warn(`Unable to determine gas price for network ${network.name}`);
        return;
      }

      slowPrice = ((baseGasPrice * BigInt(80)) / BigInt(100)).toString();
      standardPrice = baseGasPrice.toString();
      fastPrice = ((baseGasPrice * BigInt(120)) / BigInt(100)).toString();
    }

    // Get current block number
    const blockNumber = await provider.getBlockNumber();

    // Save to database
    await storage.saveGasHistory({
      chainId,
      network: network.id,
      baseFee,
      priorityFee,
      slowPrice,
      standardPrice,
      fastPrice,
      blockNumber,
      source: 'rpc',
    });

    console.log(`Gas prices updated for ${network.name} (chainId: ${chainId})`);
  } catch (error) {
    console.error(`Failed to fetch gas prices for chainId ${chainId}:`, error);
  }
}

async function fetchAllGasPrices(): Promise<void> {
  console.log('Fetching gas prices for all networks...');
  
  // Fetch gas prices for all networks in parallel
  const promises = NETWORKS.map(network => fetchGasPriceForNetwork(network.chainId));
  await Promise.allSettled(promises);
  
  console.log('Gas prices fetch completed');
}

let intervalId: NodeJS.Timeout | null = null;

export function startGasTracker(): void {
  if (intervalId) {
    console.warn('Gas tracker is already running');
    return;
  }

  console.log('Starting gas tracker...');
  
  // Fetch immediately on start
  fetchAllGasPrices();
  
  // Then fetch periodically
  intervalId = setInterval(fetchAllGasPrices, GAS_FETCH_INTERVAL);
  
  console.log(`Gas tracker started. Fetching prices every ${GAS_FETCH_INTERVAL / 1000 / 60} minutes`);
}

export function stopGasTracker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Gas tracker stopped');
  }
}
