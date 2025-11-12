import { DiffEditor } from "@monaco-editor/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface DiffViewerProps {
  original: string;
  modified: string;
  originalLabel: string;
  modifiedLabel: string;
  onClose: () => void;
}

export function DiffViewer({ original, modified, originalLabel, modifiedLabel, onClose }: DiffViewerProps) {
  const { theme } = useTheme();
  const monacoTheme = theme === "dark" ? "vs-dark" : "light";

  return (
    <Card className="h-full flex flex-col" data-testid="card-diff-viewer">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Code Comparison</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          data-testid="button-close-diff-viewer"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <div className="flex items-center justify-between px-6 py-2 border-b">
          <div className="text-sm font-medium text-muted-foreground">{originalLabel}</div>
          <div className="text-sm font-medium text-muted-foreground">{modifiedLabel}</div>
        </div>
        <div className="flex-1">
          <DiffEditor
            original={original}
            modified={modified}
            language="sol"
            theme={monacoTheme}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: "on",
              renderSideBySide: true,
              renderWhitespace: "none",
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
