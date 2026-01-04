import * as fs from 'fs/promises';
import * as path from 'path';
import { CodeMetadata, FunctionMetadata, Parameter } from '../types/index.js';

/**
 * Parse Java code to extract metadata
 */
function parseJavaCode(filePath: string, content: string): CodeMetadata {
  const functions: FunctionMetadata[] = [];
  const lines = content.split('\n');

  // Extract class name
  const classMatch = content.match(/public\s+class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : undefined;

  // Simple regex to find methods (public/private/protected methods)
  const methodRegex = /(public|private|protected)\s+(static\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    const visibility = match[1];
    const isStatic = !!match[2];
    const returnType = match[3];
    const name = match[4];
    const params = match[5];

    // Find line number
    const methodStart = content.substring(0, match.index);
    const lineStart = methodStart.split('\n').length;

    // Parse parameters
    const parameters: Parameter[] = [];
    if (params.trim()) {
      params.split(',').forEach(param => {
        const paramParts = param.trim().split(/\s+/);
        if (paramParts.length >= 2) {
          parameters.push({
            name: paramParts[1],
            type: paramParts[0],
          });
        }
      });
    }

    functions.push({
      name,
      parameters,
      returnType,
      visibility,
      isStatic,
      lineStart,
      lineEnd: lineStart + 5, // Approximation
    });
  }

  return {
    filePath,
    language: 'java',
    className,
    functions,
  };
}

/**
 * Parse TypeScript/JavaScript code to extract metadata
 */
function parseTypeScriptCode(filePath: string, content: string): CodeMetadata {
  const functions: FunctionMetadata[] = [];
  const lines = content.split('\n');

  // Extract imports
  const imports: string[] = [];
  const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Find function declarations and expressions
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\):\s*(\w+)/g;
  const arrowFunctionRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\):\s*(\w+)\s*=>/g;

  // Parse regular functions
  while ((match = functionRegex.exec(content)) !== null) {
    const name = match[1];
    const params = match[2];
    const returnType = match[3];

    const methodStart = content.substring(0, match.index);
    const lineStart = methodStart.split('\n').length;

    const parameters: Parameter[] = parseTypeScriptParameters(params);

    functions.push({
      name,
      parameters,
      returnType,
      lineStart,
      lineEnd: lineStart + 10, // Approximation
    });
  }

  // Parse arrow functions
  while ((match = arrowFunctionRegex.exec(content)) !== null) {
    const name = match[1];
    const params = match[2];
    const returnType = match[3];

    const methodStart = content.substring(0, match.index);
    const lineStart = methodStart.split('\n').length;

    const parameters: Parameter[] = parseTypeScriptParameters(params);

    functions.push({
      name,
      parameters,
      returnType,
      lineStart,
      lineEnd: lineStart + 5, // Approximation
    });
  }

  return {
    filePath,
    language: filePath.endsWith('.ts') ? 'typescript' : 'javascript',
    functions,
    imports,
  };
}

/**
 * Parse TypeScript function parameters
 */
function parseTypeScriptParameters(params: string): Parameter[] {
  const parameters: Parameter[] = [];

  if (params.trim()) {
    params.split(',').forEach(param => {
      const trimmed = param.trim();
      const optional = trimmed.includes('?');
      const parts = trimmed.replace('?', '').split(':');

      if (parts.length >= 2) {
        parameters.push({
          name: parts[0].trim(),
          type: parts[1].trim(),
          optional,
        });
      } else if (parts.length === 1) {
        parameters.push({
          name: parts[0].trim(),
          type: 'any',
          optional,
        });
      }
    });
  }

  return parameters;
}

/**
 * Main function to parse code file and extract metadata
 */
export async function parseCodeMetadata(filePath: string, fileContent?: string): Promise<CodeMetadata> {
  let content: string;
  
  if (fileContent) {
    // Use provided content (from cloud storage)
    content = fileContent;
  } else {
    // Read from filesystem (local files)
    content = await fs.readFile(filePath, 'utf-8');
  }
  
  const ext = path.extname(filePath);

  if (ext === '.java') {
    return parseJavaCode(filePath, content);
  } else if (ext === '.ts' || ext === '.js') {
    return parseTypeScriptCode(filePath, content);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Extract documentation/comments above a function
 */
export function extractDocumentation(content: string, lineStart: number): string | undefined {
  const lines = content.split('\n');
  let docLines: string[] = [];

  // Look backwards from function start
  for (let i = lineStart - 2; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/**')) {
      docLines.unshift(line);
    } else if (!line) {
      continue;
    } else {
      break;
    }
  }

  return docLines.length > 0 ? docLines.join('\n') : undefined;
}