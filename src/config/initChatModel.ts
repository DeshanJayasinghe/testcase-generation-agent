import "dotenv/config";
import { initChatModel } from "langchain";

const REQUIRED_AZURE_ENV = [
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_VERSION",
  "AZURE_OPENAI_API_DEPLOYMENT_NAME",
] as const;

function assertAzureEnv() {
  const missing = REQUIRED_AZURE_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing Azure OpenAI environment variables: ${missing.join(", ")}`
    );
  }
}

export async function initAzureChatModel() {
  assertAzureEnv();

  const modelName =
    process.env.AZURE_OPENAI_MODEL?.trim() || "azure_openai:gpt-4o";

  return initChatModel(modelName, {
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
    maxTokens: 2000,
    temperature: 0.7,
  });
}