import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ContractTemplate } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, Sparkles, Search } from "lucide-react";

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: ContractTemplate) => void;
}

const CATEGORIES = [
  { value: "all", label: "All Templates" },
  { value: "Tokens", label: "Tokens" },
  { value: "NFT", label: "NFT" },
  { value: "DeFi", label: "DeFi" },
  { value: "Governance", label: "Governance" },
  { value: "Security", label: "Security" },
  { value: "Utilities", label: "Utilities" },
];

export default function TemplateGallery({ open, onOpenChange, onSelectTemplate }: TemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);

  const { data: templates, isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/templates"],
    enabled: open,
  });

  const filteredTemplates = templates?.filter((t) => {
    // Category filter
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    
    // Search filter (name, description, tags)
    if (!searchQuery) return matchesCategory;
    
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      (t.tags as string[]).some((tag) => tag.toLowerCase().includes(query));
    
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = (template: ContractTemplate) => {
    onSelectTemplate(template);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[80vh]" data-testid="dialog-template-gallery">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5" />
              Contract Templates
            </DialogTitle>
            <DialogDescription>
              Browse production-ready Solidity templates to kickstart your project
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search templates by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-templates"
            />
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${CATEGORIES.length}, 1fr)` }} data-testid="tabs-category">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  data-testid={`tab-${cat.value}`}
                >
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIES.map((cat) => (
              <TabsContent key={cat.value} value={cat.value} className="flex-1 min-h-0">
                <ScrollArea className="h-full pr-4">
                  {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Loading templates...
                    </div>
                  ) : filteredTemplates && filteredTemplates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                      {filteredTemplates.map((template) => (
                        <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                          <CardHeader className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-lg">
                                {template.name}
                                {template.featured && (
                                  <Sparkles className="inline w-4 h-4 ml-2 text-primary" />
                                )}
                              </CardTitle>
                              <Badge variant="outline" className="shrink-0">
                                {template.category}
                              </Badge>
                            </div>
                            <CardDescription className="text-sm">
                              {template.description}
                            </CardDescription>
                          </CardHeader>

                          <CardContent>
                            <div className="flex flex-wrap gap-1">
                              {(template.tags as string[]).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>

                          <CardFooter className="flex gap-2 justify-between">
                            <span className="text-xs text-muted-foreground">
                              Solidity {template.solcVersion}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewTemplate(template)}
                                data-testid={`button-preview-${template.id}`}
                              >
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUseTemplate(template)}
                                data-testid={`button-use-${template.id}`}
                              >
                                Use Template
                              </Button>
                            </div>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No templates found in this category
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-4xl h-[80vh]" data-testid="dialog-template-preview">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              {previewTemplate?.description} • Solidity {previewTemplate?.solcVersion}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 border rounded-md bg-[#1e1e1e]">
            <pre className="p-4 text-sm font-mono text-[#d4d4d4] leading-relaxed">
              <code>{previewTemplate?.sourceCode || ""}</code>
            </pre>
          </ScrollArea>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewTemplate(null)} data-testid="button-close-preview">
              Close
            </Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  handleUseTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }
              }}
              data-testid="button-use-from-preview"
            >
              Use This Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
