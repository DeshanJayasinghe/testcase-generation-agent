import { createAgent } from "langchain";
import { TestGeneratorAgent } from "../agents/testGeneratorAgent.js";
import { AutoFixAgent } from "../agents/autoFixAgent.js";
import { ValidationAgent } from "../agents/validationAgent.js";
import { OrchestratorAgent } from "../agents/orchestratorAgent.js";
import { initChatModel } from "../config/initChatModel.js";

export async function runTestGenWorkflow(codeMetadata, requirements) {
  const model = await initChatModel();

  const testGenerator = new TestGeneratorAgent(model);
  const autoFixAgent = new AutoFixAgent(model);
  const validationAgent = new ValidationAgent(model);
  const orchestrator = new OrchestratorAgent(model);

  // Step 1: Generate test cases
  const testCases = await testGenerator.generateTestCases(codeMetadata, requirements);

  // Step 2: Validate generated test cases
  const validationResults = await validationAgent.validateTestCases(testCases);

  // Step 3: Apply auto-fixes if necessary
  const fixes = await autoFixAgent.applyFixes(validationResults.bugs);

  // Step 4: Re-run tests after applying fixes
  const testResults = await testGenerator.executeTestCases(testCases);

  return {
    testCases,
    validationResults,
    fixes,
    testResults,
  };
}