import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/Header";
import { CodeEditor } from "@/components/CodeEditor";
import { FileExplorerPanel } from "@/components/FileExplorerPanel";
import { EditorPanel } from "@/components/EditorPanel";
import { DeploymentPanel } from "@/components/DeploymentPanel";
import { DeploymentHistory } from "@/components/DeploymentHistory";
import TemplateGallery from "@/components/TemplateGallery";
import { TemplateList } from "@/components/TemplateList";
import { useToast } from "@/hooks/use-toast";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type {
  DeploymentState,
  Network,
  CompileRequest,
  CompileResponse,
  InsertDeployment,
  ContractTemplate,
  WorkspaceFile,
} from "@shared/schema";
import { NETWORKS } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppKit, useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy, arbitrum, arbitrumSepolia, optimism, optimismSepolia, avalanche, avalancheFuji } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { ContractFactory } from "ethers";
import { useConfig } from "wagmi";
import { getEthersSigner } from "@/lib/wagmi-ethers";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";

// Map chain IDs to Reown AppKit network objects
const REOWN_NETWORKS: Record<number, AppKitNetwork> = {
  1: mainnet,
  11155111: sepolia,
  56: bsc,
  97: bscTestnet,
  137: polygon,
  80002: polygonAmoy,
  42161: arbitrum,
  421614: arbitrumSepolia,
  10: optimism,
  11155420: optimismSepolia,
  43114: avalanche,
  43113: avalancheFuji,
};

const INITIAL_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public message;

    constructor(string memory _message) {
        message = _message;
    }

    function setMessage(string memory _message) public {
        message = _message;
    }
}`;

export default function Deploy() {
  const { toast } = useToast();
  const { isAuthenticated, isAuthenticating, authenticate, ensureAuthenticated } = useWalletAuth();
  const { address, isConnected } = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();
  const wagmiConfig = useConfig();
  const [code, setCode] = useState(INITIAL_CODE);
  const [solcVersion, setSolcVersion] = useState("0.8.20");
  const [fullCompilerVersion, setFullCompilerVersion] = useState<string | null>(null); // Full version with commit hash from compiler
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(NETWORKS[1]); // Default to Sepolia testnet
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({
    status: "idle",
  });
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState("files");
  
  // Advanced compiler options
  const [optimizationEnabled, setOptimizationEnabled] = useState(true);
  const [optimizationRuns, setOptimizationRuns] = useState(200);
  const [evmVersion, setEvmVersion] = useState<"paris" | "shanghai" | "cancun" | "london" | "berlin" | "istanbul">("paris");

  // File management state
  const [openFiles, setOpenFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromPropRef = useRef(false);

  // Panel collapse state
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  // Track auto-authentication attempt for wallet connection
  const hasAttemptedAutoAuthRef = useRef<boolean>(false);

  // Fetch workspaces and auto-select first one
  const { data: workspaces = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/workspaces'],
  });

  // Auto-select first workspace when workspaces are loaded
  useEffect(() => {
    if (workspaces.length > 0 && selectedWorkspace === null) {
      setSelectedWorkspace(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspace]);

  // Reset file state when workspace changes
  useEffect(() => {
    if (selectedWorkspace !== null) {
      setActiveFile(null);
      setOpenFiles([]);
      setCode(INITIAL_CODE);
    }
  }, [selectedWorkspace]);

  // Fetch workspace files
  const { data: allFiles = [], isLoading: isLoadingFiles } = useQuery<WorkspaceFile[]>({
    queryKey: ['/api/workspaces', selectedWorkspace, 'files'],
    enabled: !!selectedWorkspace,
  });

  // Auto-select first .sol file when workspace loads
  useEffect(() => {
    if (allFiles.length > 0 && !activeFile && selectedWorkspace) {
      const firstSolFile = allFiles.find(f => !f.isDirectory && f.path.endsWith('.sol'));
      if (firstSolFile) {
        handleFileSelect(firstSolFile);
      }
    }
  }, [allFiles, activeFile, selectedWorkspace]);

  // Sync activeFile.content → code when activeFile changes
  useEffect(() => {
    if (activeFile && !isUpdatingFromPropRef.current) {
      isUpdatingFromPropRef.current = true;
      setCode(activeFile.content);
      setTimeout(() => {
        isUpdatingFromPropRef.current = false;
      }, 0);
    }
  }, [activeFile]);

  // File CRUD mutations
  const createFileMutation = useMutation({
    mutationFn: async ({ path, content = '', isDirectory = false }: { path: string; content?: string; isDirectory?: boolean }) => {
      if (!selectedWorkspace) {
        throw new Error('No workspace selected');
      }
      const response = await apiRequest('POST', `/api/workspaces/${selectedWorkspace}/files`, { path, content, isDirectory });
      return response.json();
    },
    onSuccess: (newFile: WorkspaceFile, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', selectedWorkspace, 'files'] });
      
      // Auto-open .sol files
      if (!variables.isDirectory && variables.path.endsWith('.sol')) {
        handleFileSelect(newFile);
      }
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, content, path }: { fileId: number; content?: string; path?: string }) => {
      if (!selectedWorkspace) {
        throw new Error('No workspace selected');
      }
      return apiRequest('PATCH', `/api/workspaces/${selectedWorkspace}/files/${fileId}`, { content, path });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', selectedWorkspace, 'files'] });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      if (!selectedWorkspace) {
        throw new Error('No workspace selected');
      }
      return apiRequest('DELETE', `/api/workspaces/${selectedWorkspace}/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', selectedWorkspace, 'files'] });
    },
  });

  // File operation handlers
  const scheduleAutoSave = useCallback((fileId: number, content: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      updateFileMutation.mutate({ fileId, content });
    }, 500);
  }, [updateFileMutation]);

  const handleFileSelect = useCallback((file: WorkspaceFile) => {
    setActiveFile(file);
    
    // Add to open files if not already open
    if (!openFiles.find(f => f.id === file.id)) {
      setOpenFiles(prev => [...prev, file]);
    }
  }, [openFiles]);

  const handleFileCreate = async (path: string, isDirectory: boolean) => {
    try {
      await createFileMutation.mutateAsync({ path, isDirectory, content: '' });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create file",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFileDelete = async (file: WorkspaceFile) => {
    try {
      await deleteFileMutation.mutateAsync(file.id);
      
      // Remove from open files
      setOpenFiles(prev => prev.filter(f => f.id !== file.id));
      
      // If it was the active file, switch to another open file or null
      if (activeFile?.id === file.id) {
        const remaining = openFiles.filter(f => f.id !== file.id);
        setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFileRename = async (file: WorkspaceFile, newPath: string) => {
    try {
      await updateFileMutation.mutateAsync({ fileId: file.id, path: newPath });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to rename file",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleTabClose = (file: WorkspaceFile) => {
    const newOpenFiles = openFiles.filter(f => f.id !== file.id);
    setOpenFiles(newOpenFiles);
    
    // If closing the active file, switch to the last remaining file or null
    if (activeFile?.id === file.id) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  const handleCodeChange = (newCode: string) => {
    if (!isUpdatingFromPropRef.current) {
      setCode(newCode);
      
      // Auto-save if we have an active file in workspace mode
      if (activeFile && selectedWorkspace) {
        scheduleAutoSave(activeFile.id, newCode);
      }
    }
  };

  const toggleLeftPanel = () => {
    const panel = leftPanelRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  const compileMutation = useMutation({
    mutationFn: async (request: CompileRequest) => {
      const response = await apiRequest("POST", "/api/compile", request);
      return await response.json() as CompileResponse;
    },
    onMutate: () => {
      setDeploymentState({
        status: "compiling",
      });
    },
    onSuccess: (data) => {
      if (data.success && data.contract) {
        setDeploymentState({
          status: "compiled",
          compiledContract: data.contract,
        });
        // Store full compiler version with commit hash for verification
        if (data.compilerVersion) {
          setFullCompilerVersion(data.compilerVersion);
        }
        toast({
          title: "Compilation successful",
          description: `Contract ${data.contract.contractName} compiled successfully`,
        });
      } else {
        setDeploymentState({
          status: "error",
          error: data.error || "Compilation failed",
        });
        toast({
          variant: "destructive",
          title: "Compilation failed",
          description: data.error || "Unknown error occurred",
        });
      }
    },
    onError: (error: Error) => {
      setDeploymentState({
        status: "error",
        error: error.message,
      });
      toast({
        variant: "destructive",
        title: "Compilation failed",
        description: error.message,
      });
    },
  });

  // Sync selectedNetwork with Reown's active chain
  useEffect(() => {
    if (chainId) {
      const matchedNetwork = NETWORKS.find(n => n.chainId === chainId);
      if (matchedNetwork && matchedNetwork.id !== selectedNetwork.id) {
        setSelectedNetwork(matchedNetwork);
      }
    }
  }, [chainId]);

  // Auto-authenticate when wallet connects (single attempt, user can manually retry if needed)
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !isAuthenticating && !hasAttemptedAutoAuthRef.current) {
      hasAttemptedAutoAuthRef.current = true;
      authenticate(address);
    }
    
    // Reset flag when wallet disconnects or successfully authenticates
    if (!isConnected || isAuthenticated) {
      hasAttemptedAutoAuthRef.current = false;
    }
  }, [isConnected, address, isAuthenticated, isAuthenticating]);

  const handleSelectNetwork = async (network: Network) => {
    // Only update if wallet is not connected, or if the switch succeeds
    if (!isConnected) {
      setSelectedNetwork(network);
      return;
    }
    
    if (chainId !== network.chainId) {
      const reownNetwork = REOWN_NETWORKS[network.chainId];
      if (!reownNetwork) {
        toast({
          variant: "destructive",
          title: "Unsupported network",
          description: `Network ${network.name} is not supported for switching`,
        });
        return;
      }
      
      try {
        await switchNetwork(reownNetwork);
        setSelectedNetwork(network); // Only set after successful switch
        toast({
          title: "Network switched",
          description: `Switched to ${network.name}`,
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Failed to switch network",
          description: error.message || "Could not switch network. Please try again or switch manually in your wallet.",
        });
      }
    } else {
      // Already on the correct network
      setSelectedNetwork(network);
    }
  };

  const handleCompile = () => {
    compileMutation.mutate({
      sourceCode: code,
      fileName: "Contract.sol",
      solcVersion,
      optimizationEnabled,
      optimizationRuns,
      evmVersion,
    });
  };

  const handleSelectTemplate = (template: ContractTemplate) => {
    setCode(template.sourceCode);
    setSolcVersion(template.solcVersion);
    setDeploymentState({ status: "idle" });
    setLeftPanelTab("files"); // Switch to Files tab after selecting template
    toast({
      title: "Template loaded",
      description: `${template.name} loaded successfully`,
    });
  };

  const handleDeploy = async (constructorArgs: string[]) => {
    if (!deploymentState.compiledContract) {
      toast({
        variant: "destructive",
        title: "No compiled contract",
        description: "Please compile the contract first",
      });
      return;
    }

    // Ensure wallet is connected
    if (!isConnected || !address) {
      toast({
        variant: "destructive",
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
      });
      return;
    }

    // Ensure wallet is authenticated before deployment
    const isAuth = await ensureAuthenticated(address);
    if (!isAuth) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please authenticate your wallet to deploy contracts",
      });
      return;
    }

    // Set status to deploying immediately to show loading state
    setDeploymentState({
      ...deploymentState,
      status: "deploying",
    });

    // Ensure wallet is on the correct network BEFORE deploying
    if (chainId !== selectedNetwork.chainId) {
      const reownNetwork = REOWN_NETWORKS[selectedNetwork.chainId];
      if (!reownNetwork) {
        setDeploymentState({
          ...deploymentState,
          status: "compiled",
        });
        toast({
          variant: "destructive",
          title: "Unsupported network",
          description: `Please switch to ${selectedNetwork.name} manually in your wallet`,
        });
        return;
      }
      
      try {
        await switchNetwork(reownNetwork);
        toast({
          title: "Network switched",
          description: `Switched to ${selectedNetwork.name}. Ready to deploy.`,
        });
        // Wait a moment for the network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        setDeploymentState({
          ...deploymentState,
          status: "compiled",
        });
        toast({
          variant: "destructive",
          title: "Network switch failed",
          description: error.message || "Please switch to the correct network manually",
        });
        return;
      }
    }

    try {

      // Get ethers signer from wagmi wallet client (wallet should be on correct network now)
      const signer = await getEthersSigner(wagmiConfig);

      // Deploy contract using ethers ContractFactory
      const contractFactory = new ContractFactory(
        deploymentState.compiledContract.abi,
        deploymentState.compiledContract.bytecode,
        signer
      );

      const contract = await contractFactory.deploy(...constructorArgs);
      await contract.waitForDeployment();

      const contractAddress = await contract.getAddress();
      const transactionHash = contract.deploymentTransaction()?.hash || "";

      setDeploymentState({
        ...deploymentState,
        status: "deployed",
        contractAddress,
        transactionHash,
      });

      const deployment: InsertDeployment = {
        walletAddress: address, // Backend will override this from session for security
        contractName: deploymentState.compiledContract.contractName,
        contractAddress,
        sourceCode: code,
        flattenedSource: deploymentState.compiledContract.flattenedSource || null,
        abi: deploymentState.compiledContract.abi,
        network: selectedNetwork.id,
        chainId: selectedNetwork.chainId,
        txHash: transactionHash,
        constructorArgs: constructorArgs.length > 0 ? constructorArgs : null,
        verified: false,
        notes: null,
        solcVersion: fullCompilerVersion || solcVersion, // Use full version with commit hash if available
        blockExplorerUrl: `${selectedNetwork.blockExplorer}/address/${contractAddress}`,
        optimizationEnabled,
        optimizationRuns,
        evmVersion, // Store EVM version for future verification regeneration
      };

      try {
        const response = await apiRequest("POST", "/api/deployments", {
          ...deployment,
          workspaceId: selectedWorkspace, // Include workspace ID to auto-associate deployment
        });
        if (!response.ok) {
          const error = await response.json();
          
          // Handle 401 specifically - prompt re-authentication
          if (response.status === 401) {
            const retryAuth = await ensureAuthenticated(address);
            if (retryAuth) {
              // Retry saving the deployment with workspace ID
              const retryResponse = await apiRequest("POST", "/api/deployments", {
                ...deployment,
                workspaceId: selectedWorkspace,
              });
              if (retryResponse.ok) {
                await retryResponse.json();
                // Invalidate both general deployments and workspace-specific deployments
                queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
                if (selectedWorkspace) {
                  queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspace, "deployments"] });
                }
                toast({
                  title: "Deployment Saved",
                  description: "Deployment saved successfully after re-authentication",
                });
                return;
              }
            }
          }
          
          throw new Error(error.error || "Failed to save deployment");
        }
        await response.json();
        // Invalidate both general deployments and workspace-specific deployments
        queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
        if (selectedWorkspace) {
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspace, "deployments"] });
        }
      } catch (error) {
        console.error("Failed to save deployment to database:", error);
        toast({
          variant: "destructive",
          title: "Warning",
          description: "Contract deployed but failed to save to history. Please check your authentication.",
        });
      }

      toast({
        title: "Deployment successful",
        description: `Contract deployed at ${contractAddress}`,
      });
    } catch (error: any) {
      setDeploymentState({
        ...deploymentState,
        status: "error",
        error: error.message,
      });
      toast({
        variant: "destructive",
        title: "Deployment failed",
        description: error.message,
      });
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        selectedNetwork={selectedNetwork}
        onSelectNetwork={handleSelectNetwork}
      />

      <div className="hidden flex-1 overflow-hidden lg:flex">
        <ResizablePanelGroup direction="horizontal">
          {/* Panel 1: FileExplorer / Templates - 12% */}
          <ResizablePanel 
            ref={leftPanelRef}
            defaultSize={12} 
            minSize={10} 
            maxSize={30} 
            collapsible={true}
            onCollapse={() => setIsLeftPanelCollapsed(true)}
            onExpand={() => setIsLeftPanelCollapsed(false)}
          >
            <Tabs value={leftPanelTab} onValueChange={setLeftPanelTab} className="flex h-full flex-col bg-card rounded-none border-0">
              <TabsList className="w-full rounded-none border-b flex-wrap gap-1">
                <TabsTrigger value="files" className="flex-1" data-testid="tab-left-files">
                  Files
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex-1" data-testid="tab-left-templates">
                  Templates
                </TabsTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleLeftPanel}
                  className="h-8"
                  data-testid="button-toggle-left-panel-expanded"
                  aria-expanded={true}
                  aria-label="Collapse file explorer"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </Button>
              </TabsList>
              <TabsContent value="files" className="flex-1 overflow-hidden m-0">
                <FileExplorerPanel
                  files={allFiles}
                  activeFile={activeFile}
                  openFiles={openFiles}
                  selectedWorkspace={selectedWorkspace}
                  onWorkspaceChange={setSelectedWorkspace}
                  onFileSelect={handleFileSelect}
                  onFileCreate={handleFileCreate}
                  onFileDelete={handleFileDelete}
                  onFileRename={handleFileRename}
                />
              </TabsContent>
              <TabsContent value="templates" className="flex-1 overflow-hidden m-0">
                <TemplateList onSelectTemplate={handleSelectTemplate} />
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle />

          {/* Panel 2: Monaco Editor Only - 50% */}
          <ResizablePanel defaultSize={50} minSize={45}>
            <div className="relative h-full">
              {/* Collapsed Rail - Visible when left panel is collapsed */}
              {isLeftPanelCollapsed && (
                <div 
                  className="absolute inset-y-0 left-0 w-12 bg-card/95 backdrop-blur-sm border-r flex items-center justify-center z-20 rounded-r-md"
                  data-testid="collapsed-rail"
                >
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleLeftPanel}
                    className="h-8 w-8"
                    data-testid="button-toggle-left-panel-collapsed"
                    aria-expanded={false}
                    aria-label="Expand file explorer"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <EditorPanel
                code={code}
                onCodeChange={handleCodeChange}
                solcVersion={solcVersion}
                onSolcVersionChange={setSolcVersion}
                activeFile={activeFile}
                openFiles={openFiles}
                onTabClose={handleTabClose}
                onFileSelect={handleFileSelect}
                onOpenTemplates={() => setLeftPanelTab('templates')}
                isLeftPanelCollapsed={isLeftPanelCollapsed}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Panel 3: DeploymentPanel - 23% */}
          <ResizablePanel defaultSize={23} minSize={20}>
            <DeploymentPanel
              deploymentState={deploymentState}
              selectedNetwork={selectedNetwork}
              onSelectNetwork={handleSelectNetwork}
              onCompile={handleCompile}
              onDeploy={handleDeploy}
              walletConnected={isConnected}
              optimizationEnabled={optimizationEnabled}
              onOptimizationEnabledChange={setOptimizationEnabled}
              optimizationRuns={optimizationRuns}
              onOptimizationRunsChange={setOptimizationRuns}
              evmVersion={evmVersion}
              onEvmVersionChange={setEvmVersion}
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Panel 4: History - 15% */}
          <ResizablePanel defaultSize={15} minSize={12} maxSize={30} collapsible={true}>
            <DeploymentHistory 
              walletAddress={address}
              selectedWorkspace={selectedWorkspace}
              onWorkspaceChange={setSelectedWorkspace}
              currentSourceCode={code}
              currentSolcVersion={solcVersion}
              onRestoreVersion={setCode}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="flex-1 overflow-hidden lg:hidden">
        <Tabs defaultValue="code" className="flex h-full flex-col">
          <TabsList className="w-full rounded-none border-b grid grid-cols-4">
            <TabsTrigger value="code" data-testid="tab-code">
              Code
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              Templates
            </TabsTrigger>
            <TabsTrigger value="deploy" data-testid="tab-deploy">
              Deploy
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="code" className="flex-1 overflow-hidden m-0">
            <CodeEditor
              code={code}
              onChange={setCode}
              solcVersion={solcVersion}
              onSolcVersionChange={setSolcVersion}
              onOpenTemplates={() => setTemplateGalleryOpen(true)}
              workspaceId={selectedWorkspace}
              onWorkspaceChange={setSelectedWorkspace}
            />
          </TabsContent>
          <TabsContent value="templates" className="flex-1 overflow-hidden m-0">
            <TemplateList onSelectTemplate={handleSelectTemplate} />
          </TabsContent>
          <TabsContent value="deploy" className="flex-1 overflow-hidden m-0">
            <DeploymentPanel
              deploymentState={deploymentState}
              selectedNetwork={selectedNetwork}
              onSelectNetwork={handleSelectNetwork}
              onCompile={handleCompile}
              onDeploy={handleDeploy}
              walletConnected={isConnected}
              optimizationEnabled={optimizationEnabled}
              onOptimizationEnabledChange={setOptimizationEnabled}
              optimizationRuns={optimizationRuns}
              onOptimizationRunsChange={setOptimizationRuns}
              evmVersion={evmVersion}
              onEvmVersionChange={setEvmVersion}
            />
          </TabsContent>
          <TabsContent value="history" className="flex-1 overflow-hidden m-0">
            <DeploymentHistory 
              walletAddress={address}
              selectedWorkspace={selectedWorkspace}
              onWorkspaceChange={setSelectedWorkspace}
              currentSourceCode={code}
              currentSolcVersion={solcVersion}
              onRestoreVersion={setCode}
            />
          </TabsContent>
        </Tabs>
      </div>

      <TemplateGallery
        open={templateGalleryOpen}
        onOpenChange={setTemplateGalleryOpen}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
}
