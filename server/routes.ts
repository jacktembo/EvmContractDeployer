import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { compileContract } from "./compiler";
import { compileRequestSchema, insertDeploymentSchema, verifyContractRequestSchema, createVersionRequestSchema, NETWORKS } from "@shared/schema";
import { storage } from "./storage";
import { z } from "zod";
import { verifyMessage, AbiCoder } from "ethers";
import { parseAbi } from "./abi-parser";
import { contractVerifier } from "./verifier";

// Secure validation schemas using session-based authentication
const updateNotesSchema = z.object({
  notes: z.string(),
});

const updateVerificationSchema = z.object({
  verified: z.boolean(),
});

// Auth request schemas
const challengeRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const verifyRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
});

// Middleware to require wallet authentication
export function requireWalletAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.walletAddress || !req.session.isAuthenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/challenge", async (req, res) => {
    try {
      const { walletAddress } = challengeRequestSchema.parse(req.body);
      
      // Generate random nonce using Node.js crypto
      const nonce = randomBytes(32).toString('hex');
      
      // Store nonce and pending wallet address (NOT authenticated yet!)
      req.session.nonce = nonce;
      req.session.pendingWalletAddress = walletAddress;
      // Do NOT set walletAddress here - only after signature verification
      
      res.json({ 
        nonce,
        message: `Sign this message to authenticate with your wallet:\n\nNonce: ${nonce}\nWallet: ${walletAddress}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid wallet address" });
      } else {
        console.error("Error generating challenge:", error);
        res.status(500).json({ error: "Failed to generate challenge" });
      }
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { walletAddress, signature } = verifyRequestSchema.parse(req.body);
      
      // Check if nonce exists in session
      if (!req.session.nonce || !req.session.pendingWalletAddress) {
        res.status(400).json({ error: "No challenge found. Request a challenge first." });
        return;
      }
      
      // Verify the wallet address matches the pending one
      if (walletAddress.toLowerCase() !== req.session.pendingWalletAddress.toLowerCase()) {
        res.status(400).json({ error: "Wallet address mismatch" });
        return;
      }
      
      // Reconstruct the message that was signed
      const message = `Sign this message to authenticate with your wallet:\n\nNonce: ${req.session.nonce}\nWallet: ${walletAddress}`;
      
      try {
        // Verify the signature using EIP-191
        const recoveredAddress = verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          // Clear session on failed verification
          delete req.session.nonce;
          delete req.session.pendingWalletAddress;
          res.status(401).json({ error: "Signature verification failed" });
          return;
        }
        
        // Authentication successful - establish authenticated session
        req.session.walletAddress = walletAddress;
        req.session.isAuthenticated = true;
        // Clear challenge data (single-use nonce)
        delete req.session.nonce;
        delete req.session.pendingWalletAddress;
        
        res.json({ 
          success: true,
          walletAddress,
        });
      } catch (verifyError) {
        console.error("Signature verification error:", verifyError);
        // Clear session on error
        delete req.session.nonce;
        delete req.session.pendingWalletAddress;
        res.status(401).json({ error: "Invalid signature" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data" });
      } else {
        console.error("Error verifying signature:", error);
        res.status(500).json({ error: "Failed to verify signature" });
      }
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // Clear all auth-related session data before destroying
    delete req.session.walletAddress;
    delete req.session.isAuthenticated;
    delete req.session.nonce;
    delete req.session.pendingWalletAddress;
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        res.status(500).json({ error: "Failed to logout" });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({
      authenticated: !!req.session.walletAddress && !!req.session.isAuthenticated,
      walletAddress: req.session.walletAddress || null,
    });
  });

  // Simple direct authentication - just trust the wallet connection
  app.post("/api/auth/connect", async (req, res) => {
    try {
      const { walletAddress } = challengeRequestSchema.parse(req.body);
      
      // Directly authenticate the wallet without signature verification
      req.session.walletAddress = walletAddress;
      req.session.isAuthenticated = true;
      
      res.json({ 
        success: true,
        walletAddress,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid wallet address" });
      } else {
        console.error("Error during direct connect:", error);
        res.status(500).json({ error: "Failed to authenticate" });
      }
    }
  });

  app.post("/api/compile", async (req, res) => {
    try {
      const validatedData = compileRequestSchema.parse(req.body);
      const result = await compileContract(validatedData);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Invalid request data",
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      }
    }
  });

  // Deployment history routes
  app.post("/api/deployments", requireWalletAuth, async (req, res) => {
    try {
      const { workspaceId, ...deploymentData } = req.body;
      const deployment = insertDeploymentSchema.parse(deploymentData);
      
      // Override walletAddress from session (prevent spoofing)
      const secureDeployment = {
        ...deployment,
        walletAddress: req.session.walletAddress!,
      };
      
      const result = await storage.createDeployment(secureDeployment);
      
      // Automatically associate deployment with workspace if provided
      if (workspaceId && typeof workspaceId === 'number') {
        try {
          // Verify workspace exists and user is a member before associating
          const workspace = await storage.getWorkspace(workspaceId);
          if (workspace) {
            const members = workspace.members as any[];
            const isMember = members.some(m => m.address?.toLowerCase() === req.session.walletAddress!.toLowerCase());
            
            if (isMember) {
              await storage.addDeploymentToWorkspace(workspaceId, result.id);
              console.log(`[Deployment] Associated deployment ${result.id} with workspace ${workspaceId}`);
            } else {
              console.warn(`[Deployment] User ${req.session.walletAddress} is not a member of workspace ${workspaceId}, skipping association`);
            }
          } else {
            console.warn(`[Deployment] Workspace ${workspaceId} not found, skipping association`);
          }
        } catch (error) {
          console.error(`[Deployment] Failed to associate deployment ${result.id} with workspace ${workspaceId}:`, error);
          // Don't fail the request - deployment was still created successfully
        }
      }
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid deployment data" });
      } else {
        console.error("Error creating deployment:", error);
        res.status(500).json({ error: "Failed to save deployment" });
      }
    }
  });

  app.get("/api/deployments", requireWalletAuth, async (req, res) => {
    try {
      const walletAddress = req.session.walletAddress!;
      const deployments = await storage.getDeploymentsByWallet(walletAddress);
      res.json(deployments);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      res.status(500).json({ error: "Failed to fetch deployments" });
    }
  });

  app.patch("/api/deployments/:id/notes", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = updateNotesSchema.parse(req.body);
      const walletAddress = req.session.walletAddress!;
      
      // Verify ownership
      const deployment = await storage.getDeployment(id);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only modify your own deployments" });
        return;
      }
      
      await storage.updateDeploymentNotes(id, notes);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data" });
      } else {
        console.error("Error updating notes:", error);
        res.status(500).json({ error: "Failed to update notes" });
      }
    }
  });

  app.post("/api/deployments/:id/verify", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      // Verify ownership
      let deployment = await storage.getDeployment(id);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only verify your own deployments" });
        return;
      }
      
      if (deployment.verified) {
        res.json({ 
          success: true, 
          message: "Contract is already verified",
          verificationUrl: deployment.blockExplorerUrl,
        });
        return;
      }
      
      // Regenerate flattened source for legacy deployments (created before flattening feature)
      let sourceForVerification = deployment.flattenedSource;
      
      if (!sourceForVerification) {
        console.log(`[Verification] Regenerating flattened source for deployment ${id} (legacy deployment)`);
        
        try {
          // Recompile to generate flattened source using the stored EVM version
          const compilationResult = await compileContract({
            sourceCode: deployment.sourceCode,
            fileName: `${deployment.contractName}.sol`,
            solcVersion: deployment.solcVersion || "0.8.20",
            optimizationEnabled: deployment.optimizationEnabled ?? true,
            optimizationRuns: deployment.optimizationRuns ?? 200,
            evmVersion: (deployment.evmVersion || "paris") as any, // Use stored EVM version, fallback to paris for legacy
          });
          
          if (compilationResult.success && compilationResult.contract?.flattenedSource) {
            sourceForVerification = compilationResult.contract.flattenedSource;
            
            // Persist the regenerated flattened source for future verifications
            await storage.updateDeploymentFlattenedSource(id, sourceForVerification);
            console.log(`[Verification] Successfully regenerated and saved flattened source for deployment ${id}`);
          } else {
            // If regeneration fails, fall back to raw source (will likely fail verification)
            console.warn(`[Verification] Failed to regenerate flattened source for deployment ${id}, using raw source`);
            sourceForVerification = deployment.sourceCode;
          }
        } catch (error) {
          console.error(`[Verification] Error regenerating flattened source:`, error);
          sourceForVerification = deployment.sourceCode;
        }
      }
      
      // Encode constructor arguments if present
      let encodedConstructorArgs: string | undefined;
      if (deployment.constructorArgs && Array.isArray(deployment.constructorArgs) && deployment.constructorArgs.length > 0) {
        try {
          // Find constructor in ABI (cast to array since it's stored as JSONB)
          const abi = deployment.abi as any[];
          const constructorAbi = abi.find((item: any) => item.type === 'constructor');
          if (constructorAbi && constructorAbi.inputs && constructorAbi.inputs.length > 0) {
            // Extract types from constructor inputs
            const types = constructorAbi.inputs.map((input: any) => input.type);
            
            // Encode constructor arguments
            const abiCoder = AbiCoder.defaultAbiCoder();
            const encoded = abiCoder.encode(types, deployment.constructorArgs);
            
            // Remove '0x' prefix for Etherscan
            encodedConstructorArgs = encoded.startsWith('0x') ? encoded.slice(2) : encoded;
            
            console.log('[Verification] Encoded constructor args:', {
              types,
              values: deployment.constructorArgs,
              encoded: encodedConstructorArgs,
            });
          }
        } catch (error) {
          console.error('[Verification] Failed to encode constructor arguments:', error);
          // Continue without constructor args rather than failing
        }
      }
      
      const result = await contractVerifier.verifyContract({
        contractAddress: deployment.contractAddress,
        sourceCode: sourceForVerification,
        contractName: deployment.contractName,
        compilerVersion: deployment.solcVersion || "0.8.20",
        chainId: deployment.chainId,
        constructorArguments: encodedConstructorArgs,
        optimizationEnabled: deployment.optimizationEnabled ?? true,
        optimizationRuns: deployment.optimizationRuns ?? 200,
        evmVersion: deployment.evmVersion || "paris",
      });
      
      if (result.success && result.guid) {
        // Mark as pending and store GUID for status checking
        await storage.updateDeploymentVerificationStatus(id, 'pending', result.guid);
        
        const network = NETWORKS.find(n => n.chainId === deployment.chainId);
        const verificationUrl = network 
          ? `${network.blockExplorer}/address/${deployment.contractAddress}#code`
          : undefined;
        
        res.json({
          success: true,
          message: "Verification submitted. Checking status...",
          verificationUrl,
          status: 'pending',
        });
      } else {
        // Verification submission failed
        await storage.updateDeploymentVerificationStatus(id, 'failed');
        res.json({
          success: false,
          message: result.message || "Failed to submit verification",
        });
      }
    } catch (error) {
      console.error("Error verifying contract:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Failed to verify contract",
      });
    }
  });

  app.post("/api/deployments/:id/check-verification", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      // Verify ownership
      const deployment = await storage.getDeployment(id);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      if (!deployment.verificationGuid) {
        res.json({ 
          success: false,
          message: "No verification GUID found",
        });
        return;
      }
      
      // Check verification status with block explorer
      const result = await contractVerifier.checkVerificationStatus(
        deployment.verificationGuid,
        deployment.chainId
      );
      
      if (result.success) {
        // Verification complete!
        await storage.updateDeploymentVerificationStatus(id, 'verified');
        res.json({
          success: true,
          message: "Contract verified successfully",
          status: 'verified',
        });
      } else if (result.status.includes('Pending') || result.status.includes('pending')) {
        // Still pending
        res.json({
          success: false,
          message: "Verification still pending",
          status: 'pending',
        });
      } else {
        // Verification failed
        await storage.updateDeploymentVerificationStatus(id, 'failed');
        res.json({
          success: false,
          message: `Verification failed: ${result.status}`,
          status: 'failed',
        });
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Failed to check verification status",
      });
    }
  });

  app.patch("/api/deployments/:id/verification", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { verified } = updateVerificationSchema.parse(req.body);
      const walletAddress = req.session.walletAddress!;
      
      // Verify ownership
      const deployment = await storage.getDeployment(id);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only modify your own deployments" });
        return;
      }
      
      await storage.updateDeploymentVerification(id, verified);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data" });
      } else {
        console.error("Error updating verification:", error);
        res.status(500).json({ error: "Failed to update verification status" });
      }
    }
  });

  app.delete("/api/deployments/:id", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      // Verify ownership
      const deployment = await storage.getDeployment(id);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only delete your own deployments" });
        return;
      }
      
      await storage.deleteDeployment(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting deployment:", error);
      res.status(500).json({ error: "Failed to delete deployment" });
    }
  });

  // Contract Version Management API
  app.get("/api/deployments/:id/versions", requireWalletAuth, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      
      if (isNaN(deploymentId)) {
        res.status(400).json({ error: "Invalid deployment ID" });
        return;
      }
      
      const walletAddress = req.session.walletAddress!;
      
      // Verify ownership
      const deployment = await storage.getDeployment(deploymentId);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only view versions for your own deployments" });
        return;
      }
      
      const versions = await storage.getContractVersions(deploymentId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching contract versions:", error);
      res.status(500).json({ error: "Failed to fetch contract versions" });
    }
  });

  app.post("/api/deployments/:id/versions", requireWalletAuth, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      
      if (isNaN(deploymentId)) {
        res.status(400).json({ error: "Invalid deployment ID" });
        return;
      }
      
      const walletAddress = req.session.walletAddress!;
      
      // Validate request body
      const validatedData = createVersionRequestSchema.parse(req.body);
      
      // Verify ownership
      const deployment = await storage.getDeployment(deploymentId);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only create versions for your own deployments" });
        return;
      }
      
      // Create version (version number calculated atomically)
      const version = await storage.createContractVersion({
        deploymentId,
        sourceCode: validatedData.sourceCode,
        notes: validatedData.notes || null,
        solcVersion: validatedData.solcVersion || deployment.solcVersion || null,
        compilerSettings: validatedData.compilerSettings || null,
        createdBy: walletAddress,
      });
      
      res.json(version);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
        return;
      }
      console.error("Error creating contract version:", error);
      res.status(500).json({ error: "Failed to create contract version" });
    }
  });

  app.get("/api/deployments/:deploymentId/versions/:versionId", requireWalletAuth, async (req, res) => {
    try {
      const versionId = parseInt(req.params.versionId);
      const deploymentId = parseInt(req.params.deploymentId);
      
      if (isNaN(versionId) || isNaN(deploymentId)) {
        res.status(400).json({ error: "Invalid version or deployment ID" });
        return;
      }
      
      const walletAddress = req.session.walletAddress!;
      
      // Verify ownership
      const deployment = await storage.getDeployment(deploymentId);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only view versions for your own deployments" });
        return;
      }
      
      const version = await storage.getContractVersion(versionId);
      if (!version || version.deploymentId !== deploymentId) {
        res.status(404).json({ error: "Version not found" });
        return;
      }
      
      res.json(version);
    } catch (error) {
      console.error("Error fetching contract version:", error);
      res.status(500).json({ error: "Failed to fetch contract version" });
    }
  });

  // Workspace Management API
  app.get("/api/workspaces", requireWalletAuth, async (req, res) => {
    try {
      const walletAddress = req.session.walletAddress!;
      let workspaces = await storage.getWorkspacesByMember(walletAddress);
      
      // Create default workspace if user has none
      if (workspaces.length === 0) {
        await storage.createWorkspace({
          name: "Default Workspace",
          createdBy: walletAddress,
          members: [{ address: walletAddress, role: "owner" }],
          deployments: [],
        });
        // Re-fetch workspaces to get the newly created one
        workspaces = await storage.getWorkspacesByMember(walletAddress);
      }
      
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.post("/api/workspaces", requireWalletAuth, async (req, res) => {
    try {
      const walletAddress = req.session.walletAddress!;
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: "Workspace name is required" });
        return;
      }
      
      const workspace = await storage.createWorkspace({
        name: name.trim(),
        createdBy: walletAddress,
        members: [{ address: walletAddress, role: 'owner' }],
        deployments: [],
      });
      
      res.json(workspace);
    } catch (error) {
      console.error("Error creating workspace:", error);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  app.get("/api/workspaces/:id", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      const workspace = await storage.getWorkspace(id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      
      // Verify membership
      const members = workspace.members as any[];
      const isMember = members.some(m => m.address?.toLowerCase() === walletAddress.toLowerCase());
      if (!isMember) {
        res.status(403).json({ error: "Unauthorized: You are not a member of this workspace" });
        return;
      }
      
      res.json(workspace);
    } catch (error) {
      console.error("Error fetching workspace:", error);
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  app.get("/api/workspaces/:id/deployments", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      const workspace = await storage.getWorkspace(id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      
      // Verify membership
      const members = workspace.members as any[];
      const isMember = members.some(m => m.address?.toLowerCase() === walletAddress.toLowerCase());
      if (!isMember) {
        res.status(403).json({ error: "Unauthorized: You are not a member of this workspace" });
        return;
      }
      
      // Fetch deployments for this workspace
      const deploymentIds = workspace.deployments as number[];
      const deployments = [];
      for (const deploymentId of deploymentIds) {
        const deployment = await storage.getDeployment(deploymentId);
        if (deployment) {
          deployments.push(deployment);
        }
      }
      
      // Sort by deployed date (most recent first)
      deployments.sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime());
      
      res.json(deployments);
    } catch (error) {
      console.error("Error fetching workspace deployments:", error);
      res.status(500).json({ error: "Failed to fetch workspace deployments" });
    }
  });

  app.patch("/api/workspaces/:id/members", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      const { members } = req.body;
      
      const workspace = await storage.getWorkspace(id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      
      // Only owner can update members
      if (workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: Only the workspace owner can update members" });
        return;
      }
      
      await storage.updateWorkspaceMembers(id, members);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating workspace members:", error);
      res.status(500).json({ error: "Failed to update workspace members" });
    }
  });

  app.post("/api/workspaces/:id/deployments", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      const { deploymentId } = req.body;
      
      const workspace = await storage.getWorkspace(id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      
      // Verify membership
      const members = workspace.members as any[];
      const isMember = members.some(m => m.address?.toLowerCase() === walletAddress.toLowerCase());
      if (!isMember) {
        res.status(403).json({ error: "Unauthorized: You are not a member of this workspace" });
        return;
      }
      
      // Verify deployment ownership
      const deployment = await storage.getDeployment(deploymentId);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only add your own deployments" });
        return;
      }
      
      await storage.addDeploymentToWorkspace(id, deploymentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding deployment to workspace:", error);
      res.status(500).json({ error: "Failed to add deployment to workspace" });
    }
  });

  app.post("/api/workspaces/:id/associate-all-deployments", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      const workspace = await storage.getWorkspace(id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      
      // Verify membership
      const members = (workspace.members as any[]) || [];
      const isMember = members.some(m => m.address?.toLowerCase() === walletAddress.toLowerCase());
      if (!isMember) {
        res.status(403).json({ error: "Unauthorized: You are not a member of this workspace" });
        return;
      }
      
      // Get all deployments for this user
      const allDeployments = await storage.getDeploymentsByWallet(walletAddress);
      
      // Get current workspace deployments
      const currentDeployments = (workspace.deployments as number[]) || [];
      
      // Associate all deployments with the workspace
      let associatedCount = 0;
      let skippedCount = 0;
      
      for (const deployment of allDeployments) {
        if (!currentDeployments.includes(deployment.id)) {
          await storage.addDeploymentToWorkspace(id, deployment.id);
          associatedCount++;
        } else {
          skippedCount++;
        }
      }
      
      console.log(`[Workspace ${id}] Associated ${associatedCount} deployments, skipped ${skippedCount} existing ones`);
      
      res.json({ 
        success: true, 
        associated: associatedCount,
        skipped: skippedCount,
        total: allDeployments.length
      });
    } catch (error) {
      console.error("Error associating all deployments:", error);
      res.status(500).json({ error: "Failed to associate deployments" });
    }
  });

  app.patch("/api/workspaces/:id", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: "Workspace name is required" });
        return;
      }
      
      const workspace = await storage.getWorkspace(id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      
      // Only creator can rename workspace
      if (workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Only workspace owner can rename workspace" });
        return;
      }
      
      await storage.renameWorkspace(id, name.trim());
      res.json({ success: true, message: "Workspace renamed successfully" });
    } catch (error) {
      console.error("Error renaming workspace:", error);
      res.status(500).json({ error: "Failed to rename workspace" });
    }
  });

  app.delete("/api/workspaces/:id", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      const workspace = await storage.getWorkspace(id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      
      // Only owner can delete workspace
      if (workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: Only the workspace owner can delete this workspace" });
        return;
      }
      
      await storage.deleteWorkspace(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workspace:", error);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  // File management routes
  app.get("/api/workspaces/:id/files", requireWalletAuth, async (req, res) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;

      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const members = workspace.members as any[];
      const isMember = members.some((m: any) => m.address?.toLowerCase() === walletAddress.toLowerCase());
      
      if (!isMember && workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const files = await storage.getWorkspaceFiles(workspaceId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching workspace files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // Bulk file upload endpoint
  app.post("/api/workspaces/:id/files/bulk", requireWalletAuth, async (req, res) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      const { files } = req.body;

      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: "Files array is required" });
        return;
      }

      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const members = (workspace.members as any[]) || [];
      const isMember = members.some((m: any) => m.address?.toLowerCase() === walletAddress.toLowerCase());
      
      if (!isMember && workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const createdFiles: WorkspaceFile[] = [];
      const errors: Array<{ path: string; error: string }> = [];

      for (const fileData of files) {
        try {
          const { path, content = '', isDirectory = false } = fileData;
          
          if (!path) {
            errors.push({ path: 'unknown', error: 'Path is required' });
            continue;
          }

          const existing = await storage.getFileByPath(workspaceId, path);
          if (existing) {
            errors.push({ path, error: 'File already exists' });
            continue;
          }

          const file = await storage.createFile({
            workspaceId,
            path,
            content,
            isDirectory,
          });
          
          createdFiles.push(file);
        } catch (error: any) {
          errors.push({ path: fileData.path || 'unknown', error: error.message });
        }
      }

      res.json({
        success: true,
        created: createdFiles.length,
        failed: errors.length,
        files: createdFiles,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Error bulk uploading files:", error);
      res.status(500).json({ error: "Failed to upload files" });
    }
  });

  app.post("/api/workspaces/:id/files", requireWalletAuth, async (req, res) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      const { path, content = '', isDirectory = false } = req.body;

      if (!path || typeof path !== 'string') {
        res.status(400).json({ error: "File path is required" });
        return;
      }

      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const members = workspace.members as any[];
      const isMember = members.some((m: any) => m.address?.toLowerCase() === walletAddress.toLowerCase());
      
      if (!isMember && workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const existing = await storage.getFileByPath(workspaceId, path);
      if (existing) {
        res.status(409).json({ error: "File already exists" });
        return;
      }

      const file = await storage.createFile({
        workspaceId,
        path,
        content,
        isDirectory,
      });

      res.json(file);
    } catch (error) {
      console.error("Error creating file:", error);
      res.status(500).json({ error: "Failed to create file" });
    }
  });

  app.patch("/api/workspaces/:id/files/:fileId", requireWalletAuth, async (req, res) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);
      const walletAddress = req.session.walletAddress!;
      const { content, path } = req.body;

      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const members = workspace.members as any[];
      const isMember = members.some((m: any) => m.address?.toLowerCase() === walletAddress.toLowerCase());
      
      if (!isMember && workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const file = await storage.getFile(fileId);
      if (!file || file.workspaceId !== workspaceId) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      if (content !== undefined) {
        await storage.updateFileContent(fileId, content);
      }

      if (path !== undefined && path !== file.path) {
        const existing = await storage.getFileByPath(workspaceId, path);
        if (existing) {
          res.status(409).json({ error: "Target path already exists" });
          return;
        }
        await storage.updateFilePath(fileId, path);
      }

      const updated = await storage.getFile(fileId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating file:", error);
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  app.delete("/api/workspaces/:id/files/:fileId", requireWalletAuth, async (req, res) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);
      const walletAddress = req.session.walletAddress!;

      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const members = workspace.members as any[];
      const isMember = members.some((m: any) => m.address?.toLowerCase() === walletAddress.toLowerCase());
      
      if (!isMember && workspace.createdBy.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const file = await storage.getFile(fileId);
      if (!file || file.workspaceId !== workspaceId) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      if (file.isDirectory) {
        await storage.deleteFilesByPath(workspaceId, file.path + '/');
      }

      await storage.deleteFile(fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Contract Interaction API - Parse ABI for a deployed contract
  app.get("/api/contracts/:id/abi", requireWalletAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const walletAddress = req.session.walletAddress!;
      
      // Get deployment with ownership verification
      const deployment = await storage.getDeployment(id);
      if (!deployment) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      if (deployment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: "Unauthorized: You can only interact with your own deployments" });
        return;
      }
      
      // Parse and categorize ABI
      const categorizedAbi = parseAbi(deployment.abi as any[]);
      
      res.json({
        contractName: deployment.contractName,
        contractAddress: deployment.contractAddress,
        network: deployment.network,
        ...categorizedAbi,
      });
    } catch (error) {
      console.error("Error parsing ABI:", error);
      res.status(500).json({ error: "Failed to parse contract ABI" });
    }
  });

  // Template API - Public read-only endpoints for educational starter code
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getAllTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const templates = await storage.getTemplatesByCategory(category);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates by category:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getTemplate(id);
      
      if (!template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
