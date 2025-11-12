import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatUnits } from "ethers";

interface GasPriceChartProps {
  chainId: number;
  networkName: string;
}

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

interface GasHistoryRecord {
  id: number;
  chainId: number;
  network: string;
  timestamp: string;
  baseFee: string | null;
  priorityFee: string | null;
  slowPrice: string;
  standardPrice: string;
  fastPrice: string;
  blockNumber: number | null;
  source: string | null;
}

export function GasPriceChart({ chainId, networkName }: GasPriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/gas-prices", chainId, timeRange],
    queryFn: async () => {
      const now = new Date();
      const startTime = new Date(now);

      switch (timeRange) {
        case "1h":
          startTime.setHours(now.getHours() - 1);
          break;
        case "6h":
          startTime.setHours(now.getHours() - 6);
          break;
        case "24h":
          startTime.setHours(now.getHours() - 24);
          break;
        case "7d":
          startTime.setDate(now.getDate() - 7);
          break;
        case "30d":
          startTime.setDate(now.getDate() - 30);
          break;
      }

      const params = new URLSearchParams({
        includeHistory: "true",
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      });

      const response = await fetch(`/api/gas-prices/${chainId}?${params}`);
      if (!response.ok) throw new Error("Failed to fetch gas prices");
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gas Price History</CardTitle>
          <CardDescription>Unable to load gas price data</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gas Price History</CardTitle>
          <CardDescription>Loading gas price data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const history: GasHistoryRecord[] = data?.history || [];
  const latest = data?.latest;

  // Transform data for the chart (convert to Gwei)
  const chartData = history
    .map((record) => ({
      timestamp: new Date(record.timestamp).getTime(),
      timeLabel: new Date(record.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        month: 'short',
        day: 'numeric'
      }),
      slow: parseFloat(formatUnits(record.slowPrice, "gwei")),
      standard: parseFloat(formatUnits(record.standardPrice, "gwei")),
      fast: parseFloat(formatUnits(record.fastPrice, "gwei")),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Calculate trend
  const getTrend = () => {
    if (chartData.length < 2) return null;
    const first = chartData[0].standard;
    const last = chartData[chartData.length - 1].standard;
    const change = ((last - first) / first) * 100;
    
    if (Math.abs(change) < 1) return { direction: "stable", change: 0, icon: Minus };
    if (change > 0) return { direction: "up", change, icon: TrendingUp };
    return { direction: "down", change: Math.abs(change), icon: TrendingDown };
  };

  const trend = getTrend();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Gas Price History</CardTitle>
            <CardDescription>{networkName}</CardDescription>
          </div>
          <div className="flex gap-1">
            {(["1h", "6h", "24h", "7d", "30d"] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range)}
                data-testid={`button-timerange-${range}`}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
        {latest && (
          <div className="flex items-center gap-4 mt-4">
            <div>
              <div className="text-sm text-muted-foreground">Current (Standard)</div>
              <div className="text-2xl font-bold" data-testid="text-current-gas">
                {parseFloat(formatUnits(latest.standardPrice, "gwei")).toFixed(2)} Gwei
              </div>
            </div>
            {trend && (
              <div className={`flex items-center gap-1 text-sm ${
                trend.direction === "up" ? "text-red-500" : 
                trend.direction === "down" ? "text-green-500" : 
                "text-muted-foreground"
              }`}>
                <trend.icon className="w-4 h-4" />
                {trend.direction !== "stable" && (
                  <span>{trend.change.toFixed(1)}% ({timeRange})</span>
                )}
                {trend.direction === "stable" && <span>Stable</span>}
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No historical data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="timeLabel" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                label={{ value: 'Gwei', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="slow" 
                stroke="#10b981" 
                name="Slow" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="standard" 
                stroke="#3b82f6" 
                name="Standard" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="fast" 
                stroke="#ef4444" 
                name="Fast" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
