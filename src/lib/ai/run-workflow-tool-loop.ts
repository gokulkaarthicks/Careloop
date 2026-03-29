import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { AgenticCoverageResponse } from "@/lib/ai/agentic-coverage-llm";
import { chatCompletionOnce } from "@/lib/ai/xai-completions";
import {
  dispatchWorkflowToolCall,
  type WorkflowToolDispatchResult,
} from "@/lib/ai/tools/workflow-tool-dispatcher";
import type { EncounterToolDispatchContext } from "@/lib/ai/tools/workflow-tool-context";
import type { ToolTraceEntry } from "@/types/agentic";

export type RunWorkflowToolLoopResult = {
  trace: ToolTraceEntry[];
  timelineSuggestions: { title: string; detail: string }[];
  finalAssistantText?: string;
  stoppedReason: "no_api_key" | "max_turns" | "complete" | "empty_response";
  /** Latest bundle from adjudicate_benefits_coverage in this loop */
  coverageBundle?: AgenticCoverageResponse;
};

function resultToToolContent(result: WorkflowToolDispatchResult): string {
  if (result.ok) {
    return JSON.stringify({
      ok: true,
      detail: result.detail,
      ...(result.timelineEntry ? { timelineEntry: result.timelineEntry } : {}),
    });
  }
  return JSON.stringify({ ok: false, error: result.error });
}

/**
 * Multi-turn xAI completion loop: model may call tools until it finishes or max turns.
 */
export async function runWorkflowToolLoop(options: {
  context: EncounterToolDispatchContext;
  systemPrompt: string;
  userMessage: string;
  tools: ChatCompletionTool[];
  maxTurns?: number;
}): Promise<RunWorkflowToolLoopResult> {
  const maxTurns = options.maxTurns ?? 6;
  const trace: ToolTraceEntry[] = [];
  const timelineSuggestions: { title: string; detail: string }[] = [];
  let coverageBundle: AgenticCoverageResponse | undefined;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userMessage },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const round = await chatCompletionOnce(messages, {
      tools: options.tools,
      toolChoice: "auto",
      temperature: 0.2,
    });

    if (!round) {
      return {
        trace,
        timelineSuggestions,
        stoppedReason: "no_api_key",
        coverageBundle,
      };
    }

    const msg = round.message;
    const toolCalls = msg.tool_calls;

    if (toolCalls?.length) {
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        if (call.type === "function") {
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }
        }
        const dispatched = await dispatchWorkflowToolCall(
          call,
          options.context,
        );
        if (dispatched.ok && dispatched.timelineEntry) {
          timelineSuggestions.push(dispatched.timelineEntry);
        }
        if (dispatched.ok && dispatched.coverageBundle) {
          coverageBundle = dispatched.coverageBundle;
        }
        trace.push({
          tool: call.type === "function" ? call.function.name : call.type,
          args,
          ok: dispatched.ok,
          detail: dispatched.ok ? dispatched.detail : undefined,
          error: dispatched.ok ? undefined : dispatched.error,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: resultToToolContent(dispatched),
        });
      }
      continue;
    }

    const text = msg.content?.trim();
    return {
      trace,
      timelineSuggestions,
      finalAssistantText: text || undefined,
      stoppedReason: text ? "complete" : "empty_response",
      coverageBundle,
    };
  }

  return {
    trace,
    timelineSuggestions,
    stoppedReason: "max_turns",
    coverageBundle,
  };
}
