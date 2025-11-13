import { NETWORKS, type Network } from "@shared/schema";
import { config } from "../config";

interface VerificationPayload {
  contractAddress: string;
  sourceCode: string;
  contractName: string;
  compilerVersion: string;
  constructorArguments?: string;
  chainId: number;
  optimizationEnabled?: boolean;
  optimizationRuns?: number;
  evmVersion?: string;
}

export class ContractVerifier {
  private readonly ETHERSCAN_V2_BASE_URL = 'https://api.etherscan.io/v2/api';

  private getApiKey(): string | null {
    return config.ETHERSCAN_API_KEY;
  }

  async verifyContract(payload: VerificationPayload): Promise<{
    success: boolean;
    message: string;
    guid?: string;
  }> {
    const network = NETWORKS.find(n => n.chainId === payload.chainId);
    if (!network) {
      return {
        success: false,
        message: `Network not found for chain ID ${payload.chainId}`,
      };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        message: 'ETHERSCAN_API_KEY not configured. Please add it to environment variables.',
      };
    }

    try {
      // Compiler version should already include 'v' prefix (e.g., "v0.8.30+commit.6182c971")
      // If it doesn't have the prefix, add it
      const compilerVersion = payload.compilerVersion.startsWith('v') 
        ? payload.compilerVersion 
        : `v${payload.compilerVersion}`;

      // Use provided optimization settings or defaults
      const optimizationEnabled = payload.optimizationEnabled ?? true;
      const optimizationRuns = payload.optimizationRuns ?? 200;
      const evmVersion = payload.evmVersion ?? 'paris';

      const params = new URLSearchParams({
        chainid: payload.chainId.toString(),
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: payload.contractAddress,
        sourceCode: payload.sourceCode,
        codeformat: 'solidity-single-file',
        contractname: payload.contractName,
        compilerversion: compilerVersion,
        optimizationUsed: optimizationEnabled ? '1' : '0',
        runs: optimizationRuns.toString(),
        evmversion: evmVersion,
        apikey: apiKey,
      });

      if (payload.constructorArguments) {
        params.append('constructorArguments', payload.constructorArguments);
      }
      
      // Log request for debugging
      console.log('[Etherscan V2 API] Verification request:', {
        chainId: payload.chainId,
        contractAddress: payload.contractAddress,
        contractName: payload.contractName,
        compilerVersion: compilerVersion,
        optimizationEnabled,
        optimizationRuns,
        evmVersion,
        hasConstructorArgs: !!payload.constructorArguments,
      });

      // Etherscan V2 API requires chainid in both URL and POST body
      const url = `${this.ETHERSCAN_V2_BASE_URL}?chainid=${payload.chainId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      
      // Log full response for debugging
      console.log('[Etherscan V2 API] Verification response:', JSON.stringify(data, null, 2));

      if (data.status === '1') {
        return {
          success: true,
          message: 'Contract verification submitted successfully',
          guid: data.result,
        };
      } else {
        return {
          success: false,
          message: data.result || 'Verification failed',
        };
      }
    } catch (error) {
      console.error('Verification error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async checkVerificationStatus(guid: string, chainId: number): Promise<{
    success: boolean;
    status: string;
  }> {
    const network = NETWORKS.find(n => n.chainId === chainId);
    if (!network) {
      return {
        success: false,
        status: 'Network not found',
      };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        status: 'API key not configured',
      };
    }

    try {
      const params = new URLSearchParams({
        module: 'contract',
        action: 'checkverifystatus',
        guid,
        apikey: apiKey,
      });

      // For status checks, chainid must be in URL query string (not in params to avoid duplication)
      const url = `${this.ETHERSCAN_V2_BASE_URL}?chainid=${chainId}&${params.toString()}`;
      
      console.log('[Etherscan V2 API] Status check request:', { chainId, guid });
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[Etherscan V2 API] Status check response:', JSON.stringify(data, null, 2));

      return {
        success: data.status === '1',
        status: data.result || 'Unknown status',
      };
    } catch (error) {
      console.error('Status check error:', error);
      return {
        success: false,
        status: 'Failed to check status',
      };
    }
  }
}

export const contractVerifier = new ContractVerifier();
