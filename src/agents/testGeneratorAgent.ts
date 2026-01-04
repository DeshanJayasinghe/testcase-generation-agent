import { createAgent, tool } from "langchain";
import * as z from "zod";
import { initAzureChatModel } from "../config/initChatModel.js";
import { parseCodeMetadata } from "../parsers/codeMetadataParser.js";
import { generateJUnitTests } from "../generators/junitGenerator.js";
import { generateJestTests } from "../generators/jestGenerator.js";
import { testCaseStore } from "../data/testCaseStore.js";
import { CodeMetadata, Requirement, TestCase } from "../types/index.js";

/**
 * Tool to analyze code and extract metadata
 */
const analyzeCodeTool = tool(
  async (input: { filePath: string }) => {
    const metadata = await parseCodeMetadata(input.filePath);
    return JSON.stringify(metadata, null, 2);
  },
  {
    name: "analyze_code",
    description: "Parse code file and extract metadata (functions, classes, parameters)",
    schema: z.object({
      filePath: z.string().describe("Path to the code file to analyze"),
    }),
  }
);

/**
 * Tool to generate test cases
 */
const generateTestsTool = tool(
  async (input: {
    filePath: string;
    testType: "junit" | "jest";
    requirements?: string[];
  }) => {
    const metadata = await parseCodeMetadata(input.filePath);

    // Parse requirements
    const reqs: Requirement[] = (input.requirements || []).map((desc, idx) => ({
      id: `req-${idx}`,
      description: desc,
      type: 'functional' as const,
      priority: 'medium' as const,
    }));

    let testCases: TestCase[];
    if (input.testType === "junit") {
      testCases = await generateJUnitTests(metadata, reqs);
    } else {
      testCases = await generateJestTests(metadata, reqs);
    }

    // Store generated test cases
    const stored = testCases.map(tc => testCaseStore.storeTestCase(tc));

    return `Generated ${stored.length} ${input.testType} test cases for ${input.filePath}`;
  },
  {
    name: "generate_tests",
    description: "Generate JUnit or Jest test cases from a code file",
    schema: z.object({
      filePath: z.string().describe("Path to the code file"),
      testType: z.enum(["junit", "jest"]).describe("Type of tests to generate"),
      requirements: z
        .array(z.string())
        .optional()
        .describe("Optional natural language requirements for tests"),
    }),
  }
);

/**
 * Create Test Generator Agent with LangChain
 */
export async function createTestGeneratorAgent() {
  const model = await initAzureChatModel();
  const tools = [analyzeCodeTool, generateTestsTool];

  return createAgent({
    model,
    tools,
  });
}

/**
 * Generate tests for a file (direct function)
 */
export async function generateTestsForFile(
  filePath: string,
  testType: "junit" | "jest",
  requirements?: Requirement[],
  fileContent?: string
): Promise<TestCase[]> {
  const metadata = await parseCodeMetadata(filePath, fileContent);

  let testCases: TestCase[];
  if (testType === "junit") {
    testCases = await generateJUnitTests(metadata, requirements, fileContent);
  } else {
    testCases = await generateJestTests(metadata, requirements, fileContent);
  }

  // Store all generated test cases
  const storedTests = testCases.map(tc => testCaseStore.storeTestCase(tc));

  return storedTests;
}