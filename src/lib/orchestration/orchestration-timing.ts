/**
 * Single switch for orchestrator time horizons.
 *
 * Set in `.env.local`:
 * - `NEXT_PUBLIC_ORCHESTRATOR_TIMING=hackathon` — 30s escalation windows (judge / demo)
 * - `NEXT_PUBLIC_ORCHESTRATOR_TIMING=realistic` — hours/days
 *
 * Defaults to **hackathon** when unset (fast demo).
 */
const SEC_MS = 1000;
const MIN_MS = 60 * SEC_MS;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

/** Demo: all “after due” / dedupe horizons use this in hackathon mode */
const HACKATHON_ESCALATION_MS = 30 * SEC_MS;

export type OrchestratorTimingProfile = "hackathon" | "realistic";

const raw = process.env.NEXT_PUBLIC_ORCHESTRATOR_TIMING?.toLowerCase().trim();

export const ORCHESTRATOR_TIMING_PROFILE: OrchestratorTimingProfile =
  raw === "realistic" ? "realistic" : "hackathon";

export const ORCHESTRATION_TIMING =
  ORCHESTRATOR_TIMING_PROFILE === "hackathon" ?
    {
      profile: "hackathon" as const,
      runnerTickMs: 5_000,
      /** Wait this long after Rx update before auto–mark-ready (avoid racing finalize). */
      pharmacyAutoReadyMinRxAgeMs: 15 * SEC_MS,
      pickupReminderDedupeMs: HACKATHON_ESCALATION_MS,
      pickupCancelAfterDueMs: HACKATHON_ESCALATION_MS,
      paReasoningEventDedupeMs: HACKATHON_ESCALATION_MS,
      providerRescheduleTaskDueOffsetMs: HACKATHON_ESCALATION_MS,
      rescheduledAppointmentOffsetMs: HACKATHON_ESCALATION_MS,
      pickupReminderDeadlineText:
        "within ~30 seconds in demo mode to avoid automatic cancellation.",
    }
  : {
      profile: "realistic" as const,
      runnerTickMs: 7_000,
      pharmacyAutoReadyMinRxAgeMs: 45 * SEC_MS,
      pickupReminderDedupeMs: DAY_MS,
      pickupCancelAfterDueMs: DAY_MS,
      paReasoningEventDedupeMs: HOUR_MS,
      providerRescheduleTaskDueOffsetMs: 8 * HOUR_MS,
      rescheduledAppointmentOffsetMs: 2 * DAY_MS,
      pickupReminderDeadlineText:
        "within 24 hours to avoid cancellation.",
    };
