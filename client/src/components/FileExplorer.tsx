import { useState } from "react";
import type { WorkspaceFile } from "@shared/schema";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Trash2, Edit2, FileCode, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
  file?: WorkspaceFile;
}

interface FileExplorerProps {
  files: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileCreate: (path: string, isDirectory: boolean) => Promise<void>;
  onFileDelete: (file: WorkspaceFile) => Promise<void>;
  onFileRename: (file: WorkspaceFile, newPath: string) => Promise<void>;
}

function buildFileTree(files: WorkspaceFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const pathMap = new Map<string, FileTreeNode>();

  // Sort files by path
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    const parts = file.path.split('/').filter(Boolean);
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath += (currentPath ? '/' : '') + part;
      const isLast = i === parts.length - 1;

      let node = pathMap.get(currentPath);
      
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isDirectory: !isLast || file.isDirectory,
          children: !isLast || file.isDirectory ? [] : undefined,
          file: isLast ? file : undefined,
        };
        pathMap.set(currentPath, node);
        currentLevel.push(node);
      }

      if (node.children) {
        currentLevel = node.children;
      }
    }
  }

  return root;
}

function TreeNode({ 
  node, 
  level = 0, 
  activeFile,
  onSelect,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onRename,
}: { 
  node: FileTreeNode;
  level?: number;
  activeFile: WorkspaceFile | null;
  onSelect: (file: WorkspaceFile) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onDelete: (file: WorkspaceFile) => void;
  onRename: (file: WorkspaceFile) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isActive = activeFile?.id === node.file?.id;

  const handleClick = () => {
    if (!node.isDirectory && node.file) {
      onSelect(node.file);
    } else {
      setExpanded(!expanded);
    }
  };

  const IconComponent = node.isDirectory
    ? (expanded ? FolderOpen : Folder)
    : (node.name.endsWith('.sol') ? FileCode : File);

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover-elevate active-elevate-2 rounded-md ${
              isActive ? 'bg-accent text-accent-foreground' : ''
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={handleClick}
            data-testid={`file-tree-${node.isDirectory ? 'folder' : 'file'}-${node.path}`}
          >
            {node.isDirectory && (
              <div className="w-4 h-4 flex items-center justify-center">
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            )}
            {!node.isDirectory && <div className="w-4" />}
            <IconComponent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate flex-1">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.isDirectory && (
            <>
              <ContextMenuItem onClick={() => onCreateFile(node.path)} data-testid="context-menu-new-file">
                <Plus className="w-4 h-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreateFolder(node.path)} data-testid="context-menu-new-folder">
                <Plus className="w-4 h-4 mr-2" />
                New Folder
              </ContextMenuItem>
            </>
          )}
          {node.file && (
            <>
              <ContextMenuItem onClick={() => onRename(node.file!)} data-testid="context-menu-rename">
                <Edit2 className="w-4 h-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onDelete(node.file!)} data-testid="context-menu-delete" className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {node.isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              activeFile={activeFile}
              onSelect={onSelect}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({
  files,
  activeFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
}: FileExplorerProps) {
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createIsDirectory, setCreateIsDirectory] = useState(false);
  const [createParentPath, setCreateParentPath] = useState('');
  const [createName, setCreateName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameFile, setRenameFile] = useState<WorkspaceFile | null>(null);
  const [renameName, setRenameName] = useState('');

  const fileTree = buildFileTree(files);

  const handleCreateFile = (parentPath: string) => {
    setCreateParentPath(parentPath);
    setCreateIsDirectory(false);
    setCreateName('');
    setCreateDialogOpen(true);
  };

  const handleCreateFolder = (parentPath: string) => {
    setCreateParentPath(parentPath);
    setCreateIsDirectory(true);
    setCreateName('');
    setCreateDialogOpen(true);
  };

  const handleCreateConfirm = async () => {
    if (!createName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const newPath = createParentPath ? `${createParentPath}/${createName}` : createName;
    
    try {
      await onFileCreate(newPath, createIsDirectory);
      setCreateDialogOpen(false);
      setCreateName('');
      toast({
        title: "Success",
        description: `${createIsDirectory ? 'Folder' : 'File'} created successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to create ${createIsDirectory ? 'folder' : 'file'}`,
        variant: "destructive",
      });
    }
  };

  const handleRenameFile = (file: WorkspaceFile) => {
    setRenameFile(file);
    const fileName = file.path.split('/').pop() || '';
    setRenameName(fileName);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameFile || !renameName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const pathParts = renameFile.path.split('/');
    pathParts[pathParts.length - 1] = renameName;
    const newPath = pathParts.join('/');

    try {
      await onFileRename(renameFile, newPath);
      setRenameDialogOpen(false);
      toast({
        title: "Success",
        description: "Renamed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to rename",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (file: WorkspaceFile) => {
    if (confirm(`Are you sure you want to delete ${file.path}?`)) {
      try {
        await onFileDelete(file);
        toast({
          title: "Success",
          description: "Deleted successfully",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex items-center justify-between p-3 border-b border-r gap-2">
        <div className="flex items-center gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            data-testid="button-toggle-explorer"
            className="h-6 w-6"
          >
            <ChevronsUpDown className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </Button>
          <h3 className="text-sm font-semibold">Files</h3>
        </div>
        <div className="flex gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => handleCreateFile('')}
            data-testid="button-new-file"
          >
            <FileCode className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => handleCreateFolder('')}
            data-testid="button-new-folder"
          >
            <Folder className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-2">
          {fileTree.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No files yet. Create a new file to get started.
            </div>
          ) : (
            fileTree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                activeFile={activeFile}
                onSelect={onFileSelect}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onDelete={handleDelete}
                onRename={handleRenameFile}
              />
            ))
          )}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-file">
          <DialogHeader>
            <DialogTitle>Create {createIsDirectory ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              {createParentPath ? `in ${createParentPath}` : 'in root'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={createIsDirectory ? "folder-name" : "Contract.sol"}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateConfirm()}
                data-testid="input-file-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleCreateConfirm} data-testid="button-create">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent data-testid="dialog-rename-file">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>
              {renameFile?.path}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rename-name">New Name</Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
                data-testid="input-rename"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} data-testid="button-cancel-rename">
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm} data-testid="button-confirm-rename">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
