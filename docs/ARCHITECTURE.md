# CareLoop AI — Architecture (Hackathon Prototype)

> **Security note:** Never commit API keys. Rotate any key that was exposed (xAI console, chat logs, etc.).

## A. Revised architecture (weak points → mitigations)

| Area | Risk | Mitigation |
|------|------|------------|
| **Orchestration** | Two runners (Zustand `runCareLoopWorkflow` vs LangGraph) could diverge | Single **typed step enum** shared by both; LangGraph graph documents canonical order; client demo calls store effects; server graph used for audit/simulation until Supabase backs shared state. |
| **State** | Zustand + localStorage is not multi-user or audit-grade | Treat as **demo session state**; add **Supabase** tables for encounters, events, AI outputs in a later phase; persist `workflow_events` append-only. |
| **Data modeling** | Rich `CareLoopSnapshot` mixes domains | Keep **`src/types/workflow.ts`** as boundary; add **DTO mappers** when syncing to DB. |
| **UI** | Portal pages can drift | **`useCareLoop()`** centralizes patient/appt/Rx/order/payer; shared **cards + timeline**. |
| **Demo reliability** | LLM flakiness | **Mock fallback** when `XAI_API_KEY` unset (unless `REQUIRE_XAI_API_KEY=true`); **Zod** validation on AI JSON; **structured outputs** (`json_schema` with fallback to `json_object`). Model defaults live in **`src/lib/ai/config.ts`**. |
| **Integrations** | Hard-coded IDs | **`src/lib/integrations/*`** interfaces; **seed** data isolated in **`src/lib/seed-data.ts`**. |

## B. Proposed app structure

```
src/
  app/
    (care)/           # Authenticated care shell routes
    api/
      ai/             # xAI Grok — structured outputs + future tool routes
      workflow/       # Optional: graph invoke / audit (future)
  components/
    care-loop/        # Workflow UI, timeline, panels, cards
    landing/
    ui/               # shadcn
  lib/
    ai/               # config.ts, xai-client, completions helper, Zod schemas, chart summary, workflow tools registry, index barrel
    langgraph/        # Care loop StateGraph (ordering + audit)
    integrations/     # EHR, pharmacy, payer facades
    demo/             # One-click + guided demos (Zustand effects)
    orchestration/    # Legacy linear runner (kept for UI compatibility)
  stores/
    care-workflow-store.ts
  types/
    workflow.ts
docs/
  ARCHITECTURE.md
```

## C. Workflow graph (LangGraph)

**Linear care loop** (v1 — hackathon): each node updates typed state + audit trail.

1. `open_visit` — encounter opened (EHR facade)
2. `chart_summary` — xAI Grok structured summary (or mock)
3. `surface_gaps` — risks / questions materialized for UI
4. `finalize_plan` — SOAP + Rx draft committed
5. `route_prescription` — pharmacy order created
6. `patient_instructions` — patient-facing summary + notifications
7. `pharmacy_fulfillment` — ready / pickup
8. `payer_closure` — completion metrics

Edges: `START → … → END`. Conditional routing can be added for exceptions (e.g. cancel Rx).

**Ownership:** LangGraph defines **order and audit**; **application mutations** remain in typed functions invoked from the demo runner / future API (dependency injection).

**Tool calling:** `src/lib/ai/tools/workflow-tools.ts` defines OpenAI-format tools; `workflow-tool-dispatcher.ts` maps tool calls to bounded server actions (extend for DB/events).

## D. Component list (major)

| Component | Role |
|-----------|------|
| `CareAppShell` / sidebar / header | App chrome |
| `CareJourneyTimeline` | Closed-loop steps |
| `WorkflowStageTracker` | Stage stepper |
| `GuidedStoryPanel` / `JudgeDemoPanel` | Demos |
| `PatientCard` | Demographics strip |
| `MedicationCard` | Single med line |
| `PharmacyOrderCard` | Order status |
| `PayerSummaryCard` | Claim / closure |
| `ProviderAiCopilotPanel` | AI side panel (provider) |

## E. End-to-end demo flow (target)

1. Select patient (Jordan)  
2. Open appointment  
3. Generate chart summary (xAI Grok JSON → `AiHistorySummary`)  
4. Show risks + suggested questions  
5. Draft / finalize plan + Rx (canned or provider UI)  
6. Pharmacy receives order  
7. Patient instructions + notifications  
8. Adherence tasks  
9. Payer completion updates  

**“Run full care loop”** — existing judge + guided demos; optional LangGraph audit export later.

## F. Technology split

| Concern | Choice |
|---------|--------|
| **LangGraph** | Canonical step graph + audit reducer (see `src/lib/langgraph/`). |
| **xAI Grok** | All LLM calls via OpenAI-compatible base URL `https://api.x.ai/v1`; key `XAI_API_KEY`; default model `grok-4.20-reasoning` (override `XAI_MODEL`). |
| **Structured outputs** | JSON Schema + strict mode for chart summary; Zod parse before merge into app types. |
| **Tool calling** | `WORKFLOW_TOOL_DEFINITIONS` + `dispatchWorkflowToolCall` for bounded actions; future graph nodes call Grok with `tools`. |
| **Plain server logic** | Validation, mapping, seed, mock integrations. |
| **Local state** | Zustand for demo UX + cross-tab reactivity. |
| **Database** | Supabase optional; schema TBD — append `workflow_events`, `ai_artifacts`. |

## Implementation phases

1. **Done in repo:** xAI chart summary + Zod; workflow tool registry + dispatcher; architecture doc; LangGraph skeleton; reusable cards.  
2. **Next:** Persist events to Supabase; single `/api/workflow/step` executing one graph edge with server-side deps + tool calls.  
3. **Later:** Real HL7/FHIR facades behind `integrations/*`.

## Better tech choices (explicit)

- **xAI Grok (OpenAI-compatible):** One SDK (`openai` package), structured outputs, tool calling, reasoning model for agentic steps.  
- **LangGraph vs custom state machine:** Graph gives checkpoints, future human-in-the-loop, and clear audit — worth the dependency for a workflow-first story.  
- **Zustand vs Redux:** Sufficient for prototype; swap for normalized server cache when DB is live.
