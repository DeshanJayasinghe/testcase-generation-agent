import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestCase, TestResult } from '../types/index.js';

const execAsync = promisify(exec);

/**
 * Execute Jest tests and return results
 */
export async function executeJestTest(testCase: TestCase): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Write test code to temporary file
    const testFileName = `${testCase.name}.${testCase.type}.ts`;
    const testFilePath = path.join(process.cwd(), 'temp', testFileName);

    // Ensure temp directory exists
    await fs.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
    await fs.writeFile(testFilePath, testCase.code);

    // Run Jest on the test file
    const command = `npx jest ${testFilePath} --json --no-coverage`;
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
    });

    const executionTime = Date.now() - startTime;

    // Parse Jest JSON output
    let passed = true;
    let error: string | undefined;
    let stackTrace: string | undefined;

    try {
      const result = JSON.parse(stdout);
      if (result.numFailedTests > 0) {
        passed = false;
        const failedTest = result.testResults[0]?.assertionResults?.find((r: any) => r.status === 'failed');
        if (failedTest) {
          error = failedTest.failureMessages?.[0];
          stackTrace = failedTest.failureMessages?.join('\n');
        }
      }
    } catch (parseError) {
      // If JSON parsing fails, check stderr
      if (stderr) {
        passed = false;
        error = stderr;
      }
    }

    // Clean up temp file
    await fs.unlink(testFilePath).catch(() => { });

    return {
      testCaseId: testCase.id,
      passed,
      executionTime,
      error,
      stackTrace,
      output: stdout,
      timestamp: new Date(),
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    return {
      testCaseId: testCase.id,
      passed: false,
      executionTime,
      error: error.message,
      stackTrace: error.stack,
      timestamp: new Date(),
    };
  }
}

/**
 * Execute multiple Jest tests
 */
export async function executeJestTests(testCases: TestCase[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    const result = await executeJestTest(testCase);
    results.push(result);
  }

  return results;
}