import { createAgent } from "langchain";
import { TestGeneratorAgent } from "./testGeneratorAgent";
import { AutoFixAgent } from "./autoFixAgent";
import { ValidationAgent } from "./validationAgent";

export class OrchestratorAgent {
  private testGenerator: TestGeneratorAgent;
  private autoFix: AutoFixAgent;
  private validator: ValidationAgent;

  constructor() {
    this.testGenerator = new TestGeneratorAgent();
    this.autoFix = new AutoFixAgent();
    this.validator = new ValidationAgent();
  }

  async orchestrateTestGeneration(requirements: string, codeMetadata: any) {
    const testCases = await this.testGenerator.generateTestCases(requirements, codeMetadata);
    const validationResults = await this.validator.validateTestCases(testCases);
    return { testCases, validationResults };
  }

  async orchestrateAutoFix(bugReport: any) {
    const fixSuggestions = await this.autoFix.suggestFixes(bugReport);
    const appliedFix = await this.autoFix.applyFix(bugReport);
    return { fixSuggestions, appliedFix };
  }

  async runClosedLoopTesting(requirements: string, codeMetadata: any, bugReport: any) {
    const { testCases, validationResults } = await this.orchestrateTestGeneration(requirements, codeMetadata);
    const { fixSuggestions, appliedFix } = await this.orchestrateAutoFix(bugReport);
    return { testCases, validationResults, fixSuggestions, appliedFix };
  }
}