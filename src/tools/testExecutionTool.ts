import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Executes the provided test cases and returns the results.
 * @param {string} testCommand - The command to execute the tests.
 * @returns {Promise<string>} - The results of the test execution.
 */
export async function executeTests(testCommand: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(testCommand);
    if (stderr) {
      throw new Error(`Test execution error: ${stderr}`);
    }
    return stdout;
  } catch (error) {
    throw new Error(`Failed to execute tests: ${error.message}`);
  }
}

/**
 * Runs JUnit tests.
 * @param {string} testFilePath - The path to the JUnit test file.
 * @returns {Promise<string>} - The results of the JUnit test execution.
 */
export async function runJUnitTests(testFilePath: string): Promise<string> {
  const command = `mvn test -Dtest=${testFilePath}`;
  return executeTests(command);
}

/**
 * Runs Jest tests.
 * @param {string} testFilePath - The path to the Jest test file.
 * @returns {Promise<string>} - The results of the Jest test execution.
 */
export async function runJestTests(testFilePath: string): Promise<string> {
  const command = `jest ${testFilePath}`;
  return executeTests(command);
}

/**
 * Runs Cypress tests.
 * @param {string} testFilePath - The path to the Cypress test file.
 * @returns {Promise<string>} - The results of the Cypress test execution.
 */
export async function runCypressTests(testFilePath: string): Promise<string> {
  const command = `cypress run --spec ${testFilePath}`;
  return executeTests(command);
}