import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ContractVersion } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { History, GitCompare, RotateCcw, X, Plus, FileCode, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DiffViewer } from "./DiffViewer";

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentId: number;
  currentSourceCode?: string;
  currentSolcVersion?: string;
  onRestore: (sourceCode: string) => void;
}

export function VersionHistory({ open, onOpenChange, deploymentId, currentSourceCode, currentSolcVersion, onRestore }: VersionHistoryProps) {
  const [selectedVersions, setSelectedVersions] = useState<[ContractVersion | null, ContractVersion | null]>([null, null]);
  const [showDiff, setShowDiff] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveNotes, setSaveNotes] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState<ContractVersion | null>(null);
  const { toast } = useToast();

  const { data: versions, isLoading, isError } = useQuery<ContractVersion[]>({
    queryKey: ["/api/deployments", deploymentId, "versions"],
    enabled: open && deploymentId > 0,
  });

  const saveVersionMutation = useMutation({
    mutationFn: async (data: { sourceCode: string; notes?: string; solcVersion?: string }) => {
      return apiRequest("POST", `/api/deployments/${deploymentId}/versions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments", deploymentId, "versions"] });
      toast({
        title: "Version Saved",
        description: "Your contract version has been saved successfully.",
      });
      setShowSaveDialog(false);
      setSaveNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save version. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCompare = (version: ContractVersion) => {
    if (!selectedVersions[0]) {
      setSelectedVersions([version, null]);
    } else if (!selectedVersions[1]) {
      setSelectedVersions([selectedVersions[0], version]);
      setShowDiff(true);
    } else {
      setSelectedVersions([version, null]);
    }
  };

  const handleRestore = (version: ContractVersion) => {
    setRestoreConfirm(version);
  };

  const confirmRestore = () => {
    if (restoreConfirm) {
      onRestore(restoreConfirm.sourceCode);
      toast({
        title: "Version Restored",
        description: `Contract source restored to version ${restoreConfirm.version}`,
      });
      setRestoreConfirm(null);
    }
  };

  const handleSaveVersion = () => {
    if (!currentSourceCode) {
      toast({
        title: "No Source Code",
        description: "Current editor source code is required to save a version.",
        variant: "destructive",
      });
      return;
    }
    
    saveVersionMutation.mutate({
      sourceCode: currentSourceCode,
      notes: saveNotes || undefined,
      solcVersion: currentSolcVersion,
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col" data-testid="sheet-version-history">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {showDiff && selectedVersions[0] && selectedVersions[1] ? "Compare Versions" : "Version History"}
              </SheetTitle>
              {showDiff && selectedVersions[0] && selectedVersions[1] ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDiff(false);
                    setSelectedVersions([null, null]);
                  }}
                  data-testid="button-back-to-list"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to List
                </Button>
              ) : currentSourceCode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  data-testid="button-save-version"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Save Version
                </Button>
              ) : null}
            </div>
            <SheetDescription>
              {showDiff && selectedVersions[0] && selectedVersions[1]
                ? `Comparing version ${selectedVersions[0].version} with version ${selectedVersions[1].version}`
                : "View, compare, and restore previous versions of this contract"
              }
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden mt-4">
          {showDiff && selectedVersions[0] && selectedVersions[1] ? (
            <div className="h-full">
              <DiffViewer
                original={selectedVersions[0].sourceCode}
                modified={selectedVersions[1].sourceCode}
                originalLabel={`Version ${selectedVersions[0].version} (${format(new Date(selectedVersions[0].createdAt), "MMM d, yyyy HH:mm")})`}
                modifiedLabel={`Version ${selectedVersions[1].version} (${format(new Date(selectedVersions[1].createdAt), "MMM d, yyyy HH:mm")})`}
                onClose={() => {
                  setShowDiff(false);
                  setSelectedVersions([null, null]);
                }}
              />
            </div>
          ) : (
            <ScrollArea className="h-full px-6 pb-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading versions...
                </div>
              ) : isError ? (
                <div className="text-center py-8 text-destructive" data-testid="text-error-versions">
                  Failed to load versions. Please try again.
                </div>
              ) : !versions || versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-versions">
                  No versions yet. Save your first version to track changes over time.
                </div>
              ) : (
                <div className="space-y-3">
                {selectedVersions[0] && !selectedVersions[1] && (
                  <div className="p-3 bg-primary/10 rounded-md text-sm">
                    Version {selectedVersions[0].version} selected. Select another version to compare.
                  </div>
                )}
                {versions.map((version, index) => {
                  const isSelected = selectedVersions.some(v => v?.id === version.id);
                  const isLatest = index === 0;

                  return (
                    <Card
                      key={version.id}
                      className={`p-4 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      data-testid={`card-version-${version.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <FileCode className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">Version {version.version}</span>
                            {isLatest && (
                              <Badge variant="default" data-testid={`badge-latest-${version.id}`}>
                                Latest
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {format(new Date(version.createdAt), "MMM d, yyyy 'at' HH:mm")}
                          </div>
                          {version.notes && (
                            <p className="text-sm text-foreground mt-2" data-testid={`text-notes-${version.id}`}>
                              {version.notes}
                            </p>
                          )}
                          {version.solcVersion && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Solidity {version.solcVersion}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompare(version)}
                            disabled={selectedVersions.filter(Boolean).length === 2}
                            data-testid={`button-compare-${version.id}`}
                          >
                            <GitCompare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(version)}
                            data-testid={`button-restore-${version.id}`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                </div>
              )}
            </ScrollArea>
          )}
          </div>
      </SheetContent>
    </Sheet>

      {/* Save Version Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid="dialog-save-version">
          <DialogHeader>
            <DialogTitle>Save New Version</DialogTitle>
            <DialogDescription>
              Save the current contract source code as a new version. Add optional notes to describe the changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="version-notes">Version Notes (Optional)</Label>
              <Textarea
                id="version-notes"
                placeholder="Describe what changed in this version..."
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                className="mt-2"
                data-testid="textarea-version-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveVersion}
              disabled={saveVersionMutation.isPending}
              data-testid="button-confirm-save-version"
            >
              {saveVersionMutation.isPending ? "Saving..." : "Save Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
        <DialogContent data-testid="dialog-restore-version">
          <DialogHeader>
            <DialogTitle>Restore Version {restoreConfirm?.version}?</DialogTitle>
            <DialogDescription>
              This will replace your current contract source code with the code from version {restoreConfirm?.version}.
              Your current code will not be lost - you can save it as a new version first if needed.
            </DialogDescription>
          </DialogHeader>
          {restoreConfirm?.notes && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Version Notes:</p>
              <p className="text-sm text-muted-foreground mt-1">{restoreConfirm.notes}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRestore} data-testid="button-confirm-restore-version">
              Restore Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
