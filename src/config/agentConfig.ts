import { z } from "zod";

export const agentConfig = {
  model: {
    type: "azure",
    endpoint: "https://your-azure-endpoint.com",
    apiKey: process.env.AZURE_API_KEY,
  },
  agents: {
    testGenerator: {
      maxTokens: 1500,
      temperature: 0.7,
    },
    autoFix: {
      maxTokens: 1000,
      temperature: 0.5,
    },
    validation: {
      maxTokens: 800,
      temperature: 0.3,
    },
    orchestrator: {
      maxTokens: 600,
      temperature: 0.4,
    },
  },
  tools: {
    codeAnalysis: {
      timeout: 5000,
    },
    testExecution: {
      timeout: 10000,
    },
    patchGeneration: {
      timeout: 7000,
    },
    requirementsParsing: {
      timeout: 3000,
    },
  },
  validationSchema: z.object({
    model: z.object({
      type: z.string(),
      endpoint: z.string(),
      apiKey: z.string(),
    }),
    agents: z.object({
      testGenerator: z.object({
        maxTokens: z.number(),
        temperature: z.number(),
      }),
      autoFix: z.object({
        maxTokens: z.number(),
        temperature: z.number(),
      }),
      validation: z.object({
        maxTokens: z.number(),
        temperature: z.number(),
      }),
      orchestrator: z.object({
        maxTokens: z.number(),
        temperature: z.number(),
      }),
    }),
    tools: z.object({
      codeAnalysis: z.object({
        timeout: z.number(),
      }),
      testExecution: z.object({
        timeout: z.number(),
      }),
      patchGeneration: z.object({
        timeout: z.number(),
      }),
      requirementsParsing: z.object({
        timeout: z.number(),
      }),
    }),
  }),
};