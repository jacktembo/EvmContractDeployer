/**
 * Contract Flattener
 * 
 * Flattens Solidity contracts by resolving imports and inlining all dependencies.
 * This is necessary for single-file verification on block explorers like Etherscan.
 */

interface FlattenedContract {
  source: string;
  licenseIdentifier: string;
}

export class ContractFlattener {
  /**
   * Resolve a relative import path against the current file's canonical path
   * Mirrors Solidity's import resolution logic
   */
  private resolveRelativePath(currentCanonicalPath: string, importPath: string): string {
    if (!importPath.startsWith("./") && !importPath.startsWith("../")) {
      // Not a relative import, return as-is
      return importPath;
    }

    // Split the current path into directory parts (remove filename)
    const currentParts = currentCanonicalPath.split("/").slice(0, -1);
    const importParts = importPath.split("/");
    
    // Process each part of the import path
    for (const part of importParts) {
      if (part === "..") {
        currentParts.pop();
      } else if (part !== ".") {
        currentParts.push(part);
      }
    }
    
    return currentParts.join("/");
  }

  /**
   * Flatten a Solidity contract by resolving all imports
   * @param mainSource The main contract source code
   * @param resolvedSources Map of resolved import paths to their source code
   * @returns Flattened contract source code
   */
  flatten(mainSource: string, resolvedSources: Map<string, string>): string {
    const licensePattern = /\/\/ SPDX-License-Identifier: (.+)/;
    const pragmaPattern = /pragma solidity ([\^>=<\s\d.]+);/g;
    const importPattern = /import\s+(?:(?:{[^}]+})|(?:"[^"]+"|'[^']+'))\s+from\s+["']([^"']+)["'];|import\s+["']([^"']+)["'];/g;

    // Extract license and pragma from main source
    const licenseMatch = mainSource.match(licensePattern);
    const license = licenseMatch ? licenseMatch[1] : "MIT";
    
    const pragmaMatches = Array.from(mainSource.matchAll(pragmaPattern));
    const pragma = pragmaMatches.length > 0 ? pragmaMatches[0][0] : "pragma solidity ^0.8.0;";

    // Track which sources have been included to avoid duplicates
    const includedSources = new Set<string>();
    const processedContent: string[] = [];

    // Process imports recursively with canonical path tracking
    const processImports = (source: string, canonicalPath: string = "main.sol") => {
      if (includedSources.has(canonicalPath)) {
        return;
      }
      includedSources.add(canonicalPath);

      // Find all imports in this source
      const imports = Array.from(source.matchAll(importPattern));
      
      // Process each import first (depth-first)
      for (const match of imports) {
        const importPath = match[1] || match[2];
        
        // Resolve the import path to its canonical form
        let resolvedCanonicalPath: string;
        
        if (importPath.startsWith("./") || importPath.startsWith("../")) {
          // Relative import - resolve against current file's canonical path
          resolvedCanonicalPath = this.resolveRelativePath(canonicalPath, importPath);
          
          // Try with OpenZeppelin prefix if not found directly
          if (!resolvedSources.has(resolvedCanonicalPath)) {
            resolvedCanonicalPath = `@openzeppelin/contracts/${resolvedCanonicalPath}`;
          }
        } else {
          // Absolute import (like @openzeppelin/...)
          resolvedCanonicalPath = importPath;
        }
        
        // Look up the resolved source
        if (resolvedSources.has(resolvedCanonicalPath)) {
          processImports(resolvedSources.get(resolvedCanonicalPath)!, resolvedCanonicalPath);
        }
      }

      // Remove license, pragma, and imports from this source
      let cleanedSource = source
        .replace(licensePattern, '') // Remove license
        .replace(pragmaPattern, '') // Remove pragma
        .replace(importPattern, ''); // Remove imports

      // Clean up extra whitespace
      cleanedSource = cleanedSource.trim();

      if (cleanedSource) {
        processedContent.push(cleanedSource);
      }
    };

    // Process all sources starting from main
    processImports(mainSource);

    // Assemble the flattened contract
    const flattened = [
      `// SPDX-License-Identifier: ${license}`,
      pragma,
      '',
      '// This file was flattened using a custom flattening tool',
      '// All imports have been resolved and inlined',
      '',
      ...processedContent
    ].join('\n');

    return flattened;
  }

  /**
   * Simple flatten function for cases where we don't have resolved sources
   * This removes imports and leaves the contract as-is (will fail if imports are needed)
   */
  flattenSimple(source: string): string {
    const licensePattern = /\/\/ SPDX-License-Identifier: (.+)/;
    const pragmaPattern = /pragma solidity ([\^>=<\s\d.]+);/;
    const importPattern = /import\s+(?:(?:{[^}]+})|(?:"[^"]+"|'[^']+'))\s+from\s+["']([^"']+)["'];|import\s+["']([^"']+)["'];/g;

    const licenseMatch = source.match(licensePattern);
    const license = licenseMatch ? licenseMatch[1] : "MIT";
    
    const pragmaMatch = source.match(pragmaPattern);
    const pragma = pragmaMatch ? pragmaMatch[0] : "pragma solidity ^0.8.0;";

    // Remove imports
    let cleanedSource = source
      .replace(licensePattern, '')
      .replace(pragmaPattern, '')
      .replace(importPattern, '');

    cleanedSource = cleanedSource.trim();

    return [
      `// SPDX-License-Identifier: ${license}`,
      pragma,
      '',
      cleanedSource
    ].join('\n');
  }
}

export const contractFlattener = new ContractFlattener();
