import OpenAI from "openai";
import { XAI_BASE_URL, isXaiApiKeyConfigured } from "@/lib/ai/config";

export { XAI_BASE_URL, getXaiWorkflowModel } from "@/lib/ai/config";

/** xAI Grok — OpenAI-compatible HTTP API. Keys only from env (never commit). */
export function createXaiClient(): OpenAI | null {
  if (!isXaiApiKeyConfigured()) return null;
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY!,
    baseURL: XAI_BASE_URL,
  });
}

/** Throws if the API key is not set — use when a route must not silently mock. */
export function createXaiClientOrThrow(): OpenAI {
  const client = createXaiClient();
  if (!client) {
    throw new Error("XAI_API_KEY is not set");
  }
  return client;
}
