# Care Orchestrator — 60-second judge script

Use this verbatim or paraphrased. One cohort member flows through all four portals; the bottom **Workflow engine** strip shows **trigger → decision → action → result** for each step.

## 0:00–0:10 — Hook

> “Care Orchestrator is an AI care orchestration layer on top of chart data. One shared workflow state updates provider, patient, pharmacy, and payer at the same time—not four disconnected tools.”

**Do:** Land on **Dashboard**, click **Check flow** (or say you’ll drive the same path manually).

## 0:10–0:25 — What happens in the demo

> “The demo resets the cohort, selects a patient, loads chart context, then runs the same **agentic finalize** path as the provider: coverage rules decide whether the medication goes **straight to pharmacy** or stops for **insurance approval**—prior authorization. You’ll see that decision in the workflow dock, not buried in a chat.”

**Point at:** Bottom **Workflow engine** (expand if needed) — latest events show **Decision / Action / Result**.

## 0:25–0:40 — Four roles (quick tour)

> “**Provider** signs the visit and triggers the orchestrator. **Payer** sees the prior-auth queue if the branch requires it—approve, deny, or ask for more info. **Pharmacy** gets the order when the branch releases it—ready, then pickup. **Patient** sees reminders and check-ins. **Payer analytics** picks up closure and engagement scores when the loop completes.”

**Do:** Click **Provider** → **Pharmacy** → **Patient** → **Payer** (or mention header patient picker works on every tab).

## 0:40–0:55 — Proof it’s not “just summaries”

> “Summaries are one piece. The product is **state + branching**: the engine reads coverage output, creates or skips PA cases, updates Rx and pharmacy order state, and emits visible events. Escalations—like missed pickup or adherence—surface as workflow events when rules fire.”

**Optional:** Open **Payer** administrative table — **Agent run** column ties the same run ID across views.

## 0:55–1:00 — Close

> “That’s a closed-loop demo: input → decision → action → result, with judges able to read the story from the dock and the role screens without clinical jargon on every line.”

---

## Fallback (no API keys)

If agentic calls fail, the demo still advances with a **fallback finalize** event in the dock—say: “We still show deterministic workflow transitions so the story completes.”

## Manual path (no one-click)

1. **Dashboard** → **Schedule in 30s and open Provider** (or select patient in header).
2. **Provider** → Start encounter → **Finalize encounter** (dock button).
3. If **insurance approval** appears → **Payer** → resolve PA or wait for background adjudication.
4. **Pharmacy** → Mark ready → Mark picked up.
5. **Patient** → Confirm pickup / adherence if shown.
6. **Payer** → Mark paid / review metrics.
