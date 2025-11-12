import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ContractTemplate } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, Sparkles, Search } from "lucide-react";

interface TemplateListProps {
  onSelectTemplate: (template: ContractTemplate) => void;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "Tokens", label: "Tokens" },
  { value: "NFT", label: "NFT" },
  { value: "DeFi", label: "DeFi" },
  { value: "Governance", label: "Gov" },
  { value: "Security", label: "Security" },
  { value: "Utilities", label: "Utils" },
];

export function TemplateList({ onSelectTemplate }: TemplateListProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: templates, isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const filteredTemplates = templates?.filter((t) => {
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    
    if (!searchQuery) return matchesCategory;
    
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      (t.tags as string[]).some((tag) => tag.toLowerCase().includes(query));
    
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <FileCode className="w-4 h-4" />
          Contract Templates
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Browse and use production-ready Solidity templates
        </p>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-7" data-testid="tabs-category">
          {CATEGORIES.map((cat) => (
            <TabsTrigger
              key={cat.value}
              value={cat.value}
              data-testid={`tab-${cat.value}`}
              className="text-xs px-2"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.value} value={cat.value} className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Loading templates...
                </div>
              ) : filteredTemplates && filteredTemplates.length > 0 ? (
                <div className="space-y-3 pr-3">
                  {filteredTemplates.map((template) => (
                    <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                      <CardHeader className="p-4 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium">
                            {template.name}
                            {template.featured && (
                              <Sparkles className="inline w-3 h-3 ml-1 text-primary" />
                            )}
                          </CardTitle>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {template.category}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs line-clamp-2">
                          {template.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-wrap gap-1">
                          {(template.tags as string[]).slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {(template.tags as string[]).length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(template.tags as string[]).length - 3}
                            </Badge>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          v{template.solcVersion}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => onSelectTemplate(template)}
                          data-testid={`button-use-${template.id}`}
                          className="h-7 text-xs"
                        >
                          Use Template
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No templates found
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
