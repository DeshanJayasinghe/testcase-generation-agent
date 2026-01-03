import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestCase, TestResult } from '../types/index.js';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const execAsync = promisify(exec);

/**
 * Download JUnit platform console standalone jar if it doesn't exist
 */
async function ensureJUnitJar(): Promise<string | null> {
  const jarPath = path.join(process.cwd(), 'junit-platform-console-standalone.jar');
  
  // Check if jar already exists
  try {
    await fs.access(jarPath);
    return jarPath;
  } catch {
    // Jar doesn't exist, try to download it
    console.log('📥 JUnit jar not found. Attempting to download...');
    try {
      // Use a specific version that's known to work
      const jarUrl = 'https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.10.0/junit-platform-console-standalone-1.10.0.jar';
      
      const response = await fetch(jarUrl);
      if (!response.ok) {
        throw new Error(`Failed to download JUnit jar: ${response.statusText}`);
      }
      
      const fileStream = createWriteStream(jarPath);
      await pipeline(Readable.fromWeb(response.body as any), fileStream);
      
      console.log('✅ JUnit jar downloaded successfully');
      return jarPath;
    } catch (error: any) {
      console.log(`⚠️  Could not download JUnit jar: ${error.message}`);
      console.log('💡 Please manually download junit-platform-console-standalone.jar and place it in the project root');
      return null;
    }
  }
}

/**
 * Execute JUnit test and return results
 */
export async function executeJUnitTest(testCase: TestCase): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Write test code to temporary file
    const className = extractClassName(testCase.code);
    const testFileName = `${className}.java`;
    const testFilePath = path.join(process.cwd(), 'temp', testFileName);
    const tempDir = path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(testFilePath, testCase.code);

    // Copy source file to temp directory if it exists (for Calculator, etc.)
    const sourceFilePath = testCase.filePath;
    let sourceFileName = '';
    try {
      const sourceContent = await fs.readFile(sourceFilePath, 'utf-8');
      // Extract class name from source file
      const sourceClassMatch = sourceContent.match(/public\s+class\s+(\w+)/);
      if (sourceClassMatch) {
        sourceFileName = `${sourceClassMatch[1]}.java`;
        const sourceTempPath = path.join(tempDir, sourceFileName);
        await fs.writeFile(sourceTempPath, sourceContent);
      }
    } catch (e) {
      // Source file might not exist or be readable, continue anyway
    }

    // Compile both test and source files together
    const filesToCompile = sourceFileName 
      ? `${path.join(tempDir, sourceFileName)} ${testFilePath}`
      : testFilePath;
    
    // Ensure JUnit jar exists (download if needed)
    const junitJar = await ensureJUnitJar();
    
    if (!junitJar) {
      return {
        testCaseId: testCase.id,
        passed: false,
        executionTime: Date.now() - startTime,
        error: 'JUnit jar not found and could not be downloaded. Please download junit-platform-console-standalone.jar and place it in the project root.',
        stackTrace: 'JUnit dependencies are required for Java test execution. Download from: https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.10.0/junit-platform-console-standalone-1.10.0.jar',
        timestamp: new Date(),
      };
    }
    
    // Build classpath - MUST include JUnit jar for compilation
    const classpath = `"${junitJar}:${tempDir}"`;
    
    const compileCommand = `javac -cp ${classpath} ${filesToCompile}`;
    let compileError: string | undefined;
    try {
      await execAsync(compileCommand, { 
        timeout: 15000,
        cwd: process.cwd()
      });
    } catch (compileErr: any) {
      // Capture compilation errors
      compileError = compileErr.stderr || compileErr.stdout || compileErr.message;
      // If compilation fails, return early with the error
      return {
        testCaseId: testCase.id,
        passed: false,
        executionTime: Date.now() - startTime,
        error: `Compilation failed: ${compileError}`,
        stackTrace: compileErr.stack || compileError,
        output: compileErr.stdout || '',
        timestamp: new Date(),
      };
    }

    // Run the test - use the JUnit jar
    const runCommand = `java -jar ${junitJar} --class-path ${tempDir} --select-class ${className}`;
    
    let stdout = '';
    let stderr = '';
    try {
      const result = await execAsync(runCommand, {
        timeout: 30000,
        cwd: process.cwd()
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (execError: any) {
      // Command might have failed, but still capture output
      stdout = execError.stdout || '';
      stderr = execError.stderr || execError.message || '';
      
      // If we got output, try to parse it anyway (sometimes JUnit returns non-zero exit code even on success)
      if (!stdout && !stderr) {
        // No output at all, this is a real failure
        return {
          testCaseId: testCase.id,
          passed: false,
          executionTime: Date.now() - startTime,
          error: `Test execution failed: ${execError.message}`,
          stackTrace: execError.stack || stderr,
          output: stdout,
          timestamp: new Date(),
        };
      }
    }

    const executionTime = Date.now() - startTime;

    // Parse JUnit output - check for failures more comprehensively
    const outputText = stdout + stderr;
    
    // JUnit 5 output patterns:
    // - Success: Tests show ✔ and "Test run finished" or "SUCCESS"
    // - Failure: Contains "✘" (failure mark), "FAILED", or assertion errors
    // - The output format shows: ├─ testMethod() ✔ or ├─ testMethod() ✘
    
    // Count success (✔) and failure (✘) markers
    const successCount = (outputText.match(/✔/g) || []).length;
    const failureCount = (outputText.match(/✘/g) || []).length;
    
    // Check for explicit failure indicators
    const hasExplicitFailures = outputText.includes('FAILED') || 
                                outputText.includes('✘') ||
                                outputText.includes('AssertionError') ||
                                outputText.includes('AssertionFailedError') ||
                                (outputText.includes('Exception') && !outputText.match(/Exception.*✔/));
    
    // Check for success indicators
    const hasSuccessIndicators = outputText.includes('SUCCESS') ||
                                 outputText.match(/Test run finished/i) ||
                                 outputText.match(/tests? successful/i) ||
                                 (successCount > 0 && failureCount === 0);
    
    // Determine if test passed
    // If we see ✘ marks, it failed
    // If we only see ✔ marks and no ✘, it passed
    // If we see "FAILED" explicitly, it failed
    // If we see "SUCCESS" or "Test run finished" with no failures, it passed
    let passed = false;
    
    if (failureCount > 0 || hasExplicitFailures) {
      passed = false;
    } else if (successCount > 0 && failureCount === 0) {
      passed = true;
    } else if (hasSuccessIndicators && !hasExplicitFailures) {
      passed = true;
    } else {
      // Fallback: if no clear indicators, check if there are any test methods executed
      // If we see test method names but no failures, assume passed
      const hasTestMethods = outputText.match(/test\w+\(\)/i);
      passed = hasTestMethods !== null && !hasExplicitFailures;
    }
    
    let error: string | undefined;
    let stackTrace: string | undefined;

    if (!passed) {
      // Extract more comprehensive error information
      error = extractErrorMessage(outputText);
      stackTrace = outputText; // Include full output as stack trace for better debugging
      
      // If error extraction didn't find much, use the full stderr or relevant parts
      if (!error || error.length < 20) {
        error = stderr || stdout || 'Test execution failed';
      }
    }

    // Clean up temp files
    await fs.unlink(testFilePath).catch(() => { });
    await fs.unlink(path.join(tempDir, `${className}.class`)).catch(() => { });
    if (sourceFileName) {
      await fs.unlink(path.join(tempDir, sourceFileName)).catch(() => { });
      const sourceClassMatch = sourceFileName.match(/(\w+)\.java/);
      if (sourceClassMatch) {
        await fs.unlink(path.join(tempDir, `${sourceClassMatch[1]}.class`)).catch(() => { });
      }
    }

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
 * Execute multiple JUnit tests
 */
export async function executeJUnitTests(testCases: TestCase[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    const result = await executeJUnitTest(testCase);
    results.push(result);
  }

  return results;
}

/**
 * Extract class name from Java test code
 */
function extractClassName(code: string): string {
  const match = code.match(/class\s+(\w+)/);
  return match ? match[1] : 'TestClass';
}

/**
 * Extract error message from JUnit output
 */
function extractErrorMessage(output: string): string {
  const lines = output.split('\n');
  const errorLines: string[] = [];
  
  // Look for various error patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('expected') ||
      line.includes('actual') ||
      line.includes('AssertionError') ||
      line.includes('Exception') ||
      line.includes('Error:') ||
      line.includes('cannot find symbol') ||
      line.includes('package') && line.includes('does not exist') ||
      line.includes('class') && line.includes('cannot be resolved') ||
      line.includes('compilation failed') ||
      line.includes('FAILED') ||
      line.match(/^\s*at\s+\w+/) // Stack trace lines
    ) {
      errorLines.push(line);
      // Include a few lines of context after error lines
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        if (lines[i + j].trim()) {
          errorLines.push(lines[i + j]);
        }
      }
    }
  }
  
  // If we found error lines, return them; otherwise return a meaningful portion of output
  if (errorLines.length > 0) {
    return errorLines.slice(0, 20).join('\n'); // Limit to first 20 lines
  }
  
  // Fallback: return last 30 lines of output (usually contains error info)
  return lines.slice(-30).join('\n') || 'Test execution failed - see output for details';
}