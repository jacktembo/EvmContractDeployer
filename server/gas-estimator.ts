import { JsonRpcProvider, formatUnits, AbiCoder, Interface } from "ethers";
import type { GasEstimateRequest, GasEstimateResponse, Network } from "@shared/schema";
import { NETWORKS } from "@shared/schema";

// Provider cache keyed by chainId
const providerCache = new Map<number, JsonRpcProvider>();

// Token price cache with timestamps
interface TokenPriceCache {
  price: number;
  timestamp: number;
}

const tokenPriceCache = new Map<string, TokenPriceCache>();
const PRICE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// CoinGecko token ID mapping
const COINGECKO_TOKEN_IDS: Record<number, string> = {
  1: "ethereum",           // Ethereum Mainnet
  11155111: "ethereum",    // Sepolia
  56: "binancecoin",       // BSC
  97: "binancecoin",       // BSC Testnet
  137: "matic-network",    // Polygon
  80002: "matic-network",  // Polygon Amoy
  42161: "ethereum",       // Arbitrum
  421614: "ethereum",      // Arbitrum Sepolia
  10: "ethereum",          // Optimism
  11155420: "ethereum",    // Optimism Sepolia
  43114: "avalanche-2",    // Avalanche
  43113: "avalanche-2",    // Avalanche Fuji
};

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

async function getTokenPriceUSD(chainId: number): Promise<number | null> {
  const tokenId = COINGECKO_TOKEN_IDS[chainId];
  if (!tokenId) {
    return null; // No mapping available
  }

  // Check cache
  const cached = tokenPriceCache.get(tokenId);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_DURATION) {
    return cached.price;
  }

  // Fetch fresh price from CoinGecko
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) } // 5 second timeout
    );
    
    if (!response.ok) {
      console.warn(`CoinGecko API failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const price = data[tokenId]?.usd;
    
    if (typeof price !== "number") {
      console.warn(`Invalid price data from CoinGecko for ${tokenId}`);
      return null;
    }

    // Update cache
    tokenPriceCache.set(tokenId, { price, timestamp: Date.now() });
    return price;
  } catch (error) {
    console.warn("Failed to fetch token price from CoinGecko:", error);
    return null;
  }
}

function encodeConstructorArgs(abi: any[], constructorArgs: string[]): string {
  // Find constructor in ABI
  const constructorAbi = abi.find((item) => item.type === "constructor");
  
  if (!constructorAbi || constructorArgs.length === 0) {
    return "0x"; // No constructor or no args
  }

  try {
    const iface = new Interface(abi);
    const encoded = iface.encodeDeploy(constructorArgs);
    return encoded;
  } catch (error) {
    throw new Error(`Failed to encode constructor arguments: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function estimateDeploymentGas(
  request: GasEstimateRequest
): Promise<GasEstimateResponse> {
  try {
    const { bytecode, constructorArgs, abi, chainId } = request;

    // Get network info
    const network = NETWORKS.find((n) => n.chainId === chainId);
    if (!network) {
      return {
        success: false,
        error: `Unsupported network with chainId ${chainId}`,
      };
    }

    // Get or create provider
    const provider = getOrCreateProvider(chainId);

    // Encode constructor arguments
    const encodedArgs = encodeConstructorArgs(abi, constructorArgs);
    const deploymentData = bytecode + encodedArgs.slice(2); // Remove '0x' from encoded args

    // Estimate gas units
    let gasUnits: bigint;
    try {
      gasUnits = await provider.estimateGas({
        data: deploymentData,
      });
    } catch (error) {
      return {
        success: false,
        error: `Gas estimation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Get fee data from provider
    let feeData;
    try {
      feeData = await provider.getFeeData();
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch gas prices: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Check if network supports EIP-1559
    const supportsEIP1559 = feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
    
    let slowGasPrice: bigint;
    let standardGasPrice: bigint;
    let fastGasPrice: bigint;
    let eip1559Data: any = undefined;

    if (supportsEIP1559) {
      // EIP-1559 network - use maxFeePerGas and maxPriorityFeePerGas
      const baseFee = feeData.maxFeePerGas! - feeData.maxPriorityFeePerGas!;
      const standardPriorityFee = feeData.maxPriorityFeePerGas!;
      
      // Calculate priority fee tiers based on percentiles
      // Slow: 60% of standard (1-10th percentile equivalent)
      // Standard: 100% (50-60th percentile equivalent)
      // Fast: 200% (90th+ percentile equivalent)
      const slowPriorityFee = (standardPriorityFee * BigInt(60)) / BigInt(100);
      const fastPriorityFee = (standardPriorityFee * BigInt(200)) / BigInt(100);
      
      // Calculate maxFeePerGas using the standard formula: 2 × baseFee + priorityFee
      // This ensures transaction validity for 6 consecutive full blocks (12.5% increase per block)
      const slowMaxFee = (baseFee * BigInt(2)) + slowPriorityFee;
      const standardMaxFee = (baseFee * BigInt(2)) + standardPriorityFee;
      const fastMaxFee = (baseFee * BigInt(2)) + fastPriorityFee;
      
      // For cost calculation, use the actual maxFeePerGas (worst case)
      slowGasPrice = slowMaxFee;
      standardGasPrice = standardMaxFee;
      fastGasPrice = fastMaxFee;
      
      // Store EIP-1559 specific data
      eip1559Data = {
        baseFee: baseFee.toString(),
        slow: {
          maxFeePerGas: slowMaxFee.toString(),
          maxPriorityFeePerGas: slowPriorityFee.toString(),
        },
        standard: {
          maxFeePerGas: standardMaxFee.toString(),
          maxPriorityFeePerGas: standardPriorityFee.toString(),
        },
        fast: {
          maxFeePerGas: fastMaxFee.toString(),
          maxPriorityFeePerGas: fastPriorityFee.toString(),
        },
      };
    } else {
      // Legacy network - use gasPrice with tiers (80%, 100%, 120%)
      const baseGasPrice = feeData.gasPrice || BigInt(0);
      if (baseGasPrice === BigInt(0)) {
        return {
          success: false,
          error: "Unable to determine gas price from network",
        };
      }

      slowGasPrice = (baseGasPrice * BigInt(80)) / BigInt(100);
      standardGasPrice = baseGasPrice;
      fastGasPrice = (baseGasPrice * BigInt(120)) / BigInt(100);
    }

    // Calculate costs in native token
    const slowCost = (gasUnits * slowGasPrice);
    const standardCost = (gasUnits * standardGasPrice);
    const fastCost = (gasUnits * fastGasPrice);

    // Fetch token price in USD (optional, graceful failure)
    const tokenPriceUSD = await getTokenPriceUSD(chainId);

    // Helper to format native token amount
    const formatNative = (wei: bigint): string => {
      return formatUnits(wei, network.nativeCurrency.decimals);
    };

    // Helper to calculate USD cost
    const calculateUSD = (wei: bigint): string | undefined => {
      if (!tokenPriceUSD) return undefined;
      const nativeAmount = parseFloat(formatNative(wei));
      return (nativeAmount * tokenPriceUSD).toFixed(2);
    };

    return {
      success: true,
      gasEstimate: {
        gasUnits: gasUnits.toString(),
        gasPrices: {
          slow: slowGasPrice.toString(),
          standard: standardGasPrice.toString(),
          fast: fastGasPrice.toString(),
        },
        eip1559: eip1559Data,
        costs: {
          slow: {
            native: formatNative(slowCost),
            usd: calculateUSD(slowCost),
          },
          standard: {
            native: formatNative(standardCost),
            usd: calculateUSD(standardCost),
          },
          fast: {
            native: formatNative(fastCost),
            usd: calculateUSD(fastCost),
          },
        },
        nativeCurrency: network.nativeCurrency.symbol,
        supportsEIP1559,
      },
    };
  } catch (error) {
    console.error("Gas estimation error:", error);
    return {
      success: false,
      error: `Unexpected error during gas estimation: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
