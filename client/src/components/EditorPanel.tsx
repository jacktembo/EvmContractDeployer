import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { FileTabs } from "./FileTabs";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileCode2 } from "lucide-react";
import type { WorkspaceFile } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EditorPanelProps {
  code: string;
  onCodeChange: (code: string) => void;
  solcVersion: string;
  onSolcVersionChange: (version: string) => void;
  activeFile: WorkspaceFile | null;
  openFiles: WorkspaceFile[];
  onTabClose: (file: WorkspaceFile) => void;
  onFileSelect: (file: WorkspaceFile) => void;
  onOpenTemplates?: () => void;
  isLeftPanelCollapsed?: boolean;
}

const SOLIDITY_VERSIONS = [
  "0.8.30",
  "0.8.29",
  "0.8.28",
  "0.8.27",
  "0.8.26",
  "0.8.25",
  "0.8.24",
  "0.8.23",
  "0.8.22",
  "0.8.21",
  "0.8.20",
  "0.8.19",
  "0.8.18",
  "0.8.17",
];

export function EditorPanel({
  code,
  onCodeChange,
  solcVersion,
  onSolcVersionChange,
  activeFile,
  openFiles,
  onTabClose,
  onFileSelect,
  onOpenTemplates,
  isLeftPanelCollapsed = false,
}: EditorPanelProps) {
  const [charCount, setCharCount] = useState(code.length);

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || "";
    onCodeChange(newValue);
    setCharCount(newValue.length);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contract.sol";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onCodeChange(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <Card className="h-full flex flex-col rounded-none border-0" data-testid="editor-panel">
      <CardHeader className={`p-3 border-b gap-3 ${isLeftPanelCollapsed ? 'pl-14' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Code Editor</span>
            {activeFile && (
              <span className="text-xs text-muted-foreground">
                • {activeFile.path}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  data-testid="dropdown-solc-version"
                  className="font-mono text-xs"
                >
                  v{solcVersion}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
                {SOLIDITY_VERSIONS.map((version) => (
                  <DropdownMenuItem
                    key={version}
                    onClick={() => onSolcVersionChange(version)}
                    data-testid={`menu-item-version-${version}`}
                  >
                    <span className="font-mono text-xs">v{version}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownload} 
              data-testid="button-download"
            >
              <Download className="w-4 h-4" />
            </Button>
            <label htmlFor="file-upload">
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("file-upload")?.click()}
                data-testid="button-upload"
              >
                <Upload className="w-4 h-4" />
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".sol"
              className="hidden"
              onChange={handleUpload}
              data-testid="input-file-upload"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
        {openFiles.length > 0 && activeFile && (
          <div data-testid="file-tabs">
            <FileTabs
              openFiles={openFiles}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
              onFileClose={onTabClose}
            />
          </div>
        )}
        
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language="sol"
            value={code}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: "on",
              rulers: [80],
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 10 },
            }}
          />
        </div>
      </CardContent>

      <CardFooter className={`p-2 border-t text-xs text-muted-foreground justify-between gap-3 ${isLeftPanelCollapsed ? 'pl-14' : ''}`}>
        <div>{charCount} characters</div>
        {onOpenTemplates && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenTemplates}
            data-testid="button-open-templates"
            className="h-7 text-xs"
          >
            Browse Templates
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
