import { ChevronDown, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import type { Network } from "@shared/schema";
import { NETWORKS } from "@shared/schema";
import logoImage from "@assets/generated_images/Smart_contract_platform_logo_3e5930d9.png";

interface HeaderProps {
  selectedNetwork: Network;
  onSelectNetwork: (network: Network) => void;
}

const hasReownProjectId = Boolean(import.meta.env.VITE_REOWN_PROJECT_ID);

export function Header({
  selectedNetwork,
  onSelectNetwork,
}: HeaderProps) {
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState(false);
  
  const handleConnectWallet = () => {
    toast({
      description: "Please set VITE_REOWN_PROJECT_ID environment variable to enable wallet connection.",
      variant: "destructive",
    });
  };
  
  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };


  const ethereumNetworks = NETWORKS.filter((n) => n.category === "ethereum");
  const layer2Networks = NETWORKS.filter((n) => n.category === "layer2");
  const sidechainNetworks = NETWORKS.filter((n) => n.category === "sidechain");

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="mx-auto flex h-16 max-w-full items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <img 
            src={logoImage} 
            alt="EVM Deployer Logo" 
            className="h-10 w-10 rounded-lg"
          />
          <div className="hidden md:flex md:flex-col">
            <h1 className="text-lg font-semibold leading-tight">EVM Deployer</h1>
            <p className="text-xs text-muted-foreground">Smart Contract Deployment Platform</p>
          </div>
          <h1 className="text-lg font-semibold md:hidden">EVM Deployer</h1>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 min-h-9"
                data-testid="button-network-selector"
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedNetwork.color }}
                />
                <span className="hidden sm:inline">{selectedNetwork.name}</span>
                <span className="sm:hidden">{selectedNetwork.nativeCurrency.symbol}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Ethereum</DropdownMenuLabel>
              {ethereumNetworks.map((network) => (
                <DropdownMenuItem
                  key={network.id}
                  onClick={() => onSelectNetwork(network)}
                  data-testid={`network-${network.id}`}
                  className="gap-2"
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: network.color }}
                  />
                  <span>{network.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Layer 2</DropdownMenuLabel>
              {layer2Networks.map((network) => (
                <DropdownMenuItem
                  key={network.id}
                  onClick={() => onSelectNetwork(network)}
                  data-testid={`network-${network.id}`}
                  className="gap-2"
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: network.color }}
                  />
                  <span>{network.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sidechains</DropdownMenuLabel>
              {sidechainNetworks.map((network) => (
                <DropdownMenuItem
                  key={network.id}
                  onClick={() => onSelectNetwork(network)}
                  data-testid={`network-${network.id}`}
                  className="gap-2"
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: network.color }}
                  />
                  <span>{network.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />

          {hasReownProjectId ? (
            <appkit-button data-testid="button-connect-wallet" />
          ) : (
            <Button
              variant="outline"
              onClick={handleConnectWallet}
              data-testid="button-connect-wallet"
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
