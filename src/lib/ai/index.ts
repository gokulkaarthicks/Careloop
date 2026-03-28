/**
 * Single entry for CareLoop AI — xAI Grok (OpenAI-compatible) only.
 */
export {
  XAI_BASE_URL,
  DEFAULT_XAI_WORKFLOW_MODEL,
  getXaiWorkflowModel,
  isXaiApiKeyConfigured,
  isXaiApiKeyRequired,
} from "@/lib/ai/config";
export {
  createXaiClient,
  createXaiClientOrThrow,
} from "@/lib/ai/xai-client";
export { chatCompletionOnce } from "@/lib/ai/xai-completions";
export {
  generateChartSummaryWithXai,
  type ChartSummaryLlmResult,
} from "@/lib/ai/generate-chart-summary-llm";
export {
  WORKFLOW_TOOL_DEFINITIONS,
} from "@/lib/ai/tools/workflow-tools";
export { dispatchWorkflowToolCall } from "@/lib/ai/tools/workflow-tool-dispatcher";
