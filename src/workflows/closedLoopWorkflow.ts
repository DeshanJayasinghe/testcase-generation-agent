import { generateTestsForFile } from "../agents/testGeneratorAgent.js";
import { autoFixFailedTest } from "../agents/autoFixAgent.js";
import { executeJestTests } from "../executors/jestExecutor.js";
import { executeJUnitTests } from "../executors/junitExecutor.js";
import { testCaseStore } from "../data/testCaseStore.js";
import { bugFixStore } from "../data/bugFixStore.js";
import { Requirement, WorkflowState } from "../types/index.js";

/**
 * Main closed-loop workflow: Generate → Execute → Fix → Re-execute
 */
export async function runClosedLoopWorkflow(
  filePath: string,
  testType: "junit" | "jest",
  requirements?: Requirement[],
  autoApplyFixes: boolean = false,
  maxRetries: number = 3
): Promise<WorkflowState> {
  console.log(`\n🚀 Starting Closed-Loop Workflow for: ${filePath}\n`);

  const state: WorkflowState = {
    stage: 'parsing',
    testCases: [],
    testResults: [],
    bugFixes: [],
    errors: [],
  };

  try {
    // ========== STAGE 1: Parse & Generate Tests ==========
    console.log("📝 Stage 1: Generating test cases...");
    state.stage = 'generating';

    const testCases = await generateTestsForFile(filePath, testType, requirements);
    state.testCases = testCases;
    console.log(`✅ Generated ${testCases.length} test cases\n`);

    // ========== STAGE 2: Execute Tests ==========
    console.log("🧪 Stage 2: Executing tests...");
    state.stage = 'executing';

    let testResults;
    if (testType === 'jest') {
      testResults = await executeJestTests(testCases);
    } else {
      testResults = await executeJUnitTests(testCases);
    }

    // Store results
    testResults.forEach(result => testCaseStore.storeTestResult(result));
    state.testResults = testResults;

    const passedCount = testResults.filter(r => r.passed).length;
    const failedCount = testResults.filter(r => !r.passed).length;

    console.log(`✅ ${passedCount} tests passed`);
    console.log(`❌ ${failedCount} tests failed\n`);

    // If all tests passed, we're done!
    if (failedCount === 0) {
      state.stage = 'completed';
      console.log("🎉 All tests passed! No fixes needed.\n");
      return state;
    }

    // ========== STAGE 3: Auto-Fix Failed Tests ==========
    console.log("🔧 Stage 3: Auto-fixing failed tests...");
    state.stage = 'fixing';

    const failedResults = testResults.filter(r => !r.passed);
    let retryCount = 0;

    while (retryCount < maxRetries && failedResults.length > 0) {
      console.log(`\n🔄 Fix attempt ${retryCount + 1}/${maxRetries}`);

      for (const failedResult of failedResults) {
        try {
          const testCaseName = testCaseStore.getTestCase(failedResult.testCaseId)?.name;
          console.log(`  Fixing: ${testCaseName}`);
          
          // Log error for debugging
          if (failedResult.error) {
            const errorPreview = failedResult.error.substring(0, 200);
            console.log(`  ⚠️  Error: ${errorPreview}${failedResult.error.length > 200 ? '...' : ''}`);
          }

          const bugFix = await autoFixFailedTest(failedResult, autoApplyFixes);
          state.bugFixes?.push(bugFix);

          console.log(`  ✅ Fix generated: ${bugFix.id}`);
          
          // Log what was fixed (test vs source)
          const fixType = bugFix.description.includes('test') ? 'TEST' : 'SOURCE';
          console.log(`  🔧 Fix type: ${fixType}`);

          if (autoApplyFixes) {
            console.log(`  📝 Fix automatically applied`);
            
            // If test was fixed, update the test case in our array
            const updatedTestCase = testCaseStore.getTestCase(failedResult.testCaseId);
            if (updatedTestCase) {
              const index = testCases.findIndex(tc => tc.id === failedResult.testCaseId);
              if (index >= 0) {
                testCases[index] = updatedTestCase;
                console.log(`  🔄 Test case updated in array`);
              }
            }
          }
        } catch (error: any) {
          console.log(`  ❌ Failed to generate fix: ${error.message}`);
          state.errors?.push(error.message);
        }
      }

      // ========== STAGE 4: Re-execute Tests ==========
      if (autoApplyFixes) {
        console.log("\n🔁 Stage 4: Re-executing tests after fixes...");
        state.stage = 'validating';

        let retestResults;
        if (testType === 'jest') {
          retestResults = await executeJestTests(testCases);
        } else {
          retestResults = await executeJUnitTests(testCases);
        }

        // Store new results
        retestResults.forEach(result => testCaseStore.storeTestResult(result));
        state.testResults = retestResults;

        const newPassedCount = retestResults.filter(r => r.passed).length;
        const newFailedCount = retestResults.filter(r => !r.passed).length;

        console.log(`\n📊 Retest Results:`);
        console.log(`✅ ${newPassedCount} tests passed`);
        console.log(`❌ ${newFailedCount} tests failed`);

        if (newFailedCount === 0) {
          state.stage = 'completed';
          console.log("\n🎉 All tests now passing after auto-fix!\n");
          return state;
        }

        // Update failed results for next iteration
        failedResults.length = 0;
        failedResults.push(...retestResults.filter(r => !r.passed));
      } else {
        // If not auto-applying, just generate all fixes and stop
        break;
      }

      retryCount++;
    }

    // Final status
    if (state.testResults && state.testResults.filter(r => !r.passed).length > 0) {
      state.stage = 'failed';
      console.log(`\n⚠️  Some tests still failing after ${maxRetries} attempts`);
      console.log(`💡 Review generated fixes and apply manually\n`);
    } else {
      state.stage = 'completed';
    }

  } catch (error: any) {
    state.stage = 'failed';
    state.errors?.push(error.message);
    console.error(`\n❌ Workflow failed: ${error.message}\n`);
  }

  return state;
}

/**
 * Print workflow summary
 */
export function printWorkflowSummary(state: WorkflowState): void {
  console.log("\n" + "=".repeat(60));
  console.log("📋 WORKFLOW SUMMARY");
  console.log("=".repeat(60));

  console.log(`\n📊 Stage: ${state.stage.toUpperCase()}`);

  if (state.testCases && state.testCases.length > 0) {
    console.log(`\n🧪 Test Cases: ${state.testCases.length}`);
    state.testCases.forEach(tc => {
      console.log(`   - ${tc.name} (${tc.type})`);
    });
  }

  if (state.testResults && state.testResults.length > 0) {
    const passed = state.testResults.filter(r => r.passed).length;
    const failed = state.testResults.filter(r => !r.passed).length;
    console.log(`\n📈 Test Results:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
  }

  if (state.bugFixes && state.bugFixes.length > 0) {
    console.log(`\n🔧 Bug Fixes Generated: ${state.bugFixes.length}`);
    state.bugFixes.forEach(fix => {
      const status = fix.applied ? '✅ Applied' : '⏳ Pending';
      console.log(`   - ${fix.id} [${status}]`);
    });
  }

  if (state.errors && state.errors.length > 0) {
    console.log(`\n⚠️  Errors: ${state.errors.length}`);
    state.errors.forEach(err => {
      console.log(`   - ${err}`);
    });
  }

  console.log("\n" + "=".repeat(60) + "\n");
}