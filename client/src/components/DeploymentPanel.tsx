import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Copy, ExternalLink, ChevronDown } from "lucide-react";
import { SiEthereum, SiBinance, SiPolygon } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import type { DeploymentState, Network } from "@shared/schema";
import { NETWORKS } from "@shared/schema";

interface DeploymentPanelProps {
  deploymentState: DeploymentState;
  selectedNetwork: Network;
  onSelectNetwork: (network: Network) => void;
  onCompile: () => void;
  onDeploy: (constructorArgs: string[]) => void;
  walletConnected: boolean;
  optimizationEnabled: boolean;
  onOptimizationEnabledChange: (enabled: boolean) => void;
  optimizationRuns: number;
  onOptimizationRunsChange: (runs: number) => void;
  evmVersion: "paris" | "shanghai" | "cancun" | "london" | "berlin" | "istanbul";
  onEvmVersionChange: (version: "paris" | "shanghai" | "cancun" | "london" | "berlin" | "istanbul") => void;
}

const NetworkIcon = ({ network }: { network: Network }) => {
  const getIcon = () => {
    switch (network.icon) {
      case "ethereum":
        return <SiEthereum className="h-5 w-5" style={{ color: network.color }} />;
      case "bsc":
        return <SiBinance className="h-5 w-5" style={{ color: network.color }} />;
      case "polygon":
        return <SiPolygon className="h-5 w-5" style={{ color: network.color }} />;
      case "arbitrum":
        return (
          <svg className="h-5 w-5" viewBox="0 0 64 64" fill="none">
            <path d="M32 0L4 16V48L32 64L60 48V16L32 0Z" fill={network.color} opacity="0.2"/>
            <path d="M32 8L12 19V45L32 56L52 45V19L32 8Z" fill={network.color}/>
            <path d="M32 20L20 26V38L32 44L44 38V26L32 20Z" fill="white"/>
          </svg>
        );
      case "optimism":
        return (
          <svg className="h-5 w-5" viewBox="0 0 500 500" fill="none">
            <circle cx="250" cy="250" r="250" fill={network.color} opacity="0.2"/>
            <circle cx="250" cy="250" r="200" fill={network.color}/>
            <path d="M180 220C180 200 190 180 210 180C230 180 240 200 240 220V280C240 300 230 320 210 320C190 320 180 300 180 280V220Z" fill="white"/>
            <path d="M260 220C260 200 270 180 290 180C310 180 320 200 320 220V280C320 300 310 320 290 320C270 320 260 300 260 280V220Z" fill="white"/>
          </svg>
        );
      case "avalanche":
        return (
          <svg className="h-5 w-5" viewBox="0 0 64 64" fill="none">
            <path d="M32 4L8 56H56L32 4Z" fill={network.color} opacity="0.2"/>
            <path d="M32 12L14 52H50L32 12Z" fill={network.color}/>
            <path d="M32 24L22 44H42L32 24Z" fill="white"/>
          </svg>
        );
      default:
        return <SiEthereum className="h-5 w-5" style={{ color: network.color }} />;
    }
  };

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ backgroundColor: `${network.color}20` }}>
      {getIcon()}
    </div>
  );
};

export function DeploymentPanel({
  deploymentState,
  selectedNetwork,
  onSelectNetwork,
  onCompile,
  onDeploy,
  walletConnected,
  optimizationEnabled,
  onOptimizationEnabledChange,
  optimizationRuns,
  onOptimizationRunsChange,
  evmVersion,
  onEvmVersionChange,
}: DeploymentPanelProps) {
  const { toast } = useToast();
  const [constructorArgs, setConstructorArgs] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const handleDeploy = () => {
    if (deploymentState.compiledContract?.constructorInputs.length) {
      const args = deploymentState.compiledContract.constructorInputs.map((input, i) => {
        return constructorArgs[i] || "";
      });
      onDeploy(args);
    } else {
      onDeploy([]);
    }
  };

  const ethereumNetworks = NETWORKS.filter((n) => n.category === "ethereum");
  const layer2Networks = NETWORKS.filter((n) => n.category === "layer2");
  const sidechainNetworks = NETWORKS.filter((n) => n.category === "sidechain");

  return (
    <div className="flex h-full flex-col bg-card border-r">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="mb-4 text-xl font-semibold">Deployment Network</h2>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <NetworkIcon network={selectedNetwork} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{selectedNetwork.name}</div>
                <div className="text-xs text-muted-foreground">
                  Chain ID: {selectedNetwork.chainId}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              {selectedNetwork.category === "ethereum" ? "Ethereum" : selectedNetwork.category === "layer2" ? "Layer 2" : "Sidechain"}
            </Badge>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Use the network selector in the header to change networks
          </div>
        </Card>
      </div>

      <div>
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex w-full items-center justify-between p-4" 
              data-testid="button-toggle-advanced"
            >
              <span className="text-sm font-semibold">Advanced Compiler Options</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {optimizationEnabled ? `Optimized (${optimizationRuns} runs)` : "No optimization"} • {evmVersion}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 px-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="optimization-enabled">Enable Optimization</Label>
                <p className="text-xs text-muted-foreground">
                  Optimize bytecode for deployment gas costs
                </p>
              </div>
              <Switch
                id="optimization-enabled"
                checked={optimizationEnabled}
                onCheckedChange={onOptimizationEnabledChange}
                data-testid="switch-optimization"
              />
            </div>

            {optimizationEnabled && (
              <div className="space-y-2">
                <Label htmlFor="optimization-runs">
                  Optimization Runs
                </Label>
                <Input
                  id="optimization-runs"
                  type="number"
                  min="1"
                  max="10000"
                  value={optimizationRuns}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 10000) {
                      onOptimizationRunsChange(value);
                    }
                  }}
                  data-testid="input-optimization-runs"
                />
                <p className="text-xs text-muted-foreground">
                  Higher values optimize for runtime gas, lower values for deployment (1-10000)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="evm-version">EVM Version</Label>
              <Select value={evmVersion} onValueChange={onEvmVersionChange}>
                <SelectTrigger id="evm-version" data-testid="select-evm-version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paris">Paris (default)</SelectItem>
                  <SelectItem value="shanghai">Shanghai</SelectItem>
                  <SelectItem value="cancun">Cancun</SelectItem>
                  <SelectItem value="london">London</SelectItem>
                  <SelectItem value="berlin">Berlin</SelectItem>
                  <SelectItem value="istanbul">Istanbul</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Target EVM version for bytecode generation
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {deploymentState.compiledContract?.constructorInputs &&
        deploymentState.compiledContract.constructorInputs.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-semibold">Constructor Arguments</h2>
            <div className="space-y-4">
              {deploymentState.compiledContract.constructorInputs.map((input, index) => (
                <div key={index}>
                  <Label htmlFor={`arg-${index}`} className="mb-2">
                    {input.name || `Argument ${index + 1}`}
                    <span className="ml-2 text-xs text-muted-foreground font-mono">
                      ({input.type})
                    </span>
                  </Label>
                  <Input
                    id={`arg-${index}`}
                    placeholder={`Enter ${input.type}...`}
                    value={constructorArgs[index] || ""}
                    onChange={(e) => {
                      const newArgs = [...constructorArgs];
                      newArgs[index] = e.target.value;
                      setConstructorArgs(newArgs);
                    }}
                    className="font-mono"
                    data-testid={`input-constructor-arg-${index}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="space-y-2">
        <Button
          onClick={onCompile}
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={deploymentState.status === "compiling"}
          data-testid="button-compile"
        >
          {deploymentState.status === "compiling" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Compiling...
            </>
          ) : (
            "Compile Contract"
          )}
        </Button>

        <Button
          onClick={handleDeploy}
          size="lg"
          className="w-full"
          disabled={
            !walletConnected ||
            deploymentState.status === "deploying" ||
            deploymentState.status !== "compiled"
          }
          data-testid="button-deploy"
        >
          {deploymentState.status === "deploying" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deploying...
            </>
          ) : (
            "Deploy Contract"
          )}
        </Button>

        {!walletConnected && (
          <p className="text-center text-sm text-muted-foreground">
            Connect your wallet to deploy
          </p>
        )}
      </div>

      {deploymentState.error && (
        <Alert variant="destructive" data-testid="alert-error">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">{deploymentState.error}</AlertDescription>
        </Alert>
      )}

      {deploymentState.status === "compiled" && deploymentState.compiledContract && (
        <>
          <Alert className="border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100" data-testid="alert-compiled">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="ml-2">
              Contract compiled successfully! Contract: {deploymentState.compiledContract.contractName}
            </AlertDescription>
          </Alert>

          <Card className="p-4" data-testid="card-abi">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Contract ABI</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(deploymentState.compiledContract!.abi),
                      "ABI"
                    )
                  }
                  data-testid="button-copy-abi"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="relative">
                <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs font-mono" data-testid="pre-abi-json">
                  {JSON.stringify(deploymentState.compiledContract.abi, null, 2)}
                </pre>
              </div>
            </div>
          </Card>

          <Card className="p-4" data-testid="card-bytecode">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Contract Bytecode</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      deploymentState.compiledContract!.bytecode,
                      "Bytecode"
                    )
                  }
                  data-testid="button-copy-bytecode"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="relative">
                <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs font-mono break-all" data-testid="pre-bytecode">
                  {deploymentState.compiledContract.bytecode}
                </pre>
              </div>
            </div>
          </Card>
        </>
      )}

      {deploymentState.status === "deployed" && deploymentState.contractAddress && (
        <div className="space-y-4" data-testid="section-deployment-result">
          <Alert className="border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="ml-2">
              Contract deployed successfully!
            </AlertDescription>
          </Alert>

          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 text-sm font-medium">Contract Address</Label>
                <div className="flex gap-2">
                  <Input
                    value={deploymentState.contractAddress}
                    readOnly
                    className="flex-1 font-mono text-sm"
                    data-testid="input-contract-address"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(deploymentState.contractAddress!, "Contract address")
                    }
                    data-testid="button-copy-address"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    data-testid="button-view-explorer"
                  >
                    <a
                      href={`${selectedNetwork.blockExplorer}/address/${deploymentState.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div>
                <Label className="mb-2 text-sm font-medium">Transaction Hash</Label>
                <div className="flex gap-2">
                  <Input
                    value={deploymentState.transactionHash || ""}
                    readOnly
                    className="flex-1 font-mono text-sm"
                    data-testid="input-tx-hash"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(deploymentState.transactionHash!, "Transaction hash")
                    }
                    data-testid="button-copy-tx"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    data-testid="button-view-tx"
                  >
                    <a
                      href={`${selectedNetwork.blockExplorer}/tx/${deploymentState.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
