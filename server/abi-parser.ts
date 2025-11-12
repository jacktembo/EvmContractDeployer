import { z } from "zod";

// ABI item types
export const abiParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  internalType: z.string().optional(),
  components: z.array(z.any()).optional(), // For tuple types
});

export type AbiParameter = z.infer<typeof abiParameterSchema>;

export const abiFunctionSchema = z.object({
  type: z.literal("function"),
  name: z.string(),
  inputs: z.array(abiParameterSchema),
  outputs: z.array(abiParameterSchema).optional(),
  stateMutability: z.enum(["pure", "view", "nonpayable", "payable"]),
});

export type AbiFunction = z.infer<typeof abiFunctionSchema>;

export const abiEventSchema = z.object({
  type: z.literal("event"),
  name: z.string(),
  inputs: z.array(abiParameterSchema.extend({ indexed: z.boolean().optional() })),
  anonymous: z.boolean().optional(),
});

export type AbiEvent = z.infer<typeof abiEventSchema>;

// Categorized ABI structure
export interface CategorizedAbi {
  readFunctions: AbiFunction[];
  writeFunctions: AbiFunction[];
  events: AbiEvent[];
  constructor: any | null;
  fallback: any | null;
  receive: any | null;
}

/**
 * Parse and categorize contract ABI into read/write functions and events
 */
export function parseAbi(abi: any[]): CategorizedAbi {
  const readFunctions: AbiFunction[] = [];
  const writeFunctions: AbiFunction[] = [];
  const events: AbiEvent[] = [];
  let constructor: any | null = null;
  let fallback: any | null = null;
  let receive: any | null = null;

  for (const item of abi) {
    switch (item.type) {
      case "function":
        const func = item as AbiFunction;
        if (func.stateMutability === "view" || func.stateMutability === "pure") {
          readFunctions.push(func);
        } else {
          writeFunctions.push(func);
        }
        break;
      
      case "event":
        events.push(item as AbiEvent);
        break;
      
      case "constructor":
        constructor = item;
        break;
      
      case "fallback":
        fallback = item;
        break;
      
      case "receive":
        receive = item;
        break;
    }
  }

  return {
    readFunctions: readFunctions.sort((a, b) => a.name.localeCompare(b.name)),
    writeFunctions: writeFunctions.sort((a, b) => a.name.localeCompare(b.name)),
    events: events.sort((a, b) => a.name.localeCompare(b.name)),
    constructor,
    fallback,
    receive,
  };
}

/**
 * Format function signature for display
 */
export function formatFunctionSignature(func: AbiFunction): string {
  const params = func.inputs.map(input => `${input.type} ${input.name}`).join(", ");
  const returns = func.outputs && func.outputs.length > 0
    ? ` returns (${func.outputs.map(o => o.type).join(", ")})`
    : "";
  return `${func.name}(${params})${returns}`;
}

/**
 * Get Solidity type category for input validation
 */
export function getTypeCategory(type: string): "uint" | "int" | "address" | "bool" | "string" | "bytes" | "array" | "tuple" | "unknown" {
  if (type.startsWith("uint")) return "uint";
  if (type.startsWith("int")) return "int";
  if (type === "address") return "address";
  if (type === "bool") return "bool";
  if (type === "string") return "string";
  if (type.startsWith("bytes")) return "bytes";
  if (type.includes("[]")) return "array";
  if (type === "tuple") return "tuple";
  return "unknown";
}
