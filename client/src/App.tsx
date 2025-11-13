import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WagmiProvider } from "wagmi";
import { config } from "./lib/reown-config";
import Deploy from "@/pages/Deploy";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Deploy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    console.log('[App] Wagmi config:', config);
    console.log('[App] Config chains:', config?.chains);
    console.log('[App] Config connectors:', config?.connectors);
  }, []);

  if (!config) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Configuration Error</h2>
        <p>Wagmi config not initialized. Check console for errors.</p>
      </div>
    );
  }

  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;