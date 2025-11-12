import { useState, useEffect, useCallback } from "react";
import { BrowserProvider } from "ethers";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "./use-toast";
import { useWalletClient } from "wagmi";

interface AuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  walletAddress: string | null;
  error: string | null;
}

export function useWalletAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isAuthenticating: false,
    walletAddress: null,
    error: null,
  });
  const { toast } = useToast();
  const { data: walletClient } = useWalletClient();

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/status", {
        credentials: "include",
      });
      const data = await response.json();
      
      setAuthState({
        isAuthenticated: data.authenticated,
        isAuthenticating: false,
        walletAddress: data.walletAddress || null,
        error: null,
      });
      
      return data.authenticated;
    } catch (error) {
      console.error("Failed to check auth status:", error);
      setAuthState((prev) => ({
        ...prev,
        error: "Failed to check authentication status",
      }));
      return false;
    }
  };

  const authenticate = useCallback(async (walletAddress: string): Promise<boolean> => {
    if (!walletClient) {
      const errorMsg = "Wallet connection required for authentication";
      setAuthState((prev) => ({ ...prev, error: errorMsg }));
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to authenticate",
        variant: "destructive",
      });
      return false;
    }

    setAuthState((prev) => ({ ...prev, isAuthenticating: true, error: null }));

    try {
      // Step 1: Request challenge from backend
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
        credentials: "include",
      });

      if (!challengeResponse.ok) {
        throw new Error("Failed to get authentication challenge");
      }

      const { message } = await challengeResponse.json();

      // Step 2: Request signature using wagmi wallet client
      let signature: string;
      try {
        signature = await walletClient.signMessage({ 
          message 
        });
      } catch (signError: any) {
        if (signError.code === 4001 || signError.message?.includes("rejected") || signError.message?.includes("denied")) {
          toast({
            title: "Signature Rejected",
            description: "You must sign the message to authenticate",
            variant: "destructive",
          });
        } else {
          throw signError;
        }
        setAuthState((prev) => ({ ...prev, isAuthenticating: false }));
        return false;
      }

      // Step 3: Verify signature with backend
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, signature }),
        credentials: "include",
      });

      if (!verifyResponse.ok) {
        throw new Error("Signature verification failed");
      }

      const { success } = await verifyResponse.json();

      if (success) {
        setAuthState({
          isAuthenticated: true,
          isAuthenticating: false,
          walletAddress,
          error: null,
        });

        toast({
          title: "Authenticated",
          description: "Wallet authenticated successfully",
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Authentication error:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to authenticate wallet";
      
      toast({
        title: "Authentication Failed",
        description: errorMsg,
        variant: "destructive",
      });
      
      setAuthState((prev) => ({ ...prev, isAuthenticating: false, error: errorMsg }));
      return false;
    }
  }, [toast, walletClient]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      setAuthState({
        isAuthenticated: false,
        isAuthenticating: false,
        walletAddress: null,
        error: null,
      });

      toast({
        title: "Logged Out",
        description: "You have been logged out",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [toast]);

  // Helper to ensure wallet is authenticated before sensitive operations
  const ensureAuthenticated = useCallback(async (walletAddress: string): Promise<boolean> => {
    // First check current auth status
    const isAuth = await checkAuthStatus();
    
    if (isAuth) {
      return true;
    }
    
    // Not authenticated, prompt user to sign
    toast({
      title: "Authentication Required",
      description: "Please sign the message to authenticate your wallet",
    });
    
    return await authenticate(walletAddress);
  }, [authenticate, checkAuthStatus, toast]);

  return {
    ...authState,
    authenticate,
    logout,
    checkAuthStatus,
    ensureAuthenticated,
  };
}

// No need for ethereum global declaration since we're using wagmi
