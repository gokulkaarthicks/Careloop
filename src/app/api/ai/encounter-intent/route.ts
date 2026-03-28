import { NextResponse } from "next/server";
import {
  classifyEncounterIntentWithLlm,
  type EncounterIntentKind,
} from "@/lib/ai/classify-encounter-intent-llm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = body.message?.trim() ?? "";
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const result = await classifyEncounterIntentWithLlm(message);
  const payload: { intent: EncounterIntentKind; source: string } = {
    intent: result.intent,
    source: result.source,
  };
  return NextResponse.json(payload);
}
