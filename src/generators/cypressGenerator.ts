import { tool } from "langchain";
import * as z from "zod";
import { generateCypressTestCases } from "../tools/testExecutionTool.js";
import { extractMetadata } from "../data/metadataExtractor.js";

const cypressTestCaseGenerator = tool(
  async (input: { code: string; requirements: string }) => {
    const metadata = extractMetadata(input.code);
    const testCases = await generateCypressTestCases(metadata, input.requirements);
    return testCases;
  },
  {
    name: "generate_cypress_tests",
    description: "Generate Cypress test cases from code and natural language requirements.",
    schema: z.object({
      code: z.string().describe("Source code to analyze for test case generation."),
      requirements: z.string().describe("Natural language requirements for the test cases."),
    }),
  }
);

export { cypressTestCaseGenerator };