import * as path from 'path';
import { runClosedLoopWorkflow, printWorkflowSummary } from './workflows/closedLoopWorkflow.js';
import { Requirement } from './types/index.js';

/**
 * Main entry point - demonstrates the closed-loop workflow
 */
async function main() {
  console.log("🤖 AI-Driven Test Case Generation & Automatic Bug Fixing\n");
  console.log("=".repeat(60) + "\n");

  // Example 1: Test TypeScript utils
  console.log("📌 Example 1: Testing TypeScript Utilities\n");

  const tsFilePath = path.join(process.cwd(), 'examples', 'typescript-sample', 'utils.ts');

  const tsRequirements: Requirement[] = [
    {
      id: 'req-1',
      description: 'Test UUID generation produces valid format',
      type: 'functional',
      priority: 'high',
    },
    {
      id: 'req-2',
      description: 'Test error message formatting with various inputs',
      type: 'functional',
      priority: 'medium',
    },
    {
      id: 'req-3',
      description: 'Handle null and undefined inputs gracefully',
      type: 'edge-case',
      priority: 'high',
    },
  ];

  try {
    const tsWorkflowState = await runClosedLoopWorkflow(
      tsFilePath,
      'jest',
      tsRequirements,
      true,  // Enable auto-apply fixes
      2      // Max 2 retry attempts
    );

    printWorkflowSummary(tsWorkflowState);
  } catch (error: any) {
    console.error(`❌ TypeScript workflow failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Example 2: Test Java Calculator
  console.log("📌 Example 2: Testing Java Calculator\n");

  const javaFilePath = path.join(process.cwd(), 'examples', 'java-sample', 'Calculator.java');

  const javaRequirements: Requirement[] = [
    {
      id: 'req-1',
      description: 'Test arithmetic operations with positive numbers',
      type: 'functional',
      priority: 'high',
    },
    {
      id: 'req-2',
      description: 'Test division by zero throws exception',
      type: 'error-handling',
      priority: 'high',
    },
    {
      id: 'req-3',
      description: 'Test operations with negative numbers and zero',
      type: 'edge-case',
      priority: 'medium',
    },
  ];

  try {
    const javaWorkflowState = await runClosedLoopWorkflow(
      javaFilePath,
      'junit',
      javaRequirements,
      true,  // Enable auto-apply fixes
      2
    );

    printWorkflowSummary(javaWorkflowState);
  } catch (error: any) {
    console.error(`❌ Java workflow failed: ${error.message}`);
  }

  console.log("\n🏁 Workflow Complete!\n");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main };