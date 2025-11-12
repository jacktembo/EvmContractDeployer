import { WorkspaceSelector } from "./WorkspaceSelector";
import { FileExplorer } from "./FileExplorer";
import type { WorkspaceFile } from "@shared/schema";

interface FileExplorerPanelProps {
  files: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  openFiles: WorkspaceFile[];
  selectedWorkspace: number | null;
  onWorkspaceChange: (workspaceId: number) => void;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileCreate: (path: string, isDirectory: boolean) => Promise<void>;
  onFileDelete: (file: WorkspaceFile) => Promise<void>;
  onFileRename: (file: WorkspaceFile, newPath: string) => Promise<void>;
}

export function FileExplorerPanel({
  files,
  activeFile,
  openFiles,
  selectedWorkspace,
  onWorkspaceChange,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
}: FileExplorerPanelProps) {
  return (
    <div className="flex h-full flex-col bg-card" data-testid="file-explorer-panel">
      <div className="p-3 border-b">
        <WorkspaceSelector
          selectedWorkspace={selectedWorkspace}
          onWorkspaceChange={(id) => id !== null && onWorkspaceChange(id)}
        />
      </div>
      <FileExplorer
        files={files}
        activeFile={activeFile}
        onFileSelect={onFileSelect}
        onFileCreate={onFileCreate}
        onFileDelete={onFileDelete}
        onFileRename={onFileRename}
      />
    </div>
  );
}
