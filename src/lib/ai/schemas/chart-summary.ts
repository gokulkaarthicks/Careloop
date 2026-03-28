import { z } from "zod";

/** Structured output for chart / pre-visit AI — validated before merging into AiHistorySummary. */
export const chartSummaryStructuredSchema = z.object({
  narrative: z.string().min(1),
  risks: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        severity: z.enum(["low", "moderate", "high"]),
        rationale: z.string(),
      }),
    )
    .min(1)
    .max(8),
  suggestedFocus: z.array(z.string()).min(1).max(8),
  suggestedQuestions: z.array(z.string()).min(1).max(10),
});

export type ChartSummaryStructured = z.infer<typeof chartSummaryStructuredSchema>;
