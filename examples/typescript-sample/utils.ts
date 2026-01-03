import { randomUUID } from 'crypto';

/**
 * Utility functions for the TypeScript sample project.
 */

/**
 * Generates a unique identifier for test cases or bug fixes.
 * @returns {string} A unique identifier.
 */
export function generateUniqueId(): string {
  return randomUUID();
}

/**
 * Formats a given error message for better readability.
 * @param {string} message - The error message to format.
 * @returns {string} The formatted error message.
 */
export function formatErrorMessage(message: string): string {
  return `Error: ${message}`;
}

/**
 * Logs messages to the console with a timestamp.
 * @param {string} message - The message to log.
 */
export function logWithTimestamp(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// The test is wrong because it expects the formatted message to contain a UUID, 
// but the formatErrorMessage function does not generate or include a UUID in its message.