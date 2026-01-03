import * as z from "zod";

export const requirementsSchema = z.object({
  title: z.string().describe("The title of the requirement."),
  description: z.string().describe("A detailed description of the requirement."),
  acceptanceCriteria: z.array(z.string()).describe("List of acceptance criteria for the requirement."),
  priority: z.enum(["low", "medium", "high"]).describe("Priority level of the requirement."),
});

export function parseRequirements(requirements: any) {
  const parsed = requirementsSchema.safeParse(requirements);
  if (!parsed.success) {
    throw new Error("Invalid requirements format: " + parsed.error);
  }
  return parsed.data;
}