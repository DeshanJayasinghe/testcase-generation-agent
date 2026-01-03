import { createWorkflow } from "langchain";
import { AutoFixAgent } from "../agents/autoFixAgent.js";
import { TestGeneratorAgent } from "../agents/testGeneratorAgent.js";
import { ValidationAgent } from "../agents/validationAgent.js";
import { OrchestratorAgent } from "../agents/orchestratorAgent.js";

export const autoFixWorkflow = createWorkflow({
  agents: [
    new TestGeneratorAgent(),
    new AutoFixAgent(),
    new ValidationAgent(),
    new OrchestratorAgent(),
  ],
  steps: [
    {
      name: "generate_tests",
      agent: "TestGeneratorAgent",
      action: "generateTestCases",
    },
    {
      name: "apply_fixes",
      agent: "AutoFixAgent",
      action: "applyFixes",
    },
    {
      name: "validate_tests",
      agent: "ValidationAgent",
      action: "validateGeneratedTests",
    },
    {
      name: "orchestrate_workflow",
      agent: "OrchestratorAgent",
      action: "coordinateWorkflow",
    },
  ],
});