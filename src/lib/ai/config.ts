/**
 * Central xAI Grok configuration (OpenAI-compatible API).
 * Change defaults here for the whole app — override with env at deploy time.
 */

export const XAI_BASE_URL = "https://api.x.ai/v1" as const;

/** Default workflow / reasoning model; override with `XAI_MODEL`. */
export const DEFAULT_XAI_WORKFLOW_MODEL = "grok-4.20-reasoning" as const;

export function getXaiWorkflowModel(): string {
  const m = process.env.XAI_MODEL?.trim();
  return m && m.length > 0 ? m : DEFAULT_XAI_WORKFLOW_MODEL;
}

export function isXaiApiKeyConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

/**
 * When `true`, AI routes return 503 if `XAI_API_KEY` is missing (CI / prod).
 * Default: off so hackathon demos work without a key (mock JSON fallback).
 */
export function isXaiApiKeyRequired(): boolean {
  return process.env.REQUIRE_XAI_API_KEY === "true";
}
