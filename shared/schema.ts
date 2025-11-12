import { z } from "zod";
import { pgTable, serial, text, varchar, jsonb, timestamp, boolean, integer, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Network configuration schema
export const networkSchema = z.object({
  id: z.string(),
  name: z.string(),
  chainId: z.number(),
  rpcUrl: z.string(),
  blockExplorer: z.string(),
  blockExplorerApiUrl: z.string().optional(),
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  isTestnet: z.boolean(),
  icon: z.string(),
  color: z.string(),
  category: z.enum(["ethereum", "layer2", "sidechain"]),
});

export type Network = z.infer<typeof networkSchema>;

// Compilation request/response schemas
export const compileRequestSchema = z.object({
  sourceCode: z.string(),
  fileName: z.string().default("Contract.sol"),
  solcVersion: z.string().default("0.8.20"),
  optimizationEnabled: z.boolean().default(true),
  optimizationRuns: z.number().int().min(1).max(10000).default(200),
  evmVersion: z.enum(["paris", "shanghai", "cancun", "london", "berlin", "istanbul"]).default("paris"),
});

export type CompileRequest = z.infer<typeof compileRequestSchema>;

export const compiledContractSchema = z.object({
  abi: z.array(z.any()),
  bytecode: z.string(),
  contractName: z.string(),
  constructorInputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    internalType: z.string().optional(),
  })),
  flattenedSource: z.string().optional(), // Flattened source code for verification
});

export type CompiledContract = z.infer<typeof compiledContractSchema>;

export const compileResponseSchema = z.object({
  success: z.boolean(),
  contract: compiledContractSchema.optional(),
  error: z.string().optional(),
  compilerVersion: z.string().optional(), // Full version with commit hash (e.g., "v0.8.30+commit.6182c971")
});

export type CompileResponse = z.infer<typeof compileResponseSchema>;

// Gas estimation schemas
export const gasEstimateRequestSchema = z.object({
  bytecode: z.string(),
  constructorArgs: z.array(z.string()),
  abi: z.array(z.any()),
  chainId: z.number(),
});

export type GasEstimateRequest = z.infer<typeof gasEstimateRequestSchema>;

export const gasCostSchema = z.object({
  native: z.string(),
  usd: z.string().optional(),
});

export const gasPricesSchema = z.object({
  slow: z.string(),
  standard: z.string(),
  fast: z.string(),
});

export const eip1559GasSchema = z.object({
  maxFeePerGas: z.string(),
  maxPriorityFeePerGas: z.string(),
});

export const gasEstimateDataSchema = z.object({
  gasUnits: z.string(),
  gasPrices: gasPricesSchema,
  eip1559: z.object({
    slow: eip1559GasSchema.optional(),
    standard: eip1559GasSchema.optional(),
    fast: eip1559GasSchema.optional(),
    baseFee: z.string().optional(),
  }).optional(),
  costs: z.object({
    slow: gasCostSchema,
    standard: gasCostSchema,
    fast: gasCostSchema,
  }),
  nativeCurrency: z.string(),
  supportsEIP1559: z.boolean().optional(),
});

export const gasEstimateResponseSchema = z.object({
  success: z.boolean(),
  gasEstimate: gasEstimateDataSchema.optional(),
  error: z.string().optional(),
});

export type GasEstimateResponse = z.infer<typeof gasEstimateResponseSchema>;
export type GasEstimateData = z.infer<typeof gasEstimateDataSchema>;
export type GasPrices = z.infer<typeof gasPricesSchema>;

// Deployment state
export const deploymentStateSchema = z.object({
  status: z.enum(["idle", "compiling", "compiled", "deploying", "deployed", "error"]),
  compiledContract: compiledContractSchema.optional(),
  transactionHash: z.string().optional(),
  contractAddress: z.string().optional(),
  error: z.string().optional(),
  gasEstimate: z.string().optional(),
});

export type DeploymentState = z.infer<typeof deploymentStateSchema>;

// Wallet connection state
export const walletStateSchema = z.object({
  connected: z.boolean(),
  address: z.string().optional(),
  chainId: z.number().optional(),
  balance: z.string().optional(),
});

export type WalletState = z.infer<typeof walletStateSchema>;

// Supported networks configuration
export const NETWORKS: Network[] = [
  {
    id: "ethereum",
    name: "Ethereum Mainnet",
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    blockExplorerApiUrl: "https://api.etherscan.io/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: false,
    icon: "ethereum",
    color: "#627EEA",
    category: "ethereum",
  },
  {
    id: "ethereum-sepolia",
    name: "Sepolia Testnet",
    chainId: 11155111,
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
    blockExplorerApiUrl: "https://api-sepolia.etherscan.io/api",
    nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
    isTestnet: true,
    icon: "ethereum",
    color: "#627EEA",
    category: "ethereum",
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    chainId: 56,
    rpcUrl: "https://bsc-dataseed.binance.org",
    blockExplorer: "https://bscscan.com",
    blockExplorerApiUrl: "https://api.bscscan.com/api",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    isTestnet: false,
    icon: "bsc",
    color: "#F3BA2F",
    category: "sidechain",
  },
  {
    id: "bsc-testnet",
    name: "BNB Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorer: "https://testnet.bscscan.com",
    blockExplorerApiUrl: "https://api-testnet.bscscan.com/api",
    nativeCurrency: { name: "Test BNB", symbol: "tBNB", decimals: 18 },
    isTestnet: true,
    icon: "bsc",
    color: "#F3BA2F",
    category: "sidechain",
  },
  {
    id: "polygon",
    name: "Polygon Mainnet",
    chainId: 137,
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    blockExplorerApiUrl: "https://api.polygonscan.com/api",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    isTestnet: false,
    icon: "polygon",
    color: "#8247E5",
    category: "sidechain",
  },
  {
    id: "polygon-amoy",
    name: "Polygon Amoy Testnet",
    chainId: 80002,
    rpcUrl: "https://rpc-amoy.polygon.technology",
    blockExplorer: "https://amoy.polygonscan.com",
    blockExplorerApiUrl: "https://api-amoy.polygonscan.com/api",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    isTestnet: true,
    icon: "polygon",
    color: "#8247E5",
    category: "sidechain",
  },
  {
    id: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    blockExplorerApiUrl: "https://api.arbiscan.io/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: false,
    icon: "arbitrum",
    color: "#28A0F0",
    category: "layer2",
  },
  {
    id: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    chainId: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
    blockExplorerApiUrl: "https://api-sepolia.arbiscan.io/api",
    nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
    isTestnet: true,
    icon: "arbitrum",
    color: "#28A0F0",
    category: "layer2",
  },
  {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    rpcUrl: "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
    blockExplorerApiUrl: "https://api-optimistic.etherscan.io/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: false,
    icon: "optimism",
    color: "#FF0420",
    category: "layer2",
  },
  {
    id: "optimism-sepolia",
    name: "Optimism Sepolia",
    chainId: 11155420,
    rpcUrl: "https://sepolia.optimism.io",
    blockExplorer: "https://sepolia-optimism.etherscan.io",
    blockExplorerApiUrl: "https://api-sepolia-optimistic.etherscan.io/api",
    nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
    isTestnet: true,
    icon: "optimism",
    color: "#FF0420",
    category: "layer2",
  },
  {
    id: "avalanche",
    name: "Avalanche C-Chain",
    chainId: 43114,
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    blockExplorer: "https://snowtrace.io",
    blockExplorerApiUrl: "https://api.snowtrace.io/api",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    isTestnet: false,
    icon: "avalanche",
    color: "#E84142",
    category: "sidechain",
  },
  {
    id: "avalanche-fuji",
    name: "Avalanche Fuji Testnet",
    chainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    blockExplorer: "https://testnet.snowtrace.io",
    blockExplorerApiUrl: "https://api-testnet.snowtrace.io/api",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    isTestnet: true,
    icon: "avalanche",
    color: "#E84142",
    category: "sidechain",
  },
];

// Database tables
export const deployments = pgTable("deployments", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  contractName: varchar("contract_name", { length: 255 }).notNull(),
  contractAddress: varchar("contract_address", { length: 42 }).notNull(),
  sourceCode: text("source_code").notNull(),
  flattenedSource: text("flattened_source"), // Flattened source for verification
  abi: jsonb("abi").notNull(),
  network: varchar("network", { length: 50 }).notNull(),
  chainId: integer("chain_id").notNull(),
  txHash: varchar("tx_hash", { length: 66 }).notNull(),
  deployedAt: timestamp("deployed_at").notNull().defaultNow(),
  constructorArgs: jsonb("constructor_args"),
  verified: boolean("verified").notNull().default(false),
  verificationStatus: varchar("verification_status", { length: 20 }),
  verificationGuid: varchar("verification_guid", { length: 100 }),
  notes: text("notes"),
  solcVersion: varchar("solc_version", { length: 50 }), // Full version with commit hash (e.g., "v0.8.30+commit.6182c971")
  blockExplorerUrl: text("block_explorer_url"),
  optimizationEnabled: boolean("optimization_enabled").notNull().default(true),
  optimizationRuns: integer("optimization_runs").notNull().default(200),
  evmVersion: varchar("evm_version", { length: 20 }).notNull().default("paris"), // EVM version used during compilation
});

export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description").notNull(),
  sourceCode: text("source_code").notNull(),
  solcVersion: varchar("solc_version", { length: 20 }).notNull(),
  tags: jsonb("tags").notNull(),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  members: jsonb("members").notNull(),
  deployments: jsonb("deployments").notNull().default('[]'),
  createdBy: varchar("created_by", { length: 42 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspaceFiles = pgTable("workspace_files", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  path: varchar("path", { length: 500 }).notNull(),
  content: text("content").notNull().default(''),
  isDirectory: boolean("is_directory").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueWorkspacePath: unique().on(table.workspaceId, table.path),
}));

export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  nonce: varchar("nonce", { length: 255 }).notNull(),
  verified: boolean("verified").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  lastUsed: timestamp("last_used").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contractVersions = pgTable("contract_versions", {
  id: serial("id").primaryKey(),
  deploymentId: integer("deployment_id").notNull().references(() => deployments.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  sourceCode: text("source_code").notNull(),
  solcVersion: varchar("solc_version", { length: 50 }), // Full version with commit hash (e.g., "v0.8.30+commit.6182c971")
  compilerSettings: jsonb("compiler_settings"),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 42 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueDeploymentVersion: unique().on(table.deploymentId, table.version),
}));

export const gasHistory = pgTable("gas_history", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  network: varchar("network", { length: 50 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  baseFee: varchar("base_fee", { length: 100 }),
  priorityFee: varchar("priority_fee", { length: 100 }),
  slowPrice: varchar("slow_price", { length: 100 }).notNull(),
  standardPrice: varchar("standard_price", { length: 100 }).notNull(),
  fastPrice: varchar("fast_price", { length: 100 }).notNull(),
  blockNumber: integer("block_number"),
  source: varchar("source", { length: 50 }),
}, (table) => ({
  chainIdTimestampIdx: index("chain_id_timestamp_idx").on(table.chainId, table.timestamp),
}));

// Insert schemas
export const insertDeploymentSchema = createInsertSchema(deployments).omit({
  id: true,
  deployedAt: true,
});
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deployments.$inferSelect;

export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
});
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

export const insertWorkspaceFileSchema = createInsertSchema(workspaceFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkspaceFile = z.infer<typeof insertWorkspaceFileSchema>;
export type WorkspaceFile = typeof workspaceFiles.$inferSelect;

export const insertAuthSessionSchema = createInsertSchema(authSessions).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export const insertContractVersionSchema = createInsertSchema(contractVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertContractVersion = z.infer<typeof insertContractVersionSchema>;
export type ContractVersion = typeof contractVersions.$inferSelect;

export const insertGasHistorySchema = createInsertSchema(gasHistory).omit({
  id: true,
  timestamp: true,
});
export type InsertGasHistory = z.infer<typeof insertGasHistorySchema>;
export type GasHistory = typeof gasHistory.$inferSelect;

// Contract version request schemas
export const createVersionRequestSchema = z.object({
  sourceCode: z.string().min(1, "Source code is required"),
  notes: z.string().optional(),
  solcVersion: z.string().optional(),
  compilerSettings: z.any().optional(),
});
export type CreateVersionRequest = z.infer<typeof createVersionRequestSchema>;

// Contract verification schemas
export const verifyContractRequestSchema = z.object({
  deploymentId: z.number(),
  chainId: z.number(),
});

export type VerifyContractRequest = z.infer<typeof verifyContractRequestSchema>;

export const verifyContractResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  verificationUrl: z.string().optional(),
});

export type VerifyContractResponse = z.infer<typeof verifyContractResponseSchema>;
export type InsertAuthSession = z.infer<typeof insertAuthSessionSchema>;
export type AuthSession = typeof authSessions.$inferSelect;
