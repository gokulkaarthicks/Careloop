"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  looksLikeStructuredVisitDictation,
  mapLlmLabelToEncounterIntent,
  parseEncounterIntent,
  shouldDisambiguateEncounterIntent,
} from "@/lib/encounter-intent";
import { DEMO_TREATMENT_PLAN } from "@/lib/demo/canned-plan";
import type { Patient, Appointment } from "@/types/workflow";
import type { PatientClinicalSummary } from "@/types/workflow";
import type { PrescriptionLine } from "@/types/workflow";
import type { PreVisitAgentOutput } from "@/types/pre-visit-agent";
import {
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
  Pill,
  Plus,
  Send,
  Stethoscope,
  Trash2,
  User,
} from "lucide-react";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  body: string;
  meta?: string;
};

type Props = {
  patientId: string;
  patient: Patient | null;
  clinical: PatientClinicalSummary | null;
  briefingLines: string[] | null;
  appointments: Appointment[];
  activeAppointment: Appointment | null;
  preVisit: PreVisitAgentOutput | null;
  disabled: boolean;
  soapNote: string;
  onSoapChange: (v: string) => void;
  treatmentPlan: string;
  onPlanChange: (v: string) => void;
  rxLines: PrescriptionLine[];
  onRxLinesChange: (lines: PrescriptionLine[]) => void;
  visitFinalized: boolean;
  canEditDocs: boolean;
  onStartEncounter?: () => void;
  canStartEncounter?: boolean;
};

function truncateList(
  items: string[],
  max: number,
  maxLen: number,
): string {
  const slice = items.slice(0, max).join("; ");
  if (slice.length <= maxLen) return slice || "—";
  return `${slice.slice(0, maxLen)}…`;
}

/** EHR briefing: one line per item (visit focus, problems, allergies, …). */
function formatBriefingLines(lines: string[]): string {
  return lines
    .slice(0, 12)
    .map((line) => (line.length > 280 ? `${line.slice(0, 280)}…` : line))
    .join("\n");
}

export function EncounterWorkspace({
  patientId,
  patient,
  clinical,
  briefingLines,
  appointments,
  activeAppointment,
  preVisit,
  disabled,
  soapNote,
  onSoapChange,
  treatmentPlan,
  onPlanChange,
  rxLines,
  onRxLinesChange,
  visitFinalized,
  canEditDocs,
  onStartEncounter,
  canStartEncounter,
}: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [soapVisible, setSoapVisible] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [rxDialogOpen, setRxDialogOpen] = useState(false);
  const [soapActionsOpen, setSoapActionsOpen] = useState(false);
  const [rxDraft, setRxDraft] = useState({
    drugName: "",
    strength: "",
    quantity: "30",
    refills: "0",
    sig: "",
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const buildConciseBrief = useCallback((): ChatMessage[] => {
    const lines: string[] = [];
    if (briefingLines?.length) {
      lines.push(formatBriefingLines(briefingLines));
    } else if (clinical) {
      const allergies =
        clinical.allergies.length === 0
          ? "NKDA"
          : truncateList(
              clinical.allergies.map((a) => a.substance),
              3,
              80,
            );
      const meds = truncateList(
        clinical.medications.map((m) => `${m.name} ${m.dose}`.trim()),
        3,
        120,
      );
      const probs = truncateList(
        clinical.diagnoses.map((d) => d.description),
        3,
        120,
      );
      lines.push(
        `Allergies: ${allergies}\nActive meds: ${meds || "—"}\nProblems: ${probs || "—"}`,
      );
    }

    if (activeAppointment) {
      lines.push(
        `Visit: ${activeAppointment.title}\nWhen: ${new Date(activeAppointment.scheduledFor).toLocaleString()}\nNext: ${activeAppointment.nextAction}`,
      );
    } else {
      lines.push("No active visit slot — pick a patient with an appointment.");
    }

    if (preVisit) {
      lines.push(
        `Readiness: ${preVisit.visitReadinessScore}/100 · Top risk: ${preVisit.risks[0]?.label ?? "none flagged"}`,
      );
    }

    const body = lines.filter(Boolean).join("\n\n");
    if (!body.trim()) {
      return [
        {
          id: "empty",
          role: "assistant" as const,
          body: "Select a patient with chart data to continue.",
        },
      ];
    }
    return [
      {
        id: "brief",
        role: "assistant",
        body,
        meta: "Encounter briefing",
      },
    ];
  }, [briefingLines, clinical, activeAppointment, preVisit]);

  useEffect(() => {
    setMessages(buildConciseBrief());
  }, [patientId, buildConciseBrief]);

  useEffect(() => {
    setSoapVisible(false);
    setPlanVisible(false);
  }, [patientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, soapNote, treatmentPlan, rxLines, soapVisible, planVisible]);

  const runChartSearch = useCallback(
    async (query: string) => {
      const res = await fetch("/api/ehr/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, query }),
      });
      const data = (await res.json()) as {
        hits?: { source: string; snippet: string }[];
        note?: string;
      };
      const lines =
        data.hits?.length ?
          data.hits.map((h) => `• [${h.source}] ${h.snippet}`).join("\n")
        : (data.note ??
          "No structured matches — try a medication name, ICD-10 code, or allergy.");
      return lines;
    },
    [patientId],
  );

  const runSoapLlm = useCallback(
    async (providerMessage: string) => {
      if (!patient || !activeAppointment) return;
      const res = await fetch("/api/ai/soap-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientDisplayName: patient.displayName,
          appointmentTitle: activeAppointment.title,
          clinical,
          providerMessage,
        }),
      });
      const data = (await res.json()) as { soap?: string; error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "SOAP request failed");
      }
      onSoapChange(data.soap ?? "");
      setSoapVisible(true);
    },
    [patient, activeAppointment, clinical, onSoapChange],
  );

  const queueSoapHandoff = useCallback((destination: "payer" | "provider") => {
    setSoapActionsOpen(false);
    setMessages((m) => [
      ...m,
      {
        id: `h_${Date.now()}`,
        role: "assistant",
        body:
          destination === "payer" ?
            "Demo: SOAP queued for payer / claims workflow (mock)."
          : "Demo: SOAP routed to provider / care team inbox (mock).",
        meta: "SOAP handoff",
      },
    ]);
  }, []);

  const openRxDialogFromPrompt = useCallback((q: string) => {
    const m =
      q.match(/prescribe\s+(.+)/i) ??
      q.match(/prescription\s+(.+)/i) ??
      q.match(/\brx\s+(.+)/i);
    const rest = m?.[1]?.trim() ?? "";
    const firstToken = rest.split(/[,\n]/)[0]?.trim() ?? "";
    setRxDraft((d) => ({
      ...d,
      drugName: firstToken.replace(/^["']|["']$/g, ""),
      sig: d.sig,
    }));
    setRxDialogOpen(true);
  }, []);

  const addRxLineFromDialog = useCallback(() => {
    const refillsNum = Number(rxDraft.refills) || 0;
    const line: PrescriptionLine = {
      id: `rxl_${Date.now()}`,
      drugName: rxDraft.drugName.trim(),
      strength: rxDraft.strength.trim(),
      quantity: rxDraft.quantity.trim() || "30",
      refills: refillsNum,
      sig: rxDraft.sig.trim(),
    };
    if (!line.drugName) return;
    onRxLinesChange([...rxLines, line]);
    setRxDialogOpen(false);
    setRxDraft({
      drugName: "",
      strength: "",
      quantity: "30",
      refills: "0",
      sig: "",
    });
  }, [rxDraft, rxLines, onRxLinesChange]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || disabled) return;
    setInput("");
    const uid = `u_${Date.now()}`;
    setMessages((m) => [...m, { id: uid, role: "user", body: q }]);
    setPending(true);

    try {
      let intent = parseEncounterIntent(q);
      if (shouldDisambiguateEncounterIntent(q, intent)) {
        try {
          const res = await fetch("/api/ai/encounter-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: q }),
          });
          if (res.ok) {
            const data = (await res.json()) as { intent?: string };
            const mapped = data.intent ?
              mapLlmLabelToEncounterIntent(data.intent)
            : null;
            if (mapped) intent = mapped;
          }
        } catch {
          /* keep regex intent */
        }
      }

      if (intent.kind === "draft_soap") {
        if (!activeAppointment || !patient) {
          setMessages((m) => [
            ...m,
            {
              id: `a_${Date.now()}`,
              role: "assistant",
              body: "Start an encounter for this patient, then ask again to generate a SOAP note.",
              meta: "Documentation",
            },
          ]);
        } else {
          await runSoapLlm(q);
          const fromDictation =
            looksLikeStructuredVisitDictation(q) ||
            /\b(create|generate|write|draft)\s+(a\s+)?soap\s+notes?\b/i.test(q) ||
            /\b(update|rewrite)\s+soap\b/i.test(q) ||
            /\bsoap\s+is\b/i.test(q) ||
            /\bthe\s+soap\s+is\b/i.test(q) ||
            /\bsoap\s+notes?\s*:/i.test(q);
          setMessages((m) => [
            ...m,
            {
              id: `a_${Date.now()}`,
              role: "assistant",
              body: fromDictation ?
                "Converted your visit dictation into SOAP — edit below or use the SOAP menu (by the patient name) for handoff."
              : "SOAP generated from chart context — edit below or use the SOAP menu for payer / provider handoff (demo).",
              meta: "SOAP (LLM)",
            },
          ]);
        }
      } else if (intent.kind === "draft_plan") {
        onPlanChange(DEMO_TREATMENT_PLAN);
        setPlanVisible(true);
        setMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: "assistant",
            body: "Treatment plan draft placed — edit in the Plan card below.",
            meta: "Documentation",
          },
        ]);
      } else if (intent.kind === "draft_rx") {
        openRxDialogFromPrompt(q);
        setMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: "assistant",
            body: "Use the prescription dialog to enter medication, strength, quantity, refills, and sig.",
            meta: "e-Prescribe (demo)",
          },
        ]);
      } else {
        const text = await runChartSearch(intent.query);
        setMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: "assistant",
            body: text,
            meta: "Chart lookup",
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          body: "Request failed — try again.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }, [
    input,
    disabled,
    onPlanChange,
    runChartSearch,
    activeAppointment,
    patient,
    runSoapLlm,
    openRxDialogFromPrompt,
  ]);

  const showDocsSection = soapVisible || planVisible || rxLines.length > 0;

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-care-card",
        disabled && "opacity-60",
      )}
    >
      <Dialog open={rxDialogOpen} onOpenChange={setRxDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add prescription line</DialogTitle>
            <DialogDescription>
              Demo e-prescribe — enter details, then add to the encounter.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label>Medication</Label>
              <Input
                className="h-9 text-xs"
                value={rxDraft.drugName}
                onChange={(e) =>
                  setRxDraft((d) => ({ ...d, drugName: e.target.value }))
                }
                placeholder="e.g. Lisinopril"
                disabled={visitFinalized || !canEditDocs}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Strength</Label>
                <Input
                  className="h-9 text-xs"
                  value={rxDraft.strength}
                  onChange={(e) =>
                    setRxDraft((d) => ({ ...d, strength: e.target.value }))
                  }
                  placeholder="10 mg"
                  disabled={visitFinalized || !canEditDocs}
                />
              </div>
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input
                  className="h-9 text-xs"
                  value={rxDraft.quantity}
                  onChange={(e) =>
                    setRxDraft((d) => ({ ...d, quantity: e.target.value }))
                  }
                  disabled={visitFinalized || !canEditDocs}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Refills</Label>
              <Input
                type="number"
                className="h-9 text-xs"
                value={rxDraft.refills}
                onChange={(e) =>
                  setRxDraft((d) => ({ ...d, refills: e.target.value }))
                }
                disabled={visitFinalized || !canEditDocs}
              />
            </div>
            <div className="space-y-1">
              <Label>Sig</Label>
              <Textarea
                className="min-h-[72px] text-xs"
                value={rxDraft.sig}
                onChange={(e) =>
                  setRxDraft((d) => ({ ...d, sig: e.target.value }))
                }
                placeholder="Directions"
                disabled={visitFinalized || !canEditDocs}
              />
            </div>
          </div>
          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRxDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={addRxLineFromDialog}
              disabled={
                visitFinalized ||
                !canEditDocs ||
                !rxDraft.drugName.trim()
              }
            >
              Add to encounter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Identity + schedule strip */}
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Encounter workspace
          </p>
          {patient ? (
            <>
              <div className="mt-1 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold leading-tight">
                    {patient.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MRN {patient.mrn} · DOB {patient.dateOfBirth}
                  </p>
                </div>
                {soapNote.trim().length > 0 && (
                  <div className="relative shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      aria-expanded={soapActionsOpen}
                      aria-haspopup="menu"
                      onClick={() => setSoapActionsOpen((o) => !o)}
                    >
                      <FileText className="size-3.5" />
                      SOAP
                      <ChevronDown className="size-3 opacity-70" />
                    </Button>
                    {soapActionsOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-30 cursor-default"
                          aria-label="Close SOAP actions"
                          onClick={() => setSoapActionsOpen(false)}
                        />
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50"
                            disabled={visitFinalized || !canEditDocs}
                            onClick={() => {
                              setSoapVisible(true);
                              setSoapActionsOpen(false);
                            }}
                          >
                            View / edit note
                          </button>
                          <div className="my-1 h-px bg-border" />
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus:bg-accent"
                            onClick={() => queueSoapHandoff("payer")}
                          >
                            Send to payer (demo)
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus:bg-accent"
                            onClick={() => queueSoapHandoff("provider")}
                          >
                            Send to provider (demo)
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No patient selected</p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md sm:items-end">
          <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
            Schedule
          </p>
          {appointments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No appointments on file</p>
          ) : (
            <ul className="w-full space-y-1 text-right text-xs">
              {appointments.slice(0, 3).map((a) => (
                <li key={a.id} className="truncate">
                  <span className="font-medium">{a.title}</span> ·{" "}
                  {new Date(a.scheduledFor).toLocaleString()}{" "}
                  <Badge variant="outline" className="ml-1 text-[0.6rem]">
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {canStartEncounter && onStartEncounter && (
            <Button
              type="button"
              size="sm"
              className="mt-2 w-full sm:w-auto"
              onClick={onStartEncounter}
            >
              Start encounter
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-[min(52vh,560px)] max-h-[min(68vh,720px)]">
        <div className="space-y-3 px-3 py-3 pr-4">
          <p className="border-b border-dashed border-border/60 pb-2 text-[0.65rem] text-muted-foreground">
            Chart search, SOAP (“generate soap note”, “update soap …”), treatment plan, or prescribe — type below.
          </p>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {msg.role === "assistant" && (
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Stethoscope className="size-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[min(100%,min(92vw,40rem))] rounded-lg px-3 py-2 text-xs leading-relaxed shadow-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-foreground",
                )}
              >
                {msg.role === "user" && (
                  <User className="mb-1 inline size-3 opacity-70" />
                )}
                <pre className="whitespace-pre-wrap font-sans">{msg.body}</pre>
                {msg.meta && (
                  <p className="mt-1.5 border-t border-border/40 pt-1 text-[0.65rem] text-muted-foreground">
                    {msg.meta}
                  </p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <User className="size-3.5" />
                </div>
              )}
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Working…
            </div>
          )}

          {showDocsSection && (
            <>
              <Separator className="my-4" />
              <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
                Documentation (edit anytime)
              </p>

              <div className="grid gap-3 lg:grid-cols-1">
                {soapVisible && (
                  <Card className="border-border/80">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ClipboardList className="size-4" />
                        SOAP note
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Subjective · Objective · Assessment · Plan
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        className="min-h-[140px] font-mono text-xs"
                        value={soapNote}
                        onChange={(e) => onSoapChange(e.target.value)}
                        disabled={visitFinalized || !canEditDocs}
                        spellCheck={false}
                        placeholder="S: … O: … A: … P: …"
                      />
                    </CardContent>
                  </Card>
                )}

                {planVisible && (
                  <Card className="border-border/80">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Treatment plan</CardTitle>
                      <CardDescription className="text-xs">
                        Goals, meds, education, follow-up
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        className="min-h-[120px] text-xs"
                        value={treatmentPlan}
                        onChange={(e) => onPlanChange(e.target.value)}
                        disabled={visitFinalized || !canEditDocs}
                      />
                    </CardContent>
                  </Card>
                )}

                {rxLines.length > 0 && (
                  <Card className="border-border/80">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Pill className="size-4" />
                        Prescription
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Order lines (demo e-prescribe)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-[0.7rem]"
                          disabled={visitFinalized || !canEditDocs}
                          onClick={() => setRxDialogOpen(true)}
                        >
                          <Plus className="size-3.5" />
                          Add line
                        </Button>
                      </div>
                      {rxLines.map((line, idx) => (
                        <div
                          key={line.id}
                          className="space-y-2 rounded-lg border bg-muted/15 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
                              Line {idx + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground"
                              disabled={visitFinalized || !canEditDocs}
                              onClick={() =>
                                onRxLinesChange(rxLines.filter((_, i) => i !== idx))
                              }
                              aria-label="Remove line"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-[0.65rem]">Medication</Label>
                              <Input
                                className="h-9 text-xs"
                                value={line.drugName}
                                onChange={(e) => {
                                  const next = [...rxLines];
                                  next[idx] = { ...line, drugName: e.target.value };
                                  onRxLinesChange(next);
                                }}
                                disabled={visitFinalized || !canEditDocs}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[0.65rem]">Strength</Label>
                              <Input
                                className="h-9 text-xs"
                                value={line.strength}
                                onChange={(e) => {
                                  const next = [...rxLines];
                                  next[idx] = { ...line, strength: e.target.value };
                                  onRxLinesChange(next);
                                }}
                                disabled={visitFinalized || !canEditDocs}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[0.65rem]">Quantity</Label>
                              <Input
                                className="h-9 text-xs"
                                value={line.quantity}
                                onChange={(e) => {
                                  const next = [...rxLines];
                                  next[idx] = { ...line, quantity: e.target.value };
                                  onRxLinesChange(next);
                                }}
                                disabled={visitFinalized || !canEditDocs}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[0.65rem]">Refills</Label>
                              <Input
                                type="number"
                                className="h-9 text-xs"
                                value={line.refills}
                                onChange={(e) => {
                                  const next = [...rxLines];
                                  next[idx] = {
                                    ...line,
                                    refills: Number(e.target.value) || 0,
                                  };
                                  onRxLinesChange(next);
                                }}
                                disabled={visitFinalized || !canEditDocs}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[0.65rem]">Sig (directions)</Label>
                            <Textarea
                              className="min-h-[56px] text-xs"
                              value={line.sig}
                              onChange={(e) => {
                                const next = [...rxLines];
                                next[idx] = { ...line, sig: e.target.value };
                                onRxLinesChange(next);
                              }}
                              disabled={visitFinalized || !canEditDocs}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 bg-background p-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            placeholder="Message the encounter… (chart search, “generate soap note”, “treatment plan”, “prescribe”)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[48px] flex-1 resize-none text-xs"
            disabled={disabled || pending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="h-[48px] w-11 shrink-0"
            disabled={disabled || pending || !input.trim()}
            onClick={() => void send()}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
