import type { WorkspaceFile } from "@shared/schema";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface FileTabsProps {
  openFiles: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileClose: (file: WorkspaceFile) => void;
}

export function FileTabs({ 
  openFiles, 
  activeFile, 
  onFileSelect, 
  onFileClose 
}: FileTabsProps) {
  if (openFiles.length === 0) {
    return null;
  }

  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  return (
    <ScrollArea className="w-full border-b bg-card">
      <div className="flex items-center gap-1 px-2 py-1">
        {openFiles.map((file) => {
          const isActive = activeFile?.id === file.id;
          return (
            <div
              key={file.id}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-t-md border-b-2 transition-colors
                ${isActive 
                  ? 'bg-background border-primary text-foreground' 
                  : 'bg-card border-transparent text-muted-foreground hover-elevate'
                }
              `}
              data-testid={`file-tab-${file.id}`}
            >
              <button
                onClick={() => onFileSelect(file)}
                className="text-sm font-medium flex-1 text-left"
                data-testid={`button-select-tab-${file.id}`}
              >
                {getFileName(file.path)}
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 p-0 hover:bg-destructive/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileClose(file);
                }}
                data-testid={`button-close-tab-${file.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
