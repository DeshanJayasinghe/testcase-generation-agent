import { createAgent, tool } from "langchain";
import * as z from "zod";
import * as fs from 'fs/promises';
import { initAzureChatModel } from "../config/initChatModel.js";
import { bugFixStore } from "../data/bugFixStore.js";
import { testCaseStore } from "../data/testCaseStore.js";
import { TestResult, BugFix, TestCase } from "../types/index.js";
import { executeJestTest } from "../executors/jestExecutor.js";
import { executeJUnitTest } from "../executors/junitExecutor.js";

/**
 * Tool to analyze test failure and generate fix
 */
const analyzeBugTool = tool(
  async (input: { testResultId: string }) => {
    const testResult = testCaseStore.getTestResult(input.testResultId);
    if (!testResult) {
      return "Test result not found";
    }

    const testCase = testCaseStore.getTestCase(testResult.testCaseId);
    if (!testCase) {
      return "Test case not found";
    }

    return JSON.stringify({
      testCase: testCase.name,
      targetFunction: testCase.targetFunction,
      filePath: testCase.filePath,
      error: testResult.error,
      stackTrace: testResult.stackTrace,
    }, null, 2);
  },
  {
    name: "analyze_bug",
    description: "Analyze a test failure and get context about the bug",
    schema: z.object({
      testResultId: z.string().describe("ID of the failed test result"),
    }),
  }
);

/**
 * Tool to generate a bug fix patch
 */
const generateFixTool = tool(
  async (input: {
    testResultId: string;
    filePath: string;
    description: string;
  }) => {
    const testResult = testCaseStore.getTestResult(input.testResultId);
    if (!testResult) {
      return "Test result not found";
    }

    const testCase = testCaseStore.getTestCase(testResult.testCaseId);
    if (!testCase) {
      return "Test case not found";
    }

    // Read the source code
    const sourceCode = await fs.readFile(input.filePath, 'utf-8');

    // Use LLM to generate fix
    const model = await initAzureChatModel();
    const prompt = `You are an expert software engineer. Analyze this test failure and generate a fix.

Test Case: ${testCase.name}
Target Function: ${testCase.targetFunction}
Error: ${testResult.error}
Stack Trace: ${testResult.stackTrace}

Source Code:
\`\`\`
${sourceCode}
\`\`\`

Generate a fixed version of the function ${testCase.targetFunction}. Return ONLY the fixed code for that specific function, no explanations.`;

    const response = await model.invoke(prompt);
    const fixedCode = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    // Store the bug fix
    const bugFix = bugFixStore.storeBugFix({
      testCaseId: testCase.id,
      testResultId: input.testResultId,
      description: input.description,
      originalCode: sourceCode,
      fixedCode,
      filePath: input.filePath,
      lineStart: 0,
      lineEnd: sourceCode.split('\n').length,
    });

    return `Generated bug fix with ID: ${bugFix.id}`;
  },
  {
    name: "generate_fix",
    description: "Generate a code fix patch for a failed test",
    schema: z.object({
      testResultId: z.string().describe("ID of the failed test result"),
      filePath: z.string().describe("Path to the file to fix"),
      description: z.string().describe("Description of the fix"),
    }),
  }
);

/**
 * Tool to apply a bug fix
 */
const applyFixTool = tool(
  async (input: { bugFixId: string; confirm: boolean }) => {
    if (!input.confirm) {
      return "Fix application cancelled - confirmation required";
    }

    const bugFix = bugFixStore.getBugFix(input.bugFixId);
    if (!bugFix) {
      return "Bug fix not found";
    }

    // Apply the fix by writing the fixed code
    await fs.writeFile(bugFix.filePath, bugFix.fixedCode);

    // Mark as applied
    bugFixStore.markAsApplied(input.bugFixId);

    return `Applied bug fix ${input.bugFixId} to ${bugFix.filePath}`;
  },
  {
    name: "apply_fix",
    description: "Apply a generated bug fix to the source code",
    schema: z.object({
      bugFixId: z.string().describe("ID of the bug fix to apply"),
      confirm: z.boolean().describe("Confirm application of the fix"),
    }),
  }
);

/**
 * Tool to retest after applying fix
 */
const retestTool = tool(
  async (input: { bugFixId: string }) => {
    const bugFix = bugFixStore.getBugFix(input.bugFixId);
    if (!bugFix) {
      return "Bug fix not found";
    }

    const testCase = testCaseStore.getTestCase(bugFix.testCaseId);
    if (!testCase) {
      return "Test case not found";
    }

    // Re-run the test
    let result;
    if (testCase.type === 'jest') {
      result = await executeJestTest(testCase);
    } else if (testCase.type === 'junit') {
      result = await executeJUnitTest(testCase);
    } else {
      return "Unsupported test type";
    }

    // Store the result
    testCaseStore.storeTestResult(result);
    bugFixStore.markAsValidated(input.bugFixId, result.passed);

    return `Retest ${result.passed ? 'PASSED' : 'FAILED'}: ${result.error || 'All tests passed'}`;
  },
  {
    name: "retest_after_fix",
    description: "Re-run the test after applying a bug fix",
    schema: z.object({
      bugFixId: z.string().describe("ID of the bug fix to test"),
    }),
  }
);

/**
 * Create Auto-Fix Agent with LangChain
 */
export async function createAutoFixAgent() {
  const model = await initAzureChatModel();
  const tools = [analyzeBugTool, generateFixTool, applyFixTool, retestTool];

  return createAgent({
    model,
    tools,
  });
}

/**
 * Fix a test case that is incorrectly written
 */
export async function fixTestCase(
  testCase: TestCase,
  testResult: TestResult,
  sourceCode: string,
  applyImmediately: boolean = false
): Promise<void> {
  const model = await initAzureChatModel();
  
  const prompt = `You are an expert test engineer. A test is failing because it is incorrectly written. Fix the test to match the actual behavior of the source code.

Test Name: ${testCase.name}
Target Function: ${testCase.targetFunction}
Source File: ${testCase.filePath}
Test Type: ${testCase.type}

ERROR MESSAGE:
${testResult.error}
${testResult.stackTrace ? `\nFULL ERROR OUTPUT:\n${testResult.stackTrace.substring(0, 1000)}` : ''}

SOURCE CODE:
\`\`\`
${sourceCode}
\`\`\`

CURRENT TEST CODE (THIS IS BROKEN - FIX IT):
\`\`\`
${testCase.code}
\`\`\`

ANALYZE THE ERROR:
1. Is this a compilation error? (missing imports, wrong class names, etc.)
2. Is this a runtime error? (wrong method calls, wrong parameter types, etc.)
3. Is this an assertion error? (wrong expected values)

ANALYZE THE SOURCE CODE:
1. What does the function ${testCase.targetFunction} actually do?
2. What is its actual return type and behavior?
3. What are the correct parameter types?
4. Does the source class have a package declaration? (If not, don't import it)

FIX THE TEST:
- If compilation error: Fix imports, class names, package declarations
- If the source has NO package: Remove any import statements for the source class, use it directly
- Fix parameter types to match the function signature exactly
- Fix expectations to match the actual function behavior
- Ensure the test calls the function correctly
- For Java: If Calculator has no package, use "Calculator calculator = new Calculator();" directly (NO import)

IMPORTANT:
- Return ONLY the fixed test code without markdown blocks
- Do NOT wrap in \`\`\`typescript or \`\`\`java or \`\`\` markers
- The output must be valid test code that compiles and runs
- For Java tests: NO package declaration, NO import for Calculator (it's in default package)`;

  const response = await model.invoke(prompt);
  let fixedTestCode = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  
  // Clean up any markdown code blocks
  fixedTestCode = fixedTestCode.replace(/```(typescript|javascript|java|python)?\n?/g, '').replace(/```\n?/g, '').trim();

  // Update the test case in the store
  testCase.code = fixedTestCode;
  testCaseStore.storeTestCase(testCase);
}

/**
 * Generate and apply fix for a failed test (direct function)
 * This function determines whether to fix the source code or the test
 */
export async function autoFixFailedTest(
  testResult: TestResult,
  applyImmediately: boolean = false
): Promise<BugFix> {
  const testCase = testCaseStore.getTestCase(testResult.testCaseId);
  if (!testCase) {
    throw new Error('Test case not found');
  }

  // Read source code and test code
  const sourceCode = await fs.readFile(testCase.filePath, 'utf-8');
  const testCode = testCase.code;

  // Use LLM to determine if source or test needs fixing
  const model = await initAzureChatModel();
  const analysisPrompt = `You are an expert software engineer. Analyze this test failure and determine if the SOURCE CODE has a bug OR if the TEST is incorrectly written.

Test Name: ${testCase.name}
Target Function: ${testCase.targetFunction}
Source File: ${testCase.filePath}

ERROR MESSAGE:
${testResult.error}
${testResult.stackTrace ? `\nSTACK TRACE:\n${testResult.stackTrace}` : ''}

SOURCE CODE:
\`\`\`
${sourceCode}
\`\`\`

TEST CODE:
\`\`\`
${testCode}
\`\`\`

ANALYZE CAREFULLY:
1. Does the test import the function correctly?
2. Does the test call the function with the correct parameter types and count?
3. Does the test expect behavior that matches what the source code actually does?
4. Is the source code implementing the intended functionality correctly?

Respond with ONLY one word: "SOURCE" if the source code has a bug, or "TEST" if the test is wrong.`;

  const analysisResponse = await model.invoke(analysisPrompt);
  const analysis = typeof analysisResponse.content === 'string' 
    ? analysisResponse.content.trim().toUpperCase() 
    : JSON.stringify(analysisResponse.content);

  // Detect if test needs fixing based on error patterns
  const errorLower = (testResult.error || '').toLowerCase();
  const shouldFixTest = analysis.includes('TEST') || 
                        errorLower.includes('import') ||
                        errorLower.includes('cannot find') ||
                        errorLower.includes('is not defined') ||
                        errorLower.includes('typeerror') ||
                        errorLower.includes('referenceerror') ||
                        errorLower.includes('compilation failed') ||
                        errorLower.includes('cannot be resolved') ||
                        errorLower.includes('package') && errorLower.includes('does not exist') ||
                        errorLower.includes('symbol') && errorLower.includes('cannot find') ||
                        errorLower.includes('class') && errorLower.includes('cannot be resolved') ||
                        errorLower.includes('no such method') ||
                        errorLower.includes('method not found');

  if (shouldFixTest) {
    // Fix the test instead of the source
    await fixTestCase(testCase, testResult, sourceCode, applyImmediately);
    
    // Create a bug fix record for tracking (even though we fixed the test)
    const bugFix = bugFixStore.storeBugFix({
      testCaseId: testCase.id,
      testResultId: testResult.testCaseId,
      description: `Fixed test case - test was incorrectly written: ${testResult.error}`,
      originalCode: testCode,
      fixedCode: testCase.code, // Updated test code
      filePath: testCase.filePath, // Note: this is source path, but we fixed the test
      lineStart: 0,
      lineEnd: testCode.split('\n').length,
    });

    if (applyImmediately) {
      bugFixStore.markAsApplied(bugFix.id);
    }

    return bugFix;
  }

  // Fix the source code
  const fixPrompt = `You are an expert software engineer. The source code has a bug that is causing the test to fail. Fix the bug.

Test Name: ${testCase.name}
Target Function: ${testCase.targetFunction}
Source File: ${testCase.filePath}

ERROR MESSAGE:
${testResult.error}
${testResult.stackTrace ? `\nSTACK TRACE:\n${testResult.stackTrace}` : ''}

SOURCE CODE:
\`\`\`
${sourceCode}
\`\`\`

TEST CODE (for reference):
\`\`\`
${testCode}
\`\`\`

FIX THE SOURCE CODE:
- Fix the bug in the function ${testCase.targetFunction}
- Ensure the function works correctly according to the test expectations
- Return the COMPLETE source file with the fix applied

IMPORTANT:
- Return ONLY the complete fixed source code without markdown blocks
- Do NOT wrap in \`\`\`typescript or \`\`\`java or \`\`\` markers
- Do NOT include test code in the source file
- The output must be valid source code that compiles`;

  const fixResponse = await model.invoke(fixPrompt);
  let fixedCode = typeof fixResponse.content === 'string' ? fixResponse.content : JSON.stringify(fixResponse.content);
  
  // Clean up any markdown code blocks
  fixedCode = fixedCode.replace(/```(typescript|javascript|java|python)?\n?/g, '').replace(/```\n?/g, '').trim();

  // Store bug fix
  const bugFix = bugFixStore.storeBugFix({
    testCaseId: testCase.id,
    testResultId: testResult.testCaseId,
    description: `Auto-fix source code: ${testResult.error}`,
    originalCode: sourceCode,
    fixedCode,
    filePath: testCase.filePath,
    lineStart: 0,
    lineEnd: sourceCode.split('\n').length,
  });

  // Apply if requested
  if (applyImmediately) {
    await fs.writeFile(testCase.filePath, fixedCode);
    bugFixStore.markAsApplied(bugFix.id);
  }

  return bugFix;
}