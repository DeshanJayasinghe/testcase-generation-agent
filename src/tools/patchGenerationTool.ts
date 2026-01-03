import { tool } from "langchain";
import * as z from "zod";
import { bugFixStore } from "../data/bugFixStore.js";

/**
 * Generates patches based on identified bugs and suggested fixes.
 */
const patchGenerationTool = tool(
  async (input: { bugId: string; suggestedFix: string }) => {
    const patch = {
      bugId: input.bugId,
      suggestedFix: input.suggestedFix,
      timestamp: new Date().toISOString(),
    };

    await bugFixStore.append(patch);
    return `Patch generated for bug ID ${input.bugId} with suggested fix: ${input.suggestedFix}`;
  },
  {
    name: "generate_patch",
    description: "Generate a patch for a specific bug based on the suggested fix.",
    schema: z.object({
      bugId: z.string().describe("The ID of the bug to fix."),
      suggestedFix: z.string().describe("The suggested fix for the bug."),
    }),
  }
);

export { patchGenerationTool };