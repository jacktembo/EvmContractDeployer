import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Deployment } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExternalLink, Trash2, Edit2, Check, X, FileCode, Play, ShieldCheck, AlertCircle, Clock, History, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { NETWORKS } from "@shared/schema";
import { ContractInteraction } from "./ContractInteraction";
import { WorkspaceSelector } from "./WorkspaceSelector";
import { VersionHistory } from "./VersionHistory";

interface DeploymentHistoryProps {
  walletAddress?: string;
  selectedWorkspace?: number | null;
  onWorkspaceChange?: (workspaceId: number | null) => void;
  currentSourceCode?: string;
  currentSolcVersion?: string;
  onRestoreVersion?: (sourceCode: string) => void;
}

export function DeploymentHistory({ 
  walletAddress, 
  selectedWorkspace, 
  onWorkspaceChange, 
  currentSourceCode,
  currentSolcVersion,
  onRestoreVersion 
}: DeploymentHistoryProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedNotes, setEditedNotes] = useState("");
  const [interactingDeployment, setInteractingDeployment] = useState<Deployment | null>(null);
  const [versionHistoryDeployment, setVersionHistoryDeployment] = useState<Deployment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNetwork, setFilterNetwork] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [showAssociateDialog, setShowAssociateDialog] = useState(false);
  const { toast } = useToast();

  const { data: deployments, isLoading } = useQuery<Deployment[]>({
    queryKey: selectedWorkspace 
      ? ["/api/workspaces", selectedWorkspace, "deployments"]
      : ["/api/deployments"],
    enabled: !!walletAddress,
  });

  // Query all deployments (not filtered by workspace) to compute unassociated count
  const { data: allDeployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
    enabled: !!walletAddress && !!selectedWorkspace,
  });

  // Compute unassociated count
  const workspaceDeploymentIds = new Set((deployments || []).map(d => d.id));
  const unassociatedDeployments = allDeployments.filter(d => !workspaceDeploymentIds.has(d.id));
  const unassociatedCount = unassociatedDeployments.length;

  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/deployments/${id}/notes`, { 
        notes,
        // walletAddress is now verified from session on backend
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update notes");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/deployments/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete deployment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/deployments/${id}/verify`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to verify contract");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      if (data.success) {
        toast({
          title: "Verification Submitted",
          description: data.message || "Contract verification submitted to block explorer",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: data.message,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: error.message,
      });
    },
  });

  const associateAllMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkspace) {
        throw new Error("No workspace selected");
      }
      const response = await apiRequest("POST", `/api/workspaces/${selectedWorkspace}/associate-all-deployments`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to associate deployments");
      }
      return response.json();
    },
    onSuccess: (data: { success: boolean; associated: number; skipped: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      if (selectedWorkspace) {
        queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspace, "deployments"] });
      }
      setShowAssociateDialog(false);
      
      if (data.associated === 0) {
        toast({
          title: "All Set",
          description: "All your deployments are already associated with this workspace.",
        });
      } else {
        toast({
          title: "Deployments Associated",
          description: `Successfully associated ${data.associated} deployment${data.associated !== 1 ? 's' : ''} with this workspace${data.skipped > 0 ? ` (${data.skipped} already linked)` : ''}.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Association Failed",
        description: error.message,
      });
    },
  });

  const checkVerificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/deployments/${id}/check-verification`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to check verification status");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      if (data.success) {
        toast({
          title: "Verification Complete",
          description: "Contract verified successfully on block explorer",
        });
      } else if (data.status === 'pending') {
        toast({
          title: "Still Pending",
          description: "Verification is still being processed by the block explorer",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: data.message,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Status Check Error",
        description: error.message,
      });
    },
  });

  const handleEdit = (deployment: Deployment) => {
    setEditingId(deployment.id);
    setEditedNotes(deployment.notes || "");
  };

  const handleSave = (id: number) => {
    updateNotesMutation.mutate({ id, notes: editedNotes });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditedNotes("");
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this deployment record?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleVerify = (id: number) => {
    verifyMutation.mutate(id);
  };

  const handleCheckStatus = (id: number) => {
    checkVerificationMutation.mutate(id);
  };

  const getNetworkInfo = (networkId: string) => {
    return NETWORKS.find(n => n.id === networkId);
  };

  const filteredDeployments = deployments?.filter((deployment) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = deployment.contractName.toLowerCase().includes(query);
      const matchesAddress = deployment.contractAddress.toLowerCase().includes(query);
      if (!matchesName && !matchesAddress) return false;
    }

    if (filterNetwork && deployment.network !== filterNetwork) {
      return false;
    }

    if (filterStatus) {
      if (filterStatus === 'verified' && !deployment.verified) return false;
      if (filterStatus === 'pending' && deployment.verificationStatus !== 'pending') return false;
      if (filterStatus === 'unverified' && (deployment.verified || deployment.verificationStatus === 'pending')) return false;
    }

    if (filterDateRange.start || filterDateRange.end) {
      const deploymentDate = new Date(deployment.deployedAt);
      if (filterDateRange.start) {
        const startOfDay = new Date(filterDateRange.start);
        startOfDay.setHours(0, 0, 0, 0);
        if (deploymentDate < startOfDay) return false;
      }
      if (filterDateRange.end) {
        const endOfDay = new Date(filterDateRange.end);
        endOfDay.setHours(23, 59, 59, 999);
        if (deploymentDate > endOfDay) return false;
      }
    }

    return true;
  }) || [];

  const uniqueNetworks = Array.from(new Set(deployments?.map(d => d.network) || []));

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredDeployments, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `deployments-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast({
      title: "Export Complete",
      description: `Exported ${filteredDeployments.length} deployments to JSON`,
    });
  };

  const escapeCSVCell = (cell: any): string => {
    const str = String(cell);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportToCSV = () => {
    const headers = ['Contract Name', 'Address', 'Network', 'Chain ID', 'Deployed At', 'Verified', 'Notes'];
    const rows = filteredDeployments.map(d => [
      d.contractName,
      d.contractAddress,
      d.network,
      d.chainId,
      new Date(d.deployedAt).toLocaleString(),
      d.verified ? 'Yes' : 'No',
      d.notes || ''
    ]);
    const csvContent = [
      headers.map(escapeCSVCell).join(','),
      ...rows.map(row => row.map(escapeCSVCell).join(','))
    ].join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const exportFileDefaultName = `deployments-${new Date().toISOString().split('T')[0]}.csv`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast({
      title: "Export Complete",
      description: `Exported ${filteredDeployments.length} deployments to CSV`,
    });
  };

  if (!walletAddress) {
    return (
      <Card className="h-full" data-testid="card-deployment-history">
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
          <CardDescription>Connect your wallet to view deployment history</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="card-deployment-history">
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
          <CardDescription>Loading deployments...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col" data-testid="card-deployment-history">
      <CardHeader>
        <CardTitle>Deployment History</CardTitle>
        <CardDescription>
          {filteredDeployments.length} of {deployments?.length || 0} deployment{deployments?.length !== 1 ? 's' : ''}
        </CardDescription>
        {onWorkspaceChange && (
          <div className="mt-4">
            <WorkspaceSelector
              selectedWorkspace={selectedWorkspace || null}
              onWorkspaceChange={onWorkspaceChange}
            />
          </div>
        )}
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Search by contract name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-deployments"
          />
          <div className="flex gap-2 flex-wrap">
            <Select value={filterNetwork || "all"} onValueChange={(v) => setFilterNetwork(v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-network">
                <SelectValue placeholder="All Networks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                {uniqueNetworks.map((network) => (
                  <SelectItem key={network} value={network}>
                    {getNetworkInfo(network)?.name || network}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filterDateRange.start ? filterDateRange.start.toISOString().split('T')[0] : ''}
                onChange={(e) => setFilterDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : null }))}
                placeholder="Start date"
                data-testid="input-filter-date-start"
                className="w-[150px]"
              />
              <Input
                type="date"
                value={filterDateRange.end ? filterDateRange.end.toISOString().split('T')[0] : ''}
                onChange={(e) => setFilterDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : null }))}
                placeholder="End date"
                data-testid="input-filter-date-end"
                className="w-[150px]"
              />
            </div>
            <div className="flex gap-2 ml-auto">
              {selectedWorkspace && unassociatedCount > 0 && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setShowAssociateDialog(true)}
                  data-testid="button-associate-all"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Associate All ({unassociatedCount})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportToJSON} data-testid="button-export-json">
                Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV} data-testid="button-export-csv">
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {!deployments || deployments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-deployments">
              No deployments yet. Deploy a contract to see it here.
            </div>
          ) : filteredDeployments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-filtered-deployments">
              No deployments match your filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDeployments.map((deployment) => {
                const network = getNetworkInfo(deployment.network);
                const isEditing = editingId === deployment.id;

                return (
                  <Card key={deployment.id} data-testid={`card-deployment-${deployment.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileCode className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate" data-testid={`text-contract-name-${deployment.id}`}>
                              {deployment.contractName}
                            </span>
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {format(new Date(deployment.deployedAt), "MMM d, yyyy 'at' h:mm a")}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          {!isEditing && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(deployment)}
                              data-testid={`button-edit-${deployment.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(deployment.id)}
                            data-testid={`button-delete-${deployment.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Contract Address</div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate text-xs bg-muted px-2 py-1 rounded" data-testid={`text-address-${deployment.id}`}>
                            {deployment.contractAddress}
                          </code>
                          {network && (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              data-testid={`button-explorer-${deployment.id}`}
                            >
                              <a
                                href={`${network.blockExplorer}/address/${deployment.contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Network</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" data-testid={`badge-network-${deployment.id}`}>
                            {network?.name || deployment.network}
                          </Badge>
                          {deployment.verified && (
                            <Badge variant="default" data-testid={`badge-verified-${deployment.id}`}>
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {deployment.verificationStatus === 'pending' && (
                            <Badge variant="secondary" data-testid={`badge-pending-${deployment.id}`}>
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          {deployment.verificationStatus === 'failed' && (
                            <Badge variant="destructive" data-testid={`badge-failed-${deployment.id}`}>
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        {!deployment.verified && deployment.verificationStatus === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleCheckStatus(deployment.id)}
                            disabled={checkVerificationMutation.isPending}
                            data-testid={`button-check-status-${deployment.id}`}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {checkVerificationMutation.isPending ? "Checking..." : "Check Status"}
                          </Button>
                        )}
                        {!deployment.verified && deployment.verificationStatus !== 'pending' && network?.blockExplorerApiUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleVerify(deployment.id)}
                            disabled={verifyMutation.isPending}
                            data-testid={`button-verify-${deployment.id}`}
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            {verifyMutation.isPending ? "Submitting..." : "Verify Contract"}
                          </Button>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => setInteractingDeployment(deployment)}
                          data-testid={`button-interact-${deployment.id}`}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Interact
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setVersionHistoryDeployment(deployment)}
                          data-testid={`button-versions-${deployment.id}`}
                        >
                          <History className="w-3 h-3 mr-1" />
                          Versions
                        </Button>
                      </div>

                      <Separator />

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Notes</div>
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editedNotes}
                              onChange={(e) => setEditedNotes(e.target.value)}
                              placeholder="Add notes about this deployment..."
                              data-testid={`input-notes-${deployment.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave(deployment.id)}
                                disabled={updateNotesMutation.isPending}
                                data-testid={`button-save-notes-${deployment.id}`}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={updateNotesMutation.isPending}
                                data-testid={`button-cancel-notes-${deployment.id}`}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm" data-testid={`text-notes-${deployment.id}`}>
                            {deployment.notes || (
                              <span className="text-muted-foreground italic">No notes</span>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {interactingDeployment && (
        <ContractInteraction
          open={!!interactingDeployment}
          onOpenChange={(open) => !open && setInteractingDeployment(null)}
          deploymentId={interactingDeployment.id}
          contractAddress={interactingDeployment.contractAddress}
          contractName={interactingDeployment.contractName}
        />
      )}

      <VersionHistory
        open={!!versionHistoryDeployment}
        onOpenChange={(open) => !open && setVersionHistoryDeployment(null)}
        deploymentId={versionHistoryDeployment?.id || 0}
        currentSourceCode={currentSourceCode}
        currentSolcVersion={currentSolcVersion}
        onRestore={(sourceCode) => {
          if (onRestoreVersion) {
            onRestoreVersion(sourceCode);
            setVersionHistoryDeployment(null);
          }
        }}
      />

      <AlertDialog open={showAssociateDialog} onOpenChange={setShowAssociateDialog}>
        <AlertDialogContent data-testid="dialog-associate-all">
          <AlertDialogHeader>
            <AlertDialogTitle>Associate All Deployments</AlertDialogTitle>
            <AlertDialogDescription>
              You have {unassociatedCount} deployment{unassociatedCount !== 1 ? 's' : ''} not yet associated with this workspace.
              This will add all your existing deployments to the selected workspace. Deployments already in this workspace will be skipped automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-associate">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => associateAllMutation.mutate()}
              disabled={associateAllMutation.isPending}
              data-testid="button-confirm-associate"
            >
              {associateAllMutation.isPending ? "Associating..." : `Associate ${unassociatedCount} Deployment${unassociatedCount !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
