import { CodeMetadata, FunctionMetadata, Requirement, TestCase } from '../types/index.js';
import { initAzureChatModel } from '../config/initChatModel.js';

/**
 * Generate JUnit test cases using LLM
 */
export async function generateJUnitTests(
  metadata: CodeMetadata,
  requirements?: Requirement[],
  fileContent?: string
): Promise<TestCase[]> {
  const testCases: TestCase[] = [];

  for (const func of metadata.functions) {
    const testCode = await generateJUnitForFunction(metadata, func, requirements, fileContent);

    testCases.push({
      id: '', // Will be set by store
      name: `${func.name}Test`,
      description: `Test for ${metadata.className}.${func.name}`,
      type: 'junit',
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
 * Generate JUnit test code for a specific function
 */
async function generateJUnitForFunction(
  metadata: CodeMetadata,
  func: FunctionMetadata,
  requirements?: Requirement[],
  fileContent?: string
): Promise<string> {
  const model = await initAzureChatModel();

  const paramSignature = func.parameters.length > 0
    ? func.parameters.map(p => `${p.type} ${p.name}`).join(', ')
    : 'no parameters';

  // Use provided fileContent or read from file
  let sourceCodeSnippet = '';
  if (fileContent) {
    sourceCodeSnippet = fileContent;
  } else {
    try {
      const fs = await import('fs/promises');
      const fullSource = await fs.readFile(metadata.filePath, 'utf-8');
      sourceCodeSnippet = fullSource;
    } catch (e) {
      // If we can't read the file, continue without it
    }
  }

  const prompt = `You are an expert test engineer. Generate comprehensive JUnit 5 test cases for the following Java method.

Class: ${metadata.className}
Method: ${func.name}
Method Signature: ${func.returnType} ${func.name}(${paramSignature})
Parameters: ${func.parameters.length === 0 ? 'none' : func.parameters.map(p => `${p.type} ${p.name}`).join(', ')}
Return Type: ${func.returnType}

${sourceCodeSnippet ? `ACTUAL SOURCE CODE:
\`\`\`java
${sourceCodeSnippet}
\`\`\`
` : ''}

${requirements && requirements.length > 0 ? `Requirements:
${requirements.map(r => `- ${r.description} (${r.type})`).join('\n')}` : ''}

CRITICAL RULES:
1. The Calculator class has NO package declaration (it's in the default package)
2. DO NOT add any import statement for Calculator - just use it directly (e.g., "Calculator calculator = new Calculator();")
3. The test class should also have NO package declaration
4. The method ${func.name} has signature: ${func.returnType} ${func.name}(${paramSignature})
5. Use EXACT parameter types as specified (e.g., if method takes int, call it with int, NOT double)
6. Match exception types to what the actual code throws - check the source code above
7. IMPORTANT: Since Calculator has no package, do NOT import it - just use the class name directly
8. Return ONLY the Java test class code without markdown blocks
9. Do NOT wrap in \`\`\`java or \`\`\` markers
10. Test what the method ACTUALLY does based on the source code, not what you think it should do
11. Example correct usage: "private Calculator calculator = new Calculator();" (NO import needed)

Generate a complete JUnit 5 test class with:
- Proper imports for JUnit 5 (org.junit.jupiter.api.*)
- Correct import/instantiation of Calculator class (check the actual file location)
- Test methods for normal/happy path
- Edge cases with valid parameter types
- Exception tests with correct exception types matching the source code
- Proper assertions`;

  const response = await model.invoke(prompt);
  let code = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  
  // Clean up any markdown code blocks if the LLM included them
  code = code.replace(/```java\n?/g, '').replace(/```\n?/g, '').trim();
  
  return code;
}

/**
 * Generate basic JUnit template (fallback if LLM fails)
 */
export function generateBasicJUnitTemplate(
  className: string,
  methodName: string,
  returnType: string
): string {
  return `import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

class ${className}Test {
    
    private ${className} ${className.toLowerCase()};
    
    @BeforeEach
    void setUp() {
        ${className.toLowerCase()} = new ${className}();
    }
    
    @Test
    @DisplayName("Test ${methodName} with valid input")
    void test${methodName.charAt(0).toUpperCase() + methodName.slice(1)}WithValidInput() {
        // Arrange
        // TODO: Add test data
        
        // Act
        ${returnType} result = ${className.toLowerCase()}.${methodName}();
        
        // Assert
        assertNotNull(result);
    }
    
    @Test
    @DisplayName("Test ${methodName} with null input")
    void test${methodName.charAt(0).toUpperCase() + methodName.slice(1)}WithNullInput() {
        // Arrange & Act & Assert
        assertThrows(IllegalArgumentException.class, () -> {
            ${className.toLowerCase()}.${methodName}(null);
        });
    }
}`;
}