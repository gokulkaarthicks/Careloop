# Care Orchestrator

Healthcare hackathon prototype: **Next.js 14**, **TypeScript**, **Tailwind**, **shadcn/ui**, **Zustand**, and **LangGraph** for a demo care loop across provider, patient, pharmacy, and payer views.

## AI layer (xAI Grok)

All LLM calls use **xAI’s OpenAI-compatible HTTP API** (`https://api.x.ai/v1`). Configure locally:

1. Copy `.env.example` to `.env.local`.
2. Set `XAI_API_KEY` from [xAI console](https://console.x.ai).
3. Optional: `XAI_MODEL` (default `grok-4.20-reasoning`).
4. Optional: `REQUIRE_XAI_API_KEY=true` to fail requests when the key is missing (useful for CI); without it, chart summary falls back to **mock JSON** so demos work offline.

Structured chart summaries use JSON schema + Zod validation; workflow tools are defined in `src/lib/ai/tools/` and dispatched via `dispatchWorkflowToolCall`.

## Run locally

```bash
npm install
npm run dev
```

If the UI loads **without styles** or the terminal shows **`404` for `/_next/static/chunks/...`** or **`Cannot find module './NNN.js'`**, the dev cache is out of sync. Clear it and restart:

```bash
npm run clean && npm run dev
```

A static [`public/favicon.ico`](public/favicon.ico) is included so `/favicon.ico` is served as a normal file (avoids broken icon routes during hot reload).

Open [http://localhost:3000](http://localhost:3000). Use the header to switch personas and walk the end-to-end flow (pre-visit → chart summary → SOAP/Rx → pharmacy → payer dashboard).

## Synthetic EHR (SQLite)

Structured chart data lives in a **relational SQLite** database (not RAG). Run:

```bash
npm run db:push   # create/update tables under data/careloop.sqlite
npm run db:seed   # two relational demo patients; UI lists five from bundled seed
```

- **GET** `src/app/api/ehr/patients` — patient directory for the header
- **GET** `src/app/api/ehr/context/[patientId]` — clinical snapshot, appointments, visit briefing, timeline
- **POST** [`/api/ehr/query`](src/app/api/ehr/query/route.ts) — keyword search over meds, problems, allergies, note chunks
- **POST** [`/api/ehr/chart-packet`](src/app/api/ehr/chart-packet/route.ts) — workflow payload for agents

Without a DB file, the app falls back to [`src/lib/seed-data.ts`](src/lib/seed-data.ts).

## Docs

- Architecture notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Scripts

| Command        | Description        |
| -------------- | ------------------ |
| `npm run dev`  | Development server |
| `npm run build`| Production build   |
| `npm run start`| Production server  |
| `npm run lint` | ESLint             |
