/**
 * Shared chat.completions helpers for xAI (tools + structured steps).
 * LangGraph / routes can call these instead of duplicating client wiring.
 */
import type OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { createXaiClient, getXaiWorkflowModel } from "@/lib/ai/xai-client";

export type ToolCallRoundResult = {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  finishReason: string | null;
};

/**
 * Single non-streaming completion with optional tools (function calling).
 * Extend with multi-round tool execution in the caller when needed.
 */
export async function chatCompletionOnce(
  messages: ChatCompletionMessageParam[],
  options?: {
    tools?: ChatCompletionTool[];
    toolChoice?: ChatCompletionCreateParamsNonStreaming["tool_choice"];
    temperature?: number;
    responseFormat?: ChatCompletionCreateParamsNonStreaming["response_format"];
  },
): Promise<ToolCallRoundResult | null> {
  const client = createXaiClient();
  if (!client) return null;

  const completion = await client.chat.completions.create({
    model: getXaiWorkflowModel(),
    messages,
    temperature: options?.temperature ?? 0.2,
    ...(options?.tools?.length ? { tools: options.tools, tool_choice: options.toolChoice ?? "auto" } : {}),
    ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
  });

  const choice = completion.choices[0];
  const message = choice?.message;
  if (!message) return null;
  return {
    message,
    finishReason: choice.finish_reason ?? null,
  };
}
