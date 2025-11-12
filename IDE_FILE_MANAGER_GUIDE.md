# IDE-Like File Manager Implementation Guide

## Overview

This guide documents the backend foundation and provides a detailed implementation plan for creating an IDE-like file manager experience similar to VS Code or IntelliJ IDEA.

## ✅ Completed: Backend API Enhancements

### 1. Workspace Rename Endpoint

**Endpoint**: `PATCH /api/workspaces/:id/rename`

**Purpose**: Allow workspace owners to rename their workspaces inline without modals

**Request Body**:
```json
{
  "name": "New Workspace Name"
}
```

**Response**: `200 OK` with updated workspace object

**Security**:
- Requires wallet authentication
- Only workspace owner (createdBy) can rename
- Returns 403 if unauthorized, 404 if workspace not found

**Example Usage**:
```typescript
const response = await fetch(`/api/workspaces/${workspaceId}/rename`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'My New Workspace' })
});
const updatedWorkspace = await response.json();
```

---

### 2. Bulk File Upload Endpoint

**Endpoint**: `POST /api/workspaces/:id/files/bulk`

**Purpose**: Upload multiple files in a single request, supporting directory uploads and drag-and-drop

**Request Body**:
```json
{
  "files": [
    {
      "path": "contracts/MyToken.sol",
      "content": "// SPDX-License-Identifier: MIT...",
      "isDirectory": false
    },
    {
      "path": "contracts/utils",
      "content": "",
      "isDirectory": true
    },
    {
      "path": "contracts/utils/SafeMath.sol",
      "content": "// SPDX-License-Identifier: MIT...",
      "isDirectory": false
    }
  ]
}
```

**Response**: `200 OK` with detailed results
```json
{
  "success": true,
  "created": 3,
  "failed": 0,
  "files": [...],
  "errors": []
}
```

**Error Handling**:
- Partial success: Some files succeed while others fail
- Per-file error reporting in `errors` array
- Conflict detection: Skips existing files with error message
- Returns counts of successful and failed uploads

**Security**:
- Requires wallet authentication
- Only workspace members can upload files
- Validates each file path before creation

**Example Usage**:
```typescript
const filesToUpload = [
  { path: 'contracts/Token.sol', content: sourceCode, isDirectory: false },
  { path: 'test/', content: '', isDirectory: true },
];

const response = await fetch(`/api/workspaces/${workspaceId}/files/bulk`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ files: filesToUpload })
});

const result = await response.json();
console.log(`Created ${result.created} files, ${result.failed} failed`);
if (result.errors?.length > 0) {
  result.errors.forEach(err => {
    console.error(`Failed to upload ${err.path}: ${err.error}`);
  });
}
```

---

## 🚧 Pending: Frontend IDE-Like Features

Based on architect guidance, here's the implementation plan for the frontend:

### Architecture Overview

**Key Principles**:
1. **Keep Existing Structure**: Augment FileExplorer.tsx, don't rewrite from scratch
2. **Panel-Level State**: Track editing state at FileExplorerPanel level
3. **Focused Components**: Refactor into smaller, focused child components
4. **Keyboard-First**: Support F2, Enter, Escape, double-click
5. **react-dropzone**: Use for both upload button and drag-and-drop

### Component Refactoring Plan

#### 1. FileExplorer.tsx Enhancement

**Add Editing State**:
```typescript
interface EditingState {
  path: string | null;        // Which node is being edited
  mode: 'create' | 'rename';  // Type of edit operation
  draftName: string;          // Current input value
  isDirectory: boolean;       // Creating file or folder
  focusOnMount: boolean;      // Auto-focus flag
}
```

**Child Components to Create** (within FileExplorer.tsx):
- `InlineEditor`: Controlled input for inline editing
- `TreeNode`: Individual file/folder node with edit state
- `FileTree`: Renders tree structure recursively
- `UploadControls`: Upload button + drag-drop zone

#### 2. InlineEditor Component

**Features**:
```typescript
interface InlineEditorProps {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  validate?: (value: string) => string | null; // Returns error or null
  autoFocus?: boolean;
  selectAll?: boolean;
}
```

**Behavior**:
- Auto-focus on mount
- Select all text initially
- Enter key → validate & submit
- Escape key → cancel
- Blur → submit with validation (with guard to prevent double-submit)
- Show validation errors inline

#### 3. File Upload Integration

**Using react-dropzone**:
```typescript
import { useDropzone } from 'react-dropzone';

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop: handleFileDrop,
  noClick: true, // Prevent click on container
});

// Combine with hidden input for directory upload
<input 
  type="file" 
  webkitdirectory="" 
  directory="" 
  multiple 
  onChange={handleDirectoryUpload}
  style={{ display: 'none' }}
  ref={directoryInputRef}
/>
```

**Upload Flow**:
1. User drags files OR clicks "Upload" button
2. Read files using FileReader API
3. Build file array with paths and contents
4. Call bulk upload API
5. Handle partial success/failure
6. Prompt user for conflict resolution
7. Refresh file tree

#### 4. WorkspaceSelector Enhancement

**Add Inline Editing**:
- Double-click workspace name → inline rename
- Show delete icon on hover
- Confirmation dialog for delete
- Use new PATCH /api/workspaces/:id/rename endpoint

### UX Requirements

**Keyboard Shortcuts**:
- `F2`: Rename selected file/folder
- `Enter`: Submit inline edit
- `Escape`: Cancel inline edit
- `Delete`: Delete selected item (with confirmation)

**Visual Feedback**:
- Drag-over: Show blue outline/overlay on drop zone
- Uploading: Show progress indicator
- Errors: Show toast notifications for failures
- Conflicts: Highlight conflicting files

**Validation**:
- No empty names
- No duplicate names in same directory
- Valid file characters only
- Max path length check

### Implementation Steps

#### Step 1: Add Editing State to FileExplorer
```typescript
const [editingState, setEditingState] = useState<EditingState | null>(null);

const startEdit = (path: string, mode: 'create' | 'rename', isDirectory: boolean) => {
  setEditingState({
    path,
    mode,
    draftName: mode === 'rename' ? getFileName(path) : '',
    isDirectory,
    focusOnMount: true
  });
};

const cancelEdit = () => setEditingState(null);

const submitEdit = async (finalName: string) => {
  if (!editingState) return;
  
  // Validation
  const error = validateFileName(finalName);
  if (error) {
    toast.error(error);
    return;
  }
  
  // Call API
  if (editingState.mode === 'create') {
    await createFile(finalName, editingState.isDirectory);
  } else {
    await renameFile(editingState.path, finalName);
  }
  
  setEditingState(null);
};
```

#### Step 2: Create InlineEditor Component
```typescript
function InlineEditor({ 
  initialValue, 
  onSubmit, 
  onCancel, 
  validate,
  autoFocus = true,
  selectAll = true 
}: InlineEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      if (selectAll) {
        inputRef.current.select();
      }
    }
  }, [autoFocus, selectAll]);
  
  const handleSubmit = () => {
    if (validate) {
      const validationError = validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    onSubmit(value);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  
  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        className="w-full px-1 py-0 text-sm border rounded"
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
```

#### Step 3: Integrate react-dropzone for File Upload
```typescript
function FileUploadZone({ workspaceId, onUploadComplete }: Props) {
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  const handleFileUpload = async (files: File[]) => {
    setUploading(true);
    
    // Read all files
    const fileData = await Promise.all(
      files.map(async (file) => ({
        path: file.webkitRelativePath || file.name,
        content: await file.text(),
        isDirectory: false
      }))
    );
    
    // Call bulk upload API
    const response = await fetch(`/api/workspaces/${workspaceId}/files/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: fileData })
    });
    
    const result = await response.json();
    
    setUploading(false);
    
    // Show results
    if (result.created > 0) {
      toast.success(`Uploaded ${result.created} file(s)`);
    }
    
    if (result.errors?.length > 0) {
      result.errors.forEach(err => {
        toast.error(`${err.path}: ${err.error}`);
      });
    }
    
    onUploadComplete();
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    noClick: true
  });
  
  return (
    <div {...getRootProps()} className={isDragActive ? 'border-2 border-primary' : ''}>
      <input {...getInputProps()} />
      
      {/* Hidden directory input */}
      <input
        type="file"
        ref={directoryInputRef}
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          if (e.target.files) {
            handleFileUpload(Array.from(e.target.files));
          }
        }}
        style={{ display: 'none' }}
      />
      
      {/* Upload buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => directoryInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Files
        </Button>
      </div>
      
      {isDragActive && (
        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
          Drop files here
        </div>
      )}
    </div>
  );
}
```

#### Step 4: Update Context Menu Actions
```typescript
// Add to existing context menu
{
  label: 'Rename',
  onClick: () => startEdit(item.path, 'rename', item.isDirectory),
  shortcut: 'F2'
},
{
  label: 'Delete',
  onClick: () => confirmDelete(item),
  shortcut: 'Delete',
  variant: 'destructive'
}
```

#### Step 5: Add Keyboard Event Handlers
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedFile) return;
    
    if (e.key === 'F2') {
      e.preventDefault();
      startEdit(selectedFile.path, 'rename', selectedFile.isDirectory);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      confirmDelete(selectedFile);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedFile]);
```

### Testing Strategy (End-to-End with Playwright)

**Critical Flows to Test**:
1. **Inline Create**: Click "New File" → inline input appears → type name → Enter → file created
2. **Inline Rename**: Select file → F2 → change name → Enter → file renamed
3. **Keyboard Cancel**: Start inline edit → Escape → editing cancelled, no changes
4. **Validation**: Try creating file with empty name → error shown → retry with valid name
5. **Drag & Drop**: Drag files from desktop → drop zone highlights → files uploaded
6. **Bulk Upload**: Upload folder with multiple files → all files created → conflicts handled
7. **Workspace Rename**: Double-click workspace → inline rename → Enter → workspace renamed
8. **Conflict Resolution**: Upload file that exists → conflict dialog → choose overwrite/skip

**Test Plan Example**:
```
1. [New Context] Create a new browser context
2. [API] Create workspace with name "Test Workspace"
3. [Browser] Navigate to deploy page
4. [Browser] Select "Test Workspace" from workspace selector
5. [Browser] Click "New File" button
6. [Verify] Inline input appears with auto-focus
7. [Browser] Type "MyContract.sol"
8. [Browser] Press Enter
9. [Verify] File "MyContract.sol" appears in file tree
10. [Browser] Select "MyContract.sol"
11. [Browser] Press F2
12. [Verify] Inline rename input appears with current name selected
13. [Browser] Type "Token.sol"
14. [Browser] Press Enter
15. [Verify] File renamed to "Token.sol" in tree
16. [Browser] Press Escape during next edit
17. [Verify] Editing cancelled, no changes persisted
```

---

## Implementation Checklist

- [x] Backend: Workspace rename endpoint
- [x] Backend: Bulk file upload endpoint
- [x] Backend: Storage layer methods
- [ ] Frontend: Add editing state to FileExplorer
- [ ] Frontend: Create InlineEditor component
- [ ] Frontend: Integrate react-dropzone for uploads
- [ ] Frontend: Add keyboard shortcuts (F2, Delete, Escape, Enter)
- [ ] Frontend: Update context menu with shortcuts
- [ ] Frontend: Enhance WorkspaceSelector with inline editing
- [ ] Frontend: Add drag-and-drop visual feedback
- [ ] Frontend: Implement conflict resolution UI
- [ ] Testing: E2E tests for all inline editing flows
- [ ] Testing: E2E tests for file upload (drag & drop)
- [ ] Testing: E2E tests for workspace management
- [ ] Documentation: Update replit.md with new features

---

## API Reference Summary

### Workspace Management

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/workspaces` | List user's workspaces | Yes |
| POST | `/api/workspaces` | Create new workspace | Yes |
| GET | `/api/workspaces/:id` | Get workspace details | Yes (member) |
| PATCH | `/api/workspaces/:id/rename` | Rename workspace | Yes (owner) |
| DELETE | `/api/workspaces/:id` | Delete workspace | Yes (owner) |

### File Management

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/workspaces/:id/files` | List workspace files | Yes (member) |
| POST | `/api/workspaces/:id/files` | Create single file | Yes (member) |
| POST | `/api/workspaces/:id/files/bulk` | Upload multiple files | Yes (member) |
| PATCH | `/api/workspaces/:id/files/:fileId` | Update file content/path | Yes (member) |
| DELETE | `/api/workspaces/:id/files/:fileId` | Delete file | Yes (member) |

---

## Next Steps

1. **Implement Frontend Components**: Follow the step-by-step guide above
2. **Test Thoroughly**: Use the testing strategy to ensure quality
3. **Gather Feedback**: Test with real users to refine UX
4. **Iterate**: Add advanced features like multi-select, copy/paste, etc.

This foundation provides a solid base for creating a professional IDE-like file manager experience!
