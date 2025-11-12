import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import { NETWORKS } from "@shared/schema";
import { formatUnits } from "ethers";

interface NetworkGasData {
  chainId: number;
  network: string;
  latest: {
    standardPrice: string;
  } | null;
}

export function NetworkGasComparison({ selectedChainId }: { selectedChainId: number }) {
  // Fetch gas prices for all networks
  const { data, isLoading } = useQuery({
    queryKey: ["/api/gas-prices/all"],
    queryFn: async () => {
      const results = await Promise.all(
        NETWORKS.map(async (network) => {
          try {
            const response = await fetch(`/api/gas-prices/${network.chainId}`);
            if (!response.ok) return null;
            const data = await response.json();
            return { chainId: network.chainId, network: network.name, latest: data.latest };
          } catch {
            return null;
          }
        })
      );
      return results.filter((r): r is NetworkGasData => r !== null);
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Gas Prices</CardTitle>
          <CardDescription>Compare gas costs across networks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const gasPrices = data || [];
  
  // Calculate cheapest network (backend now filters out zero prices)
  const validPrices = gasPrices.filter((gp) => gp.latest?.standardPrice);
  const pricesInWei = validPrices.map((gp) => ({
    chainId: gp.chainId,
    weiPrice: BigInt(gp.latest!.standardPrice),
    gweiPrice: parseFloat(formatUnits(gp.latest!.standardPrice, "gwei"))
  }));
  
  const cheapestWei = pricesInWei.length > 0 
    ? pricesInWei.reduce((min, curr) => curr.weiPrice < min ? curr.weiPrice : min, pricesInWei[0].weiPrice)
    : null;

  const getCostComparison = (priceWei: string) => {
    if (!cheapestWei) return null;
    const priceNum = BigInt(priceWei);
    const diff = Number((priceNum - cheapestWei) * BigInt(10000) / cheapestWei) / 100;
    return diff;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Network Gas Prices
        </CardTitle>
        <CardDescription>Compare current gas costs across all networks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {NETWORKS.map((network) => {
            const gasData = gasPrices.find((gp) => gp.chainId === network.chainId);
            const priceWei = gasData?.latest?.standardPrice;
            const isSelected = network.chainId === selectedChainId;
            // Backend filters out zero prices, so we just check if it matches cheapestWei
            const isCheapest = priceWei && BigInt(priceWei) === cheapestWei;
            const costDiff = priceWei ? getCostComparison(priceWei) : null;

            return (
              <div
                key={network.id}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : ""
                } ${
                  isCheapest && !isSelected ? "border-green-600 dark:border-green-500 bg-green-600/10 dark:bg-green-500/10" : ""
                }`}
                data-testid={`gas-price-${network.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded"
                    style={{ backgroundColor: `${network.color}20` }}
                  >
                    <div 
                      className="h-4 w-4 rounded-full" 
                      style={{ backgroundColor: network.color }}
                    />
                  </div>
                  <div>
                    <div className="font-medium">{network.name}</div>
                    {network.isTestnet && (
                      <Badge variant="outline" className="mt-1 text-xs">Testnet</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {priceWei ? (
                    <>
                      <div className="font-semibold">
                        {parseFloat(formatUnits(priceWei, "gwei")).toFixed(2)} Gwei
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {isCheapest && (
                          <Badge variant="default" className="text-xs">Cheapest</Badge>
                        )}
                        {!isCheapest && costDiff !== null && (
                          <span className="flex items-center gap-1">
                            {costDiff > 0 ? (
                              <>
                                <TrendingUp className="h-3 w-3 text-red-500" />
                                <span className="text-red-500">+{costDiff.toFixed(0)}%</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-3 w-3 text-green-500" />
                                <span className="text-green-500">{costDiff.toFixed(0)}%</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
