import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Pencil, Trash2, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";

type Workspace = {
  id: number;
  name: string;
  createdBy: string;
  members: any[];
  deployments: number[];
  createdAt: string;
};

type WorkspaceSelectorProps = {
  selectedWorkspace: number | null;
  onWorkspaceChange: (workspaceId: number | null) => void;
};

export function WorkspaceSelector({ selectedWorkspace, onWorkspaceChange }: WorkspaceSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<number | null>(null);
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { address } = useAccount();

  const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/workspaces", { name });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create workspace");
      }
      return response.json();
    },
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setIsCreateOpen(false);
      setNewWorkspaceName("");
      onWorkspaceChange(newWorkspace.id);
      toast({
        title: "Workspace Created",
        description: `${newWorkspace.name} has been created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message,
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest("PATCH", `/api/workspaces/${id}`, { name });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to rename workspace");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setEditingWorkspaceId(null);
      toast({
        title: "Workspace Renamed",
        description: "The workspace has been renamed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Rename Failed",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/workspaces/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete workspace");
      }
      return response.json();
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      if (selectedWorkspace === deletedId) {
        onWorkspaceChange(null);
      }
      setDeleteWorkspaceId(null);
      toast({
        title: "Workspace Deleted",
        description: "The workspace has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message,
      });
    },
  });

  const handleCreate = () => {
    if (newWorkspaceName.trim()) {
      createMutation.mutate(newWorkspaceName.trim());
    }
  };

  const startRename = (workspace: Workspace) => {
    setEditingWorkspaceId(workspace.id);
    setEditingName(workspace.name);
  };

  const cancelRename = () => {
    setEditingWorkspaceId(null);
    setEditingName("");
  };

  const submitRename = () => {
    if (editingWorkspaceId && editingName.trim()) {
      renameMutation.mutate({ id: editingWorkspaceId, name: editingName.trim() });
    } else {
      cancelRename();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  const confirmDelete = (workspace: Workspace) => {
    setDeleteWorkspaceId(workspace.id);
  };

  const handleDelete = () => {
    if (deleteWorkspaceId) {
      deleteMutation.mutate(deleteWorkspaceId);
    }
  };

  const isOwner = (workspace: Workspace) => {
    return address && workspace.createdBy.toLowerCase() === address.toLowerCase();
  };

  // Auto-focus edit input
  useEffect(() => {
    if (editingWorkspaceId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWorkspaceId]);

  const workspaceToDelete = workspaces.find(w => w.id === deleteWorkspaceId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectedWorkspace?.toString() || "all"}
            onValueChange={(value) => onWorkspaceChange(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger data-testid="select-workspace" className="w-full">
              <SelectValue placeholder="All Deployments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Deployments</SelectItem>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3" />
                    {workspace.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" data-testid="button-create-workspace">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-workspace">
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>
                Create a collaborative workspace to share contracts with your team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  data-testid="input-workspace-name"
                  placeholder="My Team Workspace"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newWorkspaceName.trim()) {
                      handleCreate();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newWorkspaceName.trim() || createMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workspace Management List */}
      {workspaces.length > 0 && (
        <div className="space-y-1 pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground px-2 py-1">
            Manage Workspaces
          </div>
          <div className="space-y-0.5">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate transition-colors"
                onMouseEnter={() => setHoveredWorkspaceId(workspace.id)}
                onMouseLeave={() => setHoveredWorkspaceId(null)}
                data-testid={`workspace-item-${workspace.id}`}
              >
                <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                
                {editingWorkspaceId === workspace.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      ref={editInputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      className="h-6 text-sm px-2"
                      data-testid={`input-rename-workspace-${workspace.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 flex-shrink-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        submitRename();
                      }}
                      data-testid={`button-confirm-rename-${workspace.id}`}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 flex-shrink-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        cancelRename();
                      }}
                      data-testid={`button-cancel-rename-${workspace.id}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate">{workspace.name}</span>
                    {isOwner(workspace) && (hoveredWorkspaceId === workspace.id || selectedWorkspace === workspace.id) && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => startRename(workspace)}
                          data-testid={`button-rename-workspace-${workspace.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => confirmDelete(workspace)}
                          data-testid={`button-delete-workspace-${workspace.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteWorkspaceId !== null} onOpenChange={(open) => !open && setDeleteWorkspaceId(null)}>
        <AlertDialogContent data-testid="dialog-delete-workspace">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{workspaceToDelete?.name}"? This action cannot be undone.
              All files in this workspace will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
