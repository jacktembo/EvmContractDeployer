import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Code2, Send, Eye } from "lucide-react";
import { ethers } from "ethers";
import { useToast } from "@/hooks/use-toast";

interface ContractInteractionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentId: number;
  contractAddress: string;
  contractName: string;
}

interface AbiFunction {
  type: "function";
  name: string;
  inputs: Array<{
    name: string;
    type: string;
    internalType?: string;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
  }>;
  stateMutability: "pure" | "view" | "nonpayable" | "payable";
}

interface CategorizedAbi {
  contractName: string;
  contractAddress: string;
  network: string;
  readFunctions: AbiFunction[];
  writeFunctions: AbiFunction[];
  events: any[];
}

export function ContractInteraction({
  open,
  onOpenChange,
  deploymentId,
  contractAddress,
  contractName,
}: ContractInteractionProps) {
  const { toast } = useToast();
  const [selectedFunction, setSelectedFunction] = useState<AbiFunction | null>(null);
  const [functionInputs, setFunctionInputs] = useState<Record<string, string>>({});
  const [functionResult, setFunctionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [ethValue, setEthValue] = useState("");

  const { data: abiData, isLoading } = useQuery<CategorizedAbi>({
    queryKey: [`/api/contracts/${deploymentId}/abi`],
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSelectedFunction(null);
      setFunctionInputs({});
      setFunctionResult(null);
      setEthValue("");
    }
  }, [open]);

  const handleFunctionSelect = (func: AbiFunction) => {
    setSelectedFunction(func);
    setFunctionInputs({});
    setFunctionResult(null);
    setEthValue("");
  };

  // Format result values, handling BigInt and ethers Result objects
  const formatResultValue = (value: any): any => {
    if (value === null || value === undefined) return value;
    
    // Handle BigInt
    if (typeof value === "bigint") {
      return value.toString();
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(formatResultValue);
    }
    
    // Handle ethers.js Result objects (which are array-like with named properties)
    if (value && typeof value === "object" && value.constructor && value.constructor.name === "Result") {
      const formatted: any = {};
      Object.keys(value).forEach(key => {
        // Skip numeric keys (array indices) to avoid duplication
        if (!isNaN(Number(key))) return;
        formatted[key] = formatResultValue(value[key]);
      });
      // If there are named properties, return the object, otherwise return the array
      if (Object.keys(formatted).length > 0) {
        return formatted;
      }
      return value.map(formatResultValue);
    }
    
    // Handle plain objects
    if (value && typeof value === "object") {
      const formatted: any = {};
      Object.keys(value).forEach(key => {
        formatted[key] = formatResultValue(value[key]);
      });
      return formatted;
    }
    
    return value;
  };

  const handleInputChange = (paramKey: string, value: string) => {
    setFunctionInputs(prev => ({ ...prev, [paramKey]: value }));
  };

  const getParamKey = (input: any, index: number) => {
    return input.name || `param${index}`;
  };

  const parseInputValue = (value: string, type: string): any => {
    value = value.trim();
    
    if (!value) return undefined;
    
    // Check for complex nested types first (require JSON input)
    const isNested = (type.match(/\[/g) || []).length > 1; // Multiple brackets = nested
    const isTupleArray = type.startsWith("tuple[") || type === "tuple[]";
    
    if (isNested || isTupleArray) {
      // For nested arrays or tuple arrays, require JSON format
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new Error(`Invalid JSON for ${type}. Expected format: [[1,2],[3,4]] or similar nested structure`);
      }
    }
    
    // Handle tuples/structs (expect JSON input)
    if (type === "tuple" || type.startsWith("tuple")) {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new Error(`Invalid JSON for tuple. Expected format: [value1, value2, ...]`);
      }
    }
    
    // Handle dynamic arrays (e.g., uint256[], address[]) - single-level only
    if (type.endsWith("[]")) {
      const baseType = type.slice(0, -2);
      return value.split(",").map(v => parseInputValue(v.trim(), baseType));
    }
    
    // Handle fixed-length arrays (e.g., uint256[3], address[2]) - single-level only
    const fixedArrayMatch = type.match(/^(.+)\[(\d+)\]$/);
    if (fixedArrayMatch) {
      const baseType = fixedArrayMatch[1];
      const expectedLength = parseInt(fixedArrayMatch[2]);
      const values = value.split(",").map(v => parseInputValue(v.trim(), baseType));
      if (values.length !== expectedLength) {
        throw new Error(`Expected ${expectedLength} values for ${type}, got ${values.length}`);
      }
      return values;
    }
    
    // Handle boolean
    if (type === "bool") {
      return value.toLowerCase() === "true" || value === "1";
    }
    
    // Handle integers (uint/int of any size)
    if (type.startsWith("uint") || type.startsWith("int")) {
      return value;
    }
    
    // Handle address
    if (type === "address") {
      return value;
    }
    
    // Handle bytes (bytes1-bytes32, bytes)
    if (type.startsWith("bytes")) {
      return value;
    }
    
    // Default: return as string
    return value;
  };

  const executeReadFunction = async () => {
    if (!selectedFunction) return;

    setIsExecuting(true);
    setFunctionResult(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        contractAddress,
        [selectedFunction],
        provider
      );

      const args = selectedFunction.inputs.map((input, index) => {
        const paramKey = getParamKey(input, index);
        const value = functionInputs[paramKey] || "";
        return parseInputValue(value, input.type);
      }).filter(arg => arg !== undefined);

      const result = await contract[selectedFunction.name](...args);
      const formattedResult = formatResultValue(result);
      setFunctionResult(formattedResult);

      toast({
        title: "Function executed",
        description: `${selectedFunction.name}() returned successfully`,
      });
    } catch (error: any) {
      console.error("Error executing read function:", error);
      toast({
        variant: "destructive",
        title: "Execution failed",
        description: error.message || "Failed to execute function",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const executeWriteFunction = async () => {
    if (!selectedFunction) return;

    setIsExecuting(true);
    setFunctionResult(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        [selectedFunction],
        signer
      );

      const args = selectedFunction.inputs.map((input, index) => {
        const paramKey = getParamKey(input, index);
        const value = functionInputs[paramKey] || "";
        return parseInputValue(value, input.type);
      }).filter(arg => arg !== undefined);

      const options: any = {};
      if (selectedFunction.stateMutability === "payable" && ethValue) {
        options.value = ethers.parseEther(ethValue);
      }

      const tx = await contract[selectedFunction.name](...args, options);
      
      toast({
        title: "Transaction sent",
        description: "Waiting for confirmation...",
      });

      const receipt = await tx.wait();
      
      setFunctionResult({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? "Success" : "Failed",
      });

      toast({
        title: "Transaction confirmed",
        description: `${selectedFunction.name}() executed successfully`,
      });
    } catch (error: any) {
      console.error("Error executing write function:", error);
      toast({
        variant: "destructive",
        title: "Transaction failed",
        description: error.message || "Failed to execute transaction",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const renderFunctionList = (functions: AbiFunction[], isReadOnly: boolean) => {
    if (functions.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No {isReadOnly ? "read" : "write"} functions available
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {functions.map((func, index) => (
          <Button
            key={index}
            variant={selectedFunction?.name === func.name ? "default" : "outline"}
            className="w-full justify-start"
            onClick={() => handleFunctionSelect(func)}
            data-testid={`button-function-${func.name}`}
          >
            <Code2 className="w-4 h-4 mr-2" />
            <span className="font-mono text-sm">{func.name}</span>
            {func.stateMutability === "payable" && (
              <Badge variant="secondary" className="ml-auto">
                payable
              </Badge>
            )}
          </Button>
        ))}
      </div>
    );
  };

  const renderFunctionInterface = () => {
    if (!selectedFunction) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select a function to interact with the contract
        </div>
      );
    }

    const isReadOnly = selectedFunction.stateMutability === "view" || selectedFunction.stateMutability === "pure";
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-lg">{selectedFunction.name}()</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{selectedFunction.stateMutability}</Badge>
            {selectedFunction.stateMutability === "payable" && (
              <Badge variant="secondary">Accepts ETH</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedFunction.inputs.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Parameters</Label>
              {selectedFunction.inputs.map((input, index) => {
                const paramKey = getParamKey(input, index);
                return (
                  <div key={paramKey} className="space-y-1">
                    <Label htmlFor={`input-${paramKey}`} className="text-xs text-muted-foreground">
                      {input.name || `param${index}`} ({input.type})
                    </Label>
                    <Input
                      id={`input-${paramKey}`}
                      value={functionInputs[paramKey] || ""}
                      onChange={(e) => handleInputChange(paramKey, e.target.value)}
                      placeholder={
                        (() => {
                          const isNested = (input.type.match(/\[/g) || []).length > 1;
                          const isTupleArray = input.type.startsWith("tuple[") || input.type === "tuple[]";
                          
                          if (isNested || isTupleArray) {
                            return "JSON: [[val1,val2],[val3,val4]] or nested structure";
                          }
                          if (input.type === "tuple" || input.type.startsWith("tuple")) {
                            return "JSON array: [value1, value2, ...]";
                          }
                          if (input.type.includes("[]") || /\[\d+\]/.test(input.type)) {
                            return "Comma-separated values";
                          }
                          if (input.type === "bool") {
                            return "true or false";
                          }
                          return `Enter ${input.type}`;
                        })()
                      }
                      data-testid={`input-param-${paramKey}`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {selectedFunction.stateMutability === "payable" && (
            <div className="space-y-1">
              <Label htmlFor="eth-value" className="text-xs text-muted-foreground">
                ETH Value (optional)
              </Label>
              <Input
                id="eth-value"
                value={ethValue}
                onChange={(e) => setEthValue(e.target.value)}
                placeholder="0.0"
                type="number"
                step="0.001"
                data-testid="input-eth-value"
              />
            </div>
          )}

          <Button
            onClick={isReadOnly ? executeReadFunction : executeWriteFunction}
            disabled={isExecuting}
            className="w-full"
            data-testid="button-execute-function"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : isReadOnly ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Read
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Transaction
              </>
            )}
          </Button>

          {functionResult !== null && (
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Result</Label>
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all" data-testid="text-function-result">
                    {typeof functionResult === "object"
                      ? JSON.stringify(functionResult, null, 2)
                      : String(functionResult)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{contractName}</DialogTitle>
          <DialogDescription>
            <code className="text-xs">{contractAddress}</code>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : abiData ? (
          <Tabs defaultValue="read" className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="read" data-testid="tab-read-functions">
                Read Functions ({abiData.readFunctions.length})
              </TabsTrigger>
              <TabsTrigger value="write" data-testid="tab-write-functions">
                Write Functions ({abiData.writeFunctions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="read" className="flex-1 mt-4">
              <div className="grid grid-cols-3 gap-4 h-[500px]">
                <ScrollArea className="col-span-1 border rounded-lg p-4">
                  {renderFunctionList(abiData.readFunctions, true)}
                </ScrollArea>
                <div className="col-span-2">
                  {renderFunctionInterface()}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="write" className="flex-1 mt-4">
              <div className="grid grid-cols-3 gap-4 h-[500px]">
                <ScrollArea className="col-span-1 border rounded-lg p-4">
                  {renderFunctionList(abiData.writeFunctions, false)}
                </ScrollArea>
                <div className="col-span-2">
                  {renderFunctionInterface()}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load contract ABI
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
