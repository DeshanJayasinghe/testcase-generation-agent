import { CodeMetadata, FunctionMetadata, Requirement, TestCase } from '../types/index.js';
import { initAzureChatModel } from '../config/initChatModel.js';

/**
 * Generate Jest test cases using LLM
 */
export async function generateJestTests(
  metadata: CodeMetadata,
  requirements?: Requirement[],
  fileContent?: string
): Promise<TestCase[]> {
  const testCases: TestCase[] = [];

  for (const func of metadata.functions) {
    const testCode = await generateJestForFunction(metadata, func, requirements, fileContent);

    testCases.push({
      id: '', // Will be set by store
      name: `${func.name}.test`,
      description: `Test for ${func.name}`,
      type: 'jest',
      code: testCode,
      targetFunction: func.name,
      filePath: metadata.filePath,
      generatedAt: new Date(),
      requirements: requirements?.map(r => r.id),
    });
  }

  return testCases;
}

/**
 * Generate Jest test code for a specific function
 */
async function generateJestForFunction(
  metadata: CodeMetadata,
  func: FunctionMetadata,
  requirements?: Requirement[],
  fileContent?: string
): Promise<string> {
  const model = await initAzureChatModel();

  // Build function signature
  const paramSignature = func.parameters.length > 0 
    ? func.parameters.map(p => `${p.name}: ${p.type}`).join(', ')
    : 'no parameters';

  // Use provided fileContent or read from file
  let sourceCodeSnippet = '';
  if (fileContent) {
    // Extract the function code from provided content
    const lines = fileContent.split('\n');
    const funcLines = lines.slice(func.lineStart - 1, func.lineEnd);
    sourceCodeSnippet = funcLines.join('\n');
  } else {
    try {
      const fs = await import('fs/promises');
      const fullSource = await fs.readFile(metadata.filePath, 'utf-8');
      // Extract the function code
      const lines = fullSource.split('\n');
      const funcLines = lines.slice(func.lineStart - 1, func.lineEnd);
      sourceCodeSnippet = funcLines.join('\n');
    } catch (e) {
      // If we can't read the file, continue without it
    }
  }

  const prompt = `You are an expert test engineer. Generate comprehensive Jest test cases for the following TypeScript function.

Function Name: ${func.name}
Function Signature: ${func.name}(${paramSignature})
Return Type: ${func.returnType}
Source File: ${metadata.filePath}

${sourceCodeSnippet ? `ACTUAL FUNCTION IMPLEMENTATION:
\`\`\`typescript
${sourceCodeSnippet}
\`\`\`
` : ''}

${requirements && requirements.length > 0 ? `Requirements:
${requirements.map(r => `- ${r.description} (${r.type})`).join('\n')}` : ''}

CRITICAL RULES:
1. The function ${func.name} takes EXACTLY ${func.parameters.length} parameter(s)${func.parameters.length === 0 ? ' (NO parameters)' : ': ' + func.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}
2. Import statement MUST be: import { ${func.name} } from '${metadata.filePath.replace(/\.ts$/, '')}';
3. DO NOT add .ts extension to the import path
4. DO NOT test with null or undefined for parameters that are typed as string, number, etc. - TypeScript will reject this
5. Only test edge cases that are valid for the parameter types (e.g., empty string for string, 0 for number, etc.)
6. Test ONLY the actual function signature - don't invent extra parameters
7. IMPORTANT: Test what the function ACTUALLY does based on its implementation, NOT what you think it should do
8. If the function returns "Error: ${'{message}'}", test for that exact format - do NOT expect UUIDs or other features not in the code
9. Return ONLY TypeScript test code without markdown code blocks or backticks
10. Do NOT wrap code in \`\`\`typescript or \`\`\` markers

Generate a complete Jest test suite with:
- describe() block for the function
- Normal/happy path test cases using valid parameter types that match the ACTUAL function behavior
- Edge cases appropriate for the actual parameter types (empty string, zero, etc. - NOT null/undefined)
- Proper assertions using expect() that match what the function actually returns`;

  const response = await model.invoke(prompt);
  let code = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  
  // Clean up any markdown code blocks if the LLM included them
  code = code.replace(/```typescript\n?/g, '').replace(/```\n?/g, '').trim();
  
  return code;
}

/**
 * Generate basic Jest template (fallback if LLM fails)
 */
export function generateBasicJestTemplate(
  functionName: string,
  returnType: string
): string {
  return `import { ${functionName} } from './utils';

describe('${functionName}', () => {
  it('should return ${returnType} for valid input', () => {
    // Arrange
    const input = /* TODO: Add test data */;
    
    // Act
    const result = ${functionName}(input);
    
    // Assert
    expect(result).toBeDefined();
  });
  
  it('should handle null input', () => {
    // Arrange & Act & Assert
    expect(() => ${functionName}(null)).toThrow();
  });
  
  it('should handle undefined input', () => {
    // Arrange & Act & Assert
    expect(() => ${functionName}(undefined)).toThrow();
  });
  
  it('should handle edge cases', () => {
    // TODO: Add edge case tests
  });
});`;
}