import { useState, useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Upload, FileCode, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkspaceFile } from "@shared/schema";
import { FileExplorer } from "./FileExplorer";
import { FileTabs } from "./FileTabs";
import { WorkspaceSelector } from "./WorkspaceSelector";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  solcVersion: string;
  onSolcVersionChange: (version: string) => void;
  onOpenTemplates?: () => void;
  workspaceId?: number | null;
  onWorkspaceChange?: (workspaceId: number) => void;
  showFileExplorer?: boolean;
}

const EXAMPLE_CONTRACTS = {
  simple: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    uint256 private value;

    event ValueChanged(uint256 newValue);

    function setValue(uint256 _value) public {
        value = _value;
        emit ValueChanged(_value);
    }

    function getValue() public view returns (uint256) {
        return value;
    }
}`,
  erc20: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply);
    }
}`,
  erc721: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
    }
}`,
};

// Categorized Solidity compiler versions
const SOLC_VERSIONS = {
  latest: ["0.8.30", "0.8.29", "0.8.28", "0.8.27", "0.8.26", "0.8.25"],
  stable: ["0.8.24", "0.8.23", "0.8.22", "0.8.21", "0.8.20", "0.8.19", "0.8.18", "0.8.17"],
  legacy: ["0.8.16", "0.8.15", "0.8.14", "0.8.13", "0.8.12", "0.8.11", "0.8.10", "0.8.9", "0.8.8", "0.8.7", "0.8.6", "0.8.5", "0.8.4", "0.8.3", "0.8.2", "0.8.1", "0.8.0", "0.7.6", "0.6.12"],
};

// Flattened version list for easy iteration
const ALL_VERSIONS = [...SOLC_VERSIONS.latest, ...SOLC_VERSIONS.stable, ...SOLC_VERSIONS.legacy];

// Auto-detect Solidity version from pragma statement
function detectVersionFromPragma(code: string): string | null {
  const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);
  if (!pragmaMatch) return null;

  const versionSpec = pragmaMatch[1].trim();
  
  // Handle exact version: pragma solidity 0.8.20;
  const exactMatch = versionSpec.match(/^(\d+\.\d+\.\d+)$/);
  if (exactMatch && ALL_VERSIONS.includes(exactMatch[1])) {
    return exactMatch[1];
  }

  // Handle caret version: pragma solidity ^0.8.20;
  const caretMatch = versionSpec.match(/^\^(\d+\.\d+)\.(\d+)$/);
  if (caretMatch) {
    const majorMinor = caretMatch[1];
    const patchVersion = parseInt(caretMatch[2]);
    // Caret allows updates that do not change the leftmost non-zero digit
    // For ^0.8.20, allow 0.8.20 to 0.8.x (but not 0.9.0)
    const matching = ALL_VERSIONS.filter(v => {
      if (!v.startsWith(majorMinor)) return false;
      const vPatch = parseInt(v.split('.')[2]);
      return vPatch >= patchVersion;
    });
    if (matching.length > 0) return matching[0];
  }

  // Handle version ranges: pragma solidity >=0.8.0 <0.9.0; or >0.8.0 <=0.8.20;
  // Parse lower bound with comparator
  const lowerMatch = versionSpec.match(/(>=?|>)(\d+\.\d+\.\d+)/);
  // Parse upper bound with comparator
  const upperMatch = versionSpec.match(/(<)(?!=)(\d+\.\d+\.\d+)/);
  const upperEqualMatch = versionSpec.match(/(<=)(\d+\.\d+\.\d+)/);

  if (lowerMatch) {
    const lowerOperator = lowerMatch[1];
    const lowerBound = lowerMatch[2];
    const lowerInclusive = lowerOperator === '>=';
    
    let upperBound: string | null = null;
    let upperInclusive = false;

    if (upperEqualMatch) {
      upperBound = upperEqualMatch[2];
      upperInclusive = true;
    } else if (upperMatch) {
      upperBound = upperMatch[2];
      upperInclusive = false;
    }

    // Filter versions within the range
    const matching = ALL_VERSIONS.filter(v => {
      // Check lower bound (strict or inclusive)
      const lowerComparison = compareVersions(v, lowerBound);
      if (lowerInclusive ? lowerComparison < 0 : lowerComparison <= 0) return false;
      
      // Check upper bound (strict or inclusive)
      if (upperBound) {
        const upperComparison = compareVersions(v, upperBound);
        if (upperInclusive ? upperComparison > 0 : upperComparison >= 0) return false;
      }
      
      return true;
    });
    
    if (matching.length > 0) return matching[0];
  }

  return null;
}

// Compare two semver versions (returns -1 if a < b, 0 if equal, 1 if a > b)
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (aParts[i] < bParts[i]) return -1;
    if (aParts[i] > bParts[i]) return 1;
  }
  
  return 0;
}

export function CodeEditor({
  code,
  onChange,
  solcVersion,
  onSolcVersionChange,
  onOpenTemplates,
  workspaceId,
  onWorkspaceChange,
  showFileExplorer = true,
}: CodeEditorProps) {
  const { toast } = useToast();
  const [charCount, setCharCount] = useState(code.length);
  const [openFiles, setOpenFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromPropRef = useRef(false);

  // Fetch workspace files
  const { data: allFiles = [], isLoading: isLoadingFiles } = useQuery<WorkspaceFile[]>({
    queryKey: ['/api/workspaces', workspaceId, 'files'],
    enabled: !!workspaceId,
  });

  // Create file mutation
  const createFileMutation = useMutation({
    mutationFn: async ({ path, content = '', isDirectory = false }: { path: string; content?: string; isDirectory?: boolean }) => {
      if (!workspaceId) {
        throw new Error('No workspace selected');
      }
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/files`, { path, content, isDirectory });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'files'] });
    },
  });

  // Update file mutation
  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, content, path }: { fileId: number; content?: string; path?: string }) => {
      if (!workspaceId) {
        throw new Error('No workspace selected');
      }
      return apiRequest('PATCH', `/api/workspaces/${workspaceId}/files/${fileId}`, { content, path });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'files'] });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      if (!workspaceId) {
        throw new Error('No workspace selected');
      }
      return apiRequest('DELETE', `/api/workspaces/${workspaceId}/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'files'] });
    },
  });

  // Auto-detect Solidity version from pragma when code changes
  useEffect(() => {
    const detectedVersion = detectVersionFromPragma(code);
    if (detectedVersion && detectedVersion !== solcVersion) {
      onSolcVersionChange(detectedVersion);
      toast({
        title: "Version auto-detected",
        description: `Switched to Solidity ${detectedVersion} based on pragma`,
      });
    }
  }, [code, solcVersion, onSolcVersionChange, toast]);

  // Bidirectional sync: When code prop changes from parent (e.g., template loaded), update active file
  useEffect(() => {
    if (activeFile && code !== activeFile.content && !isUpdatingFromPropRef.current) {
      isUpdatingFromPropRef.current = true;
      
      // Clear any pending auto-save
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Update active file content
      updateFileMutation.mutate(
        { fileId: activeFile.id, content: code },
        {
          onSettled: () => {
            isUpdatingFromPropRef.current = false;
          },
        }
      );
    }
  }, [code, activeFile]);

  // When active file changes, update parent code prop
  useEffect(() => {
    if (activeFile && activeFile.content !== code) {
      onChange(activeFile.content);
      setCharCount(activeFile.content.length);
    }
  }, [activeFile]);

  // Auto-save functionality with 500ms debouncing
  const scheduleAutoSave = useCallback((fileId: number, content: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (!isUpdatingFromPropRef.current) {
        updateFileMutation.mutate({ fileId, content });
      }
    }, 500);
  }, [updateFileMutation]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          onChange(content);
          setCharCount(content.length);
          toast({
            title: "File uploaded",
            description: `${file.name} loaded successfully`,
          });
        };
        reader.readAsText(file);
      }
    },
    [onChange, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/plain": [".sol"] },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  });

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || "";
    onChange(newValue);
    setCharCount(newValue.length);

    // Auto-save if we have an active file in workspace mode
    if (activeFile && workspaceId) {
      scheduleAutoSave(activeFile.id, newValue);
    }
  };

  const loadExample = (example: keyof typeof EXAMPLE_CONTRACTS) => {
    onChange(EXAMPLE_CONTRACTS[example]);
    setCharCount(EXAMPLE_CONTRACTS[example].length);
    toast({
      title: "Example loaded",
      description: "Example contract loaded successfully",
    });
  };

  // File management handlers
  const handleFileSelect = (file: WorkspaceFile) => {
    setActiveFile(file);
    
    // Add to open files if not already open
    if (!openFiles.find(f => f.id === file.id)) {
      setOpenFiles(prev => [...prev, file]);
    }
  };

  const handleFileCreate = async (path: string, isDirectory: boolean) => {
    try {
      const newFile = await createFileMutation.mutateAsync({ path, isDirectory, content: '' });
      
      // Auto-open .sol files
      if (!isDirectory && path.endsWith('.sol')) {
        handleFileSelect(newFile as WorkspaceFile);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create file",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFileDelete = async (file: WorkspaceFile) => {
    try {
      await deleteFileMutation.mutateAsync(file.id);
      
      // Remove from open files
      setOpenFiles(prev => prev.filter(f => f.id !== file.id));
      
      // If it was the active file, switch to another open file or null
      if (activeFile?.id === file.id) {
        const remaining = openFiles.filter(f => f.id !== file.id);
        setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFileRename = async (file: WorkspaceFile, newPath: string) => {
    try {
      await updateFileMutation.mutateAsync({ fileId: file.id, path: newPath });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to rename file",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleTabClose = (file: WorkspaceFile) => {
    const newOpenFiles = openFiles.filter(f => f.id !== file.id);
    setOpenFiles(newOpenFiles);
    
    // If closing the active file, switch to the last remaining file or null
    if (activeFile?.id === file.id) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  return (
    <Card className="flex h-full flex-col rounded-none border-0 border-r">
      <CardHeader className="flex-row items-center gap-2 py-3 px-4 border-b">
        <div {...getRootProps()} className="flex flex-1 items-center gap-2">
          <input {...getInputProps()} />
          {!workspaceId && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => document.querySelector('input[type="file"]')?.dispatchEvent(new MouseEvent('click'))}
                data-testid="button-upload"
              >
                <Upload className="h-4 w-4" />
                Upload .sol
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2" data-testid="button-examples">
                    <FileCode className="h-4 w-4" />
                    Examples
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => loadExample("simple")} data-testid="example-simple">
                    Simple Storage
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample("erc20")} data-testid="example-erc20">
                    ERC20 Token
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample("erc721")} data-testid="example-erc721">
                    ERC721 NFT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {onOpenTemplates && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={onOpenTemplates}
                  data-testid="button-browse-templates"
                >
                  <FileCode className="h-4 w-4" />
                  Templates
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange("");
                  setCharCount(0);
                }}
                data-testid="button-clear"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {isDragActive && (
          <div className="text-sm text-muted-foreground">Drop file here...</div>
        )}
      </CardHeader>

      <CardContent className="p-0 flex gap-0 h-[600px]">
        {showFileExplorer && onWorkspaceChange && (
          <div className="w-64 flex flex-col" data-testid="file-explorer-container">
            <div className="p-3 border-b border-r">
              <WorkspaceSelector
                selectedWorkspace={workspaceId ?? null}
                onWorkspaceChange={(id) => id !== null && onWorkspaceChange(id)}
              />
            </div>
            <FileExplorer
              files={allFiles}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              onFileRename={handleFileRename}
            />
          </div>
        )}
        
        <div className="flex-1 flex flex-col">
          {workspaceId && openFiles.length > 0 && (
            <div data-testid="file-tabs">
              <FileTabs
                openFiles={openFiles}
                activeFile={activeFile}
                onFileSelect={handleFileSelect}
                onFileClose={handleTabClose}
              />
            </div>
          )}
          
          <div className="flex-1" data-testid="editor-monaco">
            <Editor
              height="100%"
              defaultLanguage="sol"
              value={code}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
              }}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between py-2 px-4 border-t text-xs text-muted-foreground">
        <span data-testid="text-char-count">{charCount} characters</span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Solidity:</span>
          <Select value={solcVersion} onValueChange={onSolcVersionChange}>
            <SelectTrigger className="h-6 w-24 text-xs" data-testid="select-solc-version">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectGroup>
                <SelectLabel>Latest</SelectLabel>
                {SOLC_VERSIONS.latest.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Stable</SelectLabel>
                {SOLC_VERSIONS.stable.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Legacy</SelectLabel>
                {SOLC_VERSIONS.legacy.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardFooter>
    </Card>
  );
}
