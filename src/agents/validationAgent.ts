import { tool } from "langchain";
import * as z from "zod";
import { testCaseStore } from "../data/testCaseStore.js";

export class ValidationAgent {
  constructor() {}

  validateTestCases(testCases) {
    return testCases.map(testCase => this.validateTestCase(testCase));
  }

  validateTestCase(testCase) {
    const schema = z.object({
      name: z.string().describe("The name of the test case."),
      description: z.string().optional().describe("A brief description of the test case."),
      assertions: z.array(z.object({
        method: z.string().describe("The assertion method used."),
        expected: z.any().describe("The expected value."),
        actual: z.any().describe("The actual value."),
      })).describe("The assertions made in the test case."),
    });

    const result = schema.safeParse(testCase);
    if (!result.success) {
      throw new Error(`Test case validation failed: ${result.error}`);
    }
    return result.data;
  }

  async storeValidatedTestCases(validatedTestCases) {
    for (const testCase of validatedTestCases) {
      await testCaseStore.save(testCase);
    }
  }
}