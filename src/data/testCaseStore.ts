import { v4 as uuidv4 } from 'uuid';
import { TestCase, TestResult, StoreEntry } from '../types/index.js';

class TestCaseStore {
  private testCases: Map<string, StoreEntry<TestCase>> = new Map();
  private testResults: Map<string, StoreEntry<TestResult>> = new Map();

  /**
   * Store a new test case
   */
  storeTestCase(testCase: Omit<TestCase, 'id' | 'generatedAt'> | TestCase, userId?: string): TestCase {
    // If test case already has an ID, update it; otherwise create new
    let id: string;
    let fullTestCase: TestCase;
    
    if ('id' in testCase && testCase.id) {
      id = testCase.id;
      fullTestCase = {
        ...testCase,
        generatedAt: testCase.generatedAt || new Date(),
      };
    } else {
      id = uuidv4();
      fullTestCase = {
        ...testCase,
        id,
        generatedAt: new Date(),
      } as TestCase;
    }

    this.testCases.set(id, {
      id,
      data: fullTestCase,
      timestamp: new Date(),
      userId,
    });

    return fullTestCase;
  }

  /**
   * Retrieve a test case by ID
   */
  getTestCase(testCaseId: string): TestCase | undefined {
    const entry = this.testCases.get(testCaseId);
    return entry?.data;
  }

  /**
   * List all test cases
   */
  listTestCases(type?: 'junit' | 'jest' | 'cypress'): TestCase[] {
    const testCases = Array.from(this.testCases.values()).map(entry => entry.data);
    if (type) {
      return testCases.filter(tc => tc.type === type);
    }
    return testCases;
  }

  /**
   * Store test result
   */
  storeTestResult(result: Omit<TestResult, 'timestamp'>): TestResult {
    const fullResult: TestResult = {
      ...result,
      timestamp: new Date(),
    };

    this.testResults.set(result.testCaseId, {
      id: result.testCaseId,
      data: fullResult,
      timestamp: new Date(),
    });

    return fullResult;
  }

  /**
   * Get test result for a test case
   */
  getTestResult(testCaseId: string): TestResult | undefined {
    const entry = this.testResults.get(testCaseId);
    return entry?.data;
  }

  /**
   * Get all failed tests
   */
  getFailedTests(): TestResult[] {
    return Array.from(this.testResults.values())
      .map(entry => entry.data)
      .filter(result => !result.passed);
  }

  /**
   * Clear all test cases (for testing)
   */
  clear(): void {
    this.testCases.clear();
    this.testResults.clear();
  }
}

export const testCaseStore = new TestCaseStore();