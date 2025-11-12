import solc from "solc";
import type { CompileRequest, CompileResponse, CompiledContract } from "@shared/schema";
import { contractFlattener } from "./flattener.js";

const OPENZEPPELIN_BASE_URL =
  "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v5.0.0/contracts";

async function fetchOpenZeppelinContract(path: string): Promise<string> {
  const url = `${OPENZEPPELIN_BASE_URL}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path} from OpenZeppelin repository`);
  }
  return response.text();
}

function resolveRelativePath(from: string, to: string): string {
  const fromParts = from.split("/").slice(0, -1);
  const toParts = to.split("/");
  
  for (const part of toParts) {
    if (part === "..") {
      fromParts.pop();
    } else if (part !== ".") {
      fromParts.push(part);
    }
  }
  
  return fromParts.join("/");
}

async function resolveAllImports(
  sourceCode: string,
  basePath: string,
  imports: Map<string, string>,
  visited: Set<string>
): Promise<void> {
  if (visited.has(basePath)) {
    return;
  }
  visited.add(basePath);

  const importRegex = /import\s+(?:(?:\{[^}]*\}|[^"']*)\s+from\s+)?["']([^"']+)["'];/g;
  const matches = Array.from(sourceCode.matchAll(importRegex));
  
  for (const match of matches) {
    let importPath = match[1];
    let fullPath: string;
    let contractPath: string;
    
    if (importPath.startsWith("@openzeppelin/contracts/")) {
      fullPath = importPath;
      contractPath = importPath.replace("@openzeppelin/contracts/", "");
    } else if (importPath.startsWith("./") || importPath.startsWith("../")) {
      const resolvedPath = resolveRelativePath(basePath, importPath);
      fullPath = `@openzeppelin/contracts/${resolvedPath}`;
      contractPath = resolvedPath;
    } else {
      continue;
    }
    
    if (!imports.has(fullPath)) {
      try {
        const content = await fetchOpenZeppelinContract(contractPath);
        // Store under the normalized path
        imports.set(fullPath, content);
        
        const newBasePath = contractPath;
        await resolveAllImports(content, newBasePath, imports, visited);
      } catch (error) {
        console.error(`Failed to fetch ${fullPath}:`, error);
      }
    }
  }
}

async function resolveOpenZeppelinImports(sourceCode: string): Promise<Map<string, string>> {
  const imports = new Map<string, string>();
  const visited = new Set<string>();
  
  await resolveAllImports(sourceCode, "", imports, visited);
  
  return imports;
}

let solcCache: Map<string, any> = new Map();
let versionList: any = null;

async function fetchSolcVersionList(): Promise<any> {
  if (versionList) {
    return versionList;
  }

  const response = await fetch(
    "https://binaries.soliditylang.org/bin/list.json"
  );
  versionList = await response.json();
  return versionList;
}

async function loadSolcVersion(version: string): Promise<{ compiler: any; fullVersion: string }> {
  if (solcCache.has(version)) {
    return solcCache.get(version);
  }

  const list = await fetchSolcVersionList();
  const releases = list.releases;
  
  const longVersion = releases[version];
  
  if (!longVersion) {
    const availableVersions = Object.keys(releases).slice(0, 10).join(", ");
    throw new Error(`Solidity version ${version} not found in releases. Available versions: ${availableVersions}`);
  }

  const versionString = longVersion.replace("soljson-", "").replace(".js", "");
  
  console.log(`Loading Solidity compiler: ${version} -> ${versionString}`);

  return new Promise((resolve, reject) => {
    solc.loadRemoteVersion(versionString, (err: Error | null, solcSnapshot: any) => {
      if (err) {
        reject(new Error(`Failed to load Solidity compiler version ${version}: ${err.message}`));
      } else {
        const result = { compiler: solcSnapshot, fullVersion: versionString };
        solcCache.set(version, result);
        resolve(result);
      }
    });
  });
}

export async function compileContract(
  request: CompileRequest
): Promise<CompileResponse> {
  try {
    const { 
      sourceCode, 
      fileName, 
      solcVersion,
      optimizationEnabled = true,
      optimizationRuns = 200,
      evmVersion = "paris"
    } = request;

    console.log(`Compiling contract with solc version: ${solcVersion}, optimization: ${optimizationEnabled} (${optimizationRuns} runs), EVM: ${evmVersion}`);
    const { compiler, fullVersion } = await loadSolcVersion(solcVersion);

    const imports = await resolveOpenZeppelinImports(sourceCode);
    
    const sources: Record<string, { content: string }> = {
      [fileName]: { content: sourceCode },
    };
    
    imports.forEach((content, path) => {
      sources[path] = { content };
    });

    const input = {
      language: "Solidity",
      sources,
      settings: {
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode.object"],
          },
        },
        optimizer: {
          enabled: optimizationEnabled,
          runs: optimizationRuns,
        },
        evmVersion: evmVersion,
      },
    };

    const output = JSON.parse(compiler.compile(JSON.stringify(input)));

    if (output.errors) {
      const errors = output.errors.filter(
        (err: any) => err.severity === "error"
      );
      if (errors.length > 0) {
        const errorMessage = errors.map((e: any) => e.formattedMessage || e.message).join("\n");
        console.error("Compilation errors:", errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }

    const contractFile = output.contracts[fileName];
    if (!contractFile) {
      return {
        success: false,
        error: "No contract found in the source code",
      };
    }

    const contractName = Object.keys(contractFile)[0];
    const contractData = contractFile[contractName];

    if (!contractData.evm?.bytecode?.object) {
      return {
        success: false,
        error: "Failed to compile contract bytecode",
      };
    }

    const constructorAbi = contractData.abi.find(
      (item: any) => item.type === "constructor"
    );
    const constructorInputs = constructorAbi?.inputs || [];

    // Flatten the source code for verification purposes
    const flattenedSource = contractFlattener.flatten(sourceCode, imports);

    const compiledContract: CompiledContract = {
      abi: contractData.abi,
      bytecode: `0x${contractData.evm.bytecode.object}`,
      contractName,
      constructorInputs: constructorInputs.map((input: any) => ({
        name: input.name,
        type: input.type,
        internalType: input.internalType,
      })),
      flattenedSource, // Include flattened source for verification
    };

    return {
      success: true,
      contract: compiledContract,
      compilerVersion: fullVersion, // Full version with commit hash (e.g., "v0.8.30+commit.6182c971")
    };
  } catch (error: any) {
    console.error("Compilation error:", error);
    return {
      success: false,
      error: error.message || "Unknown compilation error",
    };
  }
}
