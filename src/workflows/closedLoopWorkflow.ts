import { generateTestsForFile } from "../agents/testGeneratorAgent.js";
import { autoFixFailedTest } from "../agents/autoFixAgent.js";
import { executeJestTests } from "../executors/jestExecutor.js";
import { executeJUnitTests } from "../executors/junitExecutor.js";
import { testCaseStore } from "../data/testCaseStore.js";
import { bugFixStore } from "../data/bugFixStore.js";
import { Requirement, WorkflowState } from "../types/index.js";
import { ablyService } from "../services/ablyService.js";

/**
 * Workflow options with Ably integration
 */
export interface WorkflowOptions {
  filePath: string;
  testType: "junit" | "jest";
  requirements?: Requirement[];
  autoApplyFixes?: boolean;
  maxRetries?: number;
  // Ably integration options
  workflowId?: string;
  projectId?: string;
  userId?: string;
  channelName?: string;
  enableAbly?: boolean;
}

/**
 * Main closed-loop workflow: Generate → Execute → Fix → Re-execute
 * Supports both direct call and Ably-enabled workflow
 */
export async function runClosedLoopWorkflow(
  filePathOrOptions: string | WorkflowOptions,
  testType?: "junit" | "jest",
  requirements?: Requirement[],
  autoApplyFixes?: boolean,
  maxRetries?: number
): Promise<WorkflowState> {
  // Support both old signature (backward compatible) and new options object
  let options: WorkflowOptions;
  
  if (typeof filePathOrOptions === 'string') {
    // Old signature for backward compatibility
    options = {
      filePath: filePathOrOptions,
      testType: testType || 'jest',
      requirements,
      autoApplyFixes: autoApplyFixes ?? false,
      maxRetries: maxRetries ?? 3,
      enableAbly: false,
    };
  } else {
    // New options object
    options = {
      autoApplyFixes: false,
      maxRetries: 3,
      enableAbly: true,
      workflowId: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: 'default',
      userId: 'system',
      ...filePathOrOptions,
    };
  }

  // Extract options with defaults (using different names to avoid conflict with function params)
  const filePath = options.filePath;
  const finalTestType = options.testType;
  const finalRequirements = options.requirements;
  const finalAutoApplyFixes = options.autoApplyFixes ?? false;
  const finalMaxRetries = options.maxRetries ?? 3;
  const workflowId = options.workflowId || `workflow-${Date.now()}`;
  const projectId = options.projectId || 'default';
  const userId = options.userId || 'system';
  const channelName = options.channelName;
  const enableAbly = options.enableAbly ?? false;

  console.log(`\n🚀 Starting Closed-Loop Workflow for: ${filePath}\n`);

  // Determine channel name
  const channel = channelName || (enableAbly ? ablyService.getWorkflowChannel(workflowId) : null);

  // Emit workflow started event if Ably is enabled
  if (enableAbly && channel) {
    await ablyService.publishEvent(channel, {
      type: 'workflow.started',
      workflowId,
      projectId,
      userId,
      timestamp: new Date(),
      data: {
        filePath,
        testType: finalTestType,
        requirements: finalRequirements,
        autoApplyFixes: finalAutoApplyFixes,
        maxRetries: finalMaxRetries,
      },
    });
  }

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

    // Emit stage change event
    if (enableAbly && channel) {
      await ablyService.publishEvent(channel, {
        type: 'workflow.stage.changed',
        workflowId,
        projectId,
        userId,
        timestamp: new Date(),
        data: { stage: 'generating', message: 'Generating test cases...' },
      });
    }

    const testCases = await generateTestsForFile(filePath, finalTestType, finalRequirements);
    state.testCases = testCases;
    console.log(`✅ Generated ${testCases.length} test cases\n`);

    // Emit test generation event
    if (enableAbly && channel) {
      await ablyService.publishEvent(channel, {
        type: 'workflow.test.generated',
        workflowId,
        projectId,
        userId,
        timestamp: new Date(),
        data: {
          count: testCases.length,
          testCases: testCases.map(tc => ({
            id: tc.id,
            name: tc.name,
            type: tc.type,
            targetFunction: tc.targetFunction,
          })),
        },
      });
    }

    // ========== STAGE 2: Execute Tests ==========
    console.log("🧪 Stage 2: Executing tests...");
    state.stage = 'executing';

    // Emit stage change event
    if (enableAbly && channel) {
      await ablyService.publishEvent(channel, {
        type: 'workflow.stage.changed',
        workflowId,
        projectId,
        userId,
        timestamp: new Date(),
        data: { stage: 'executing', message: 'Executing tests...' },
      });
    }

    let testResults;
    if (finalTestType === 'jest') {
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

    // Emit test execution results
    if (enableAbly && channel) {
      await ablyService.publishEvent(channel, {
        type: 'workflow.test.executed',
        workflowId,
        projectId,
        userId,
        timestamp: new Date(),
        data: {
          passed: passedCount,
          failed: failedCount,
          total: testResults.length,
          results: testResults.map(r => ({
            testCaseId: r.testCaseId,
            passed: r.passed,
            error: r.error?.substring(0, 500), // Limit error length
            executionTime: r.executionTime,
          })),
        },
      });
    }

    // If all tests passed, we're done!
    if (failedCount === 0) {
      state.stage = 'completed';
      console.log("🎉 All tests passed! No fixes needed.\n");
      
      if (enableAbly && channel) {
        await ablyService.publishEvent(channel, {
          type: 'workflow.completed',
          workflowId,
          projectId,
          userId,
          timestamp: new Date(),
          data: { state },
        });
      }
      
      return state;
    }

    // ========== STAGE 3: Auto-Fix Failed Tests ==========
    console.log("🔧 Stage 3: Auto-fixing failed tests...");
    state.stage = 'fixing';

    // Emit stage change event
    if (enableAbly && channel) {
      await ablyService.publishEvent(channel, {
        type: 'workflow.stage.changed',
        workflowId,
        projectId,
        userId,
        timestamp: new Date(),
        data: { stage: 'fixing', message: 'Auto-fixing failed tests...' },
      });
    }

    const failedResults = testResults.filter(r => !r.passed);
    let retryCount = 0;

    while (retryCount < finalMaxRetries && failedResults.length > 0) {
      console.log(`\n🔄 Fix attempt ${retryCount + 1}/${finalMaxRetries}`);

      // Emit progress event
      if (enableAbly && channel) {
        await ablyService.publishEvent(channel, {
          type: 'workflow.progress',
          workflowId,
          projectId,
          userId,
          timestamp: new Date(),
          data: {
            message: `Fix attempt ${retryCount + 1}/${finalMaxRetries}`,
            retryCount: retryCount + 1,
            maxRetries: finalMaxRetries,
            failedTestsCount: failedResults.length,
          },
        });
      }

      for (const failedResult of failedResults) {
        try {
          const testCaseName = testCaseStore.getTestCase(failedResult.testCaseId)?.name;
          console.log(`  Fixing: ${testCaseName}`);
          
          // Log error for debugging
          if (failedResult.error) {
            const errorPreview = failedResult.error.substring(0, 200);
            console.log(`  ⚠️  Error: ${errorPreview}${failedResult.error.length > 200 ? '...' : ''}`);
          }

          const bugFix = await autoFixFailedTest(failedResult, finalAutoApplyFixes);
          state.bugFixes?.push(bugFix);

          console.log(`  ✅ Fix generated: ${bugFix.id}`);
          
          // Log what was fixed (test vs source)
          const fixType = bugFix.description.includes('test') ? 'TEST' : 'SOURCE';
          console.log(`  🔧 Fix type: ${fixType}`);

          // Emit fix generated event
          if (enableAbly && channel) {
            await ablyService.publishEvent(channel, {
              type: 'workflow.fix.generated',
              workflowId,
              projectId,
              userId,
              timestamp: new Date(),
              data: {
                fixId: bugFix.id,
                testCaseId: bugFix.testCaseId,
                description: bugFix.description,
                applied: bugFix.applied,
                fixType,
              },
            });
          }

          if (finalAutoApplyFixes) {
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
      if (finalAutoApplyFixes) {
        console.log("\n🔁 Stage 4: Re-executing tests after fixes...");
        state.stage = 'validating';

        // Emit stage change event
        if (enableAbly && channel) {
          await ablyService.publishEvent(channel, {
            type: 'workflow.stage.changed',
            workflowId,
            projectId,
            userId,
            timestamp: new Date(),
            data: { stage: 'validating', message: 'Re-executing tests after fixes...' },
          });
        }

        let retestResults;
        if (finalTestType === 'jest') {
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

        // Emit retest results
        if (enableAbly && channel) {
          await ablyService.publishEvent(channel, {
            type: 'workflow.test.executed',
            workflowId,
            projectId,
            userId,
            timestamp: new Date(),
            data: {
              passed: newPassedCount,
              failed: newFailedCount,
              total: retestResults.length,
              isRetest: true,
              results: retestResults.map(r => ({
                testCaseId: r.testCaseId,
                passed: r.passed,
                error: r.error?.substring(0, 500),
                executionTime: r.executionTime,
              })),
            },
          });
        }

        if (newFailedCount === 0) {
          state.stage = 'completed';
          console.log("\n🎉 All tests now passing after auto-fix!\n");
          
          if (enableAbly && channel) {
            await ablyService.publishEvent(channel, {
              type: 'workflow.completed',
              workflowId,
              projectId,
              userId,
              timestamp: new Date(),
              data: { state },
            });
          }
          
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
      console.log(`\n⚠️  Some tests still failing after ${finalMaxRetries} attempts`);
      console.log(`💡 Review generated fixes and apply manually\n`);
      
      if (enableAbly && channel) {
        await ablyService.publishEvent(channel, {
          type: 'workflow.failed',
          workflowId,
          projectId,
          userId,
          timestamp: new Date(),
          data: {
            message: `Some tests still failing after ${finalMaxRetries} attempts`,
            state,
          },
        });
      }
    } else {
      state.stage = 'completed';
      
      if (enableAbly && channel) {
        await ablyService.publishEvent(channel, {
          type: 'workflow.completed',
          workflowId,
          projectId,
          userId,
          timestamp: new Date(),
          data: { state },
        });
      }
    }

  } catch (error: any) {
    state.stage = 'failed';
    state.errors?.push(error.message);
    console.error(`\n❌ Workflow failed: ${error.message}\n`);
    
    if (enableAbly && channel) {
      await ablyService.publishEvent(channel, {
        type: 'workflow.failed',
        workflowId,
        projectId,
        userId,
        timestamp: new Date(),
        data: {
          error: error.message,
          state,
        },
      });
    }
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