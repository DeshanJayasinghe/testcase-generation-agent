import { v4 as uuidv4 } from 'uuid';
import { BugFix, StoreEntry } from '../types/index.js';

class BugFixStore {
  private bugFixes: Map<string, StoreEntry<BugFix>> = new Map();

  /**
   * Store a new bug fix
   */
  storeBugFix(
    bugFix: Omit<BugFix, 'id' | 'applied' | 'validated'>,
    userId?: string
  ): BugFix {
    const id = uuidv4();
    const fullBugFix: BugFix = {
      ...bugFix,
      id,
      applied: false,
      validated: false,
    };

    this.bugFixes.set(id, {
      id,
      data: fullBugFix,
      timestamp: new Date(),
      userId,
    });

    return fullBugFix;
  }

  /**
   * Retrieve a bug fix by ID
   */
  getBugFix(bugFixId: string): BugFix | undefined {
    const entry = this.bugFixes.get(bugFixId);
    return entry?.data;
  }

  /**
   * Mark a bug fix as applied
   */
  markAsApplied(bugFixId: string): boolean {
    const entry = this.bugFixes.get(bugFixId);
    if (!entry) return false;

    entry.data.applied = true;
    entry.data.appliedAt = new Date();
    return true;
  }

  /**
   * Mark a bug fix as validated
   */
  markAsValidated(bugFixId: string, validated: boolean): boolean {
    const entry = this.bugFixes.get(bugFixId);
    if (!entry) return false;

    entry.data.validated = validated;
    return true;
  }

  /**
   * Get bug fixes for a specific test case
   */
  getBugFixesForTest(testCaseId: string): BugFix[] {
    return Array.from(this.bugFixes.values())
      .map(entry => entry.data)
      .filter(fix => fix.testCaseId === testCaseId);
  }

  /**
   * List all bug fixes
   */
  listBugFixes(appliedOnly: boolean = false): BugFix[] {
    const fixes = Array.from(this.bugFixes.values()).map(entry => entry.data);
    if (appliedOnly) {
      return fixes.filter(fix => fix.applied);
    }
    return fixes;
  }

  /**
   * Clear all bug fixes (for testing)
   */
  clear(): void {
    this.bugFixes.clear();
  }
}

export const bugFixStore = new BugFixStore();