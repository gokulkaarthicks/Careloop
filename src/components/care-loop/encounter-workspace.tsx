"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fetchEncounterIntent } from "@/lib/encounter-intent-remote";
import { extractMedicationFromPrescribePrompt } from "@/lib/prescribe-prompt";
import { DEMO_TREATMENT_PLAN } from "@/lib/demo/canned-plan";
import type { Patient, Appointment } from "@/types/workflow";
import type { PatientClinicalSummary } from "@/types/workflow";
import type { PrescriptionLine } from "@/types/workflow";
import type { PreVisitAgentOutput } from "@/types/pre-visit-agent";
import {
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
  /** Workflow hint (kept inside the card so the page shell stays fixed-height). */
  nextAction?: string | null;
};

function truncateList(
  items: string[],
  max: number,
  maxLen: number,
): string {
  const slice = items.slice(0, max).join("; ");
  if (slice.length <= maxLen) return slice || "-";
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
  nextAction = null,
}: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [soapEditOpen, setSoapEditOpen] = useState(false);
  const [planEditOpen, setPlanEditOpen] = useState(false);
  const [rxListOpen, setRxListOpen] = useState(false);
  const [rxDialogOpen, setRxDialogOpen] = useState(false);
  const [rxDraft, setRxDraft] = useState({
    drugName: "",
    strength: "",
    quantity: "30",
    refills: "0",
    sig: "",
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Per-patient chat threads so switching patients preserves each conversation. */
  const encounterThreadsRef = useRef<Record<string, ChatMessage[]>>({});
  const lastPatientIdRef = useRef<string | null>(null);
  /** Avoid merging briefing into the previous patient's thread in the same commit as a switch. */
  const skipNextBriefMergeRef = useRef(false);

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
        `Allergies: ${allergies}\nActive meds: ${meds || "-"}\nProblems: ${probs || "-"}`,
      );
    }

    if (activeAppointment) {
      lines.push(
        `Visit: ${activeAppointment.title}\nWhen: ${new Date(activeAppointment.scheduledFor).toLocaleString()}\nNext: ${activeAppointment.nextAction}`,
      );
    } else {
      lines.push("No active visit slot - pick a patient with an appointment.");
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

  // Swap encounter thread when patient changes; persist the outgoing thread first.
  useEffect(() => {
    skipNextBriefMergeRef.current = true;
    const prevId = lastPatientIdRef.current;
    if (prevId !== null && prevId !== patientId) {
      encounterThreadsRef.current[prevId] = messages;
    }
    lastPatientIdRef.current = patientId;

    const saved = encounterThreadsRef.current[patientId];
    if (saved && saved.length > 0) {
      setMessages(saved);
    } else {
      setMessages(buildConciseBrief());
    }
    // Only re-run when patientId changes - do not depend on buildConciseBrief or messages
    // or chat resets when preVisit/briefing loads and wipes history.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- patient switch only; brief uses latest render
  }, [patientId]);

  // Refresh the pinned "Encounter briefing" bubble when chart/pre-visit data arrives, without wiping chat.
  useEffect(() => {
    if (skipNextBriefMergeRef.current) {
      skipNextBriefMergeRef.current = false;
      return;
    }
    setMessages((prev) => {
      const fresh = buildConciseBrief();
      const first = fresh[0];
      if (!first) return prev;
      const idx = prev.findIndex((m) => m.id === "brief");
      if (idx < 0) return prev;
      const same =
        prev[idx].body === first.body &&
        (prev[idx].meta ?? "") === (first.meta ?? "");
      if (same) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        body: first.body,
        meta: first.meta,
      };
      encounterThreadsRef.current[patientId] = next;
      return next;
    });
  }, [buildConciseBrief, patientId]);

  useEffect(() => {
    setInput("");
    setSoapEditOpen(false);
    setPlanEditOpen(false);
    setRxListOpen(false);
    setRxDialogOpen(false);
  }, [patientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
            "No structured matches - try a medication name, ICD-10 code, or allergy.");
      return lines;
    },
    [patientId],
  );

  const runSoapLlm = useCallback(
    async (providerMessage: string): Promise<string> => {
      if (!patient || !activeAppointment) {
        return "";
      }
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
      const data = (await res.json()) as {
        soap?: string;
        chatAcknowledgment?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "SOAP request failed");
      }
      onSoapChange(data.soap ?? "");
      return (
        data.chatAcknowledgment?.trim() ||
        "SOAP updated - review and edit via the SOAP button below."
      );
    },
    [patient, activeAppointment, clinical, onSoapChange],
  );

  const queueSoapHandoff = useCallback((destination: "payer" | "provider") => {
    setSoapEditOpen(false);
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
    let drug = extractMedicationFromPrescribePrompt(q);
    if (!drug) {
      const parts = q.trim().split(/\s+/);
      drug = parts.slice(1).join(" ").slice(0, 160) || parts[0] || "";
    }
    setRxDraft((d) => ({
      ...d,
      drugName: drug,
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
      const intent = await fetchEncounterIntent(q);

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
          const ack = await runSoapLlm(q);
          setMessages((m) => [
            ...m,
            {
              id: `a_${Date.now()}`,
              role: "assistant",
              body: `${ack} Open SOAP below to edit or send handoff when ready.`,
              meta: "SOAP (LLM)",
            },
          ]);
        }
      } else if (intent.kind === "draft_plan") {
        onPlanChange(DEMO_TREATMENT_PLAN);
        setMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: "assistant",
            body: "Treatment plan draft placed - open Plan below to review or edit.",
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setMessages((m) => [
        ...m,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          body: msg,
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

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-care-card",
        disabled && "opacity-60",
      )}
    >
      <Dialog open={rxDialogOpen} onOpenChange={setRxDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add prescription line</DialogTitle>
            <DialogDescription>
              Demo e-prescribe - enter details, then add to the encounter.
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

      <Dialog open={soapEditOpen} onOpenChange={setSoapEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              SOAP note
            </DialogTitle>
            <DialogDescription>
              Subjective · Objective · Assessment · Plan
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[200px] font-mono text-xs"
            value={soapNote}
            onChange={(e) => onSoapChange(e.target.value)}
            disabled={visitFinalized || !canEditDocs}
            spellCheck={false}
            placeholder="S: … O: … A: … P: …"
          />
          <DialogFooter className="flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={visitFinalized || !canEditDocs || !soapNote.trim()}
                onClick={() => queueSoapHandoff("payer")}
              >
                Send to payer (demo)
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={visitFinalized || !canEditDocs || !soapNote.trim()}
                onClick={() => queueSoapHandoff("provider")}
              >
                Send to provider (demo)
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={() => setSoapEditOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planEditOpen} onOpenChange={setPlanEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" />
              Treatment plan
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Goals, meds, education, follow-up. The plan updates when you ask for a
              &quot;treatment plan&quot; in the encounter chat (demo inserts a draft), when you edit
              here, or when a saved visit draft is loaded. Finalize writes it to the encounter
              record.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[180px] text-xs"
            value={treatmentPlan}
            onChange={(e) => onPlanChange(e.target.value)}
            disabled={visitFinalized || !canEditDocs}
          />
          <DialogFooter>
            <Button type="button" onClick={() => setPlanEditOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rxListOpen} onOpenChange={setRxListOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="size-4" />
              Prescription
            </DialogTitle>
            <DialogDescription>Order lines (demo e-prescribe)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
            {rxLines.length === 0 ? (
              <p className="text-xs text-muted-foreground">No order lines yet.</p>
            ) : (
              rxLines.map((line, idx) => (
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
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setRxListOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Identity + schedule strip */}
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Encounter workspace
          </p>
          {patient ? (
            <>
              <div className="mt-1">
                <p className="truncate text-lg font-semibold leading-tight">
                  {patient.displayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  MRN {patient.mrn} · DOB {patient.dateOfBirth}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No patient selected</p>
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:max-w-md sm:items-end sm:text-right">
          <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
            Schedule
          </p>
          {appointments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No appointments on file</p>
          ) : (
            <ul className="w-full space-y-1 text-xs sm:text-right">
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
              className="mt-1 w-full sm:mt-0 sm:w-auto"
              onClick={onStartEncounter}
            >
              Start encounter
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="absolute inset-0 h-full w-full overflow-hidden">
          <div className="space-y-3 px-3 py-3 pr-4">
            <p className="border-b border-dashed border-border/60 pb-2 text-[0.65rem] text-muted-foreground">
              Chart search, SOAP (“generate soap note”, “update soap …”), treatment plan, or prescribe - type below.
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

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="shrink-0 border-t border-border/60 bg-muted/10 px-3 py-2.5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              Documentation
            </span>
            {nextAction ? (
              <p className="max-w-[min(100%,28rem)] truncate text-right text-[0.65rem] text-muted-foreground">
                <span className="font-medium text-foreground">Next: </span>
                {nextAction}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={soapNote.trim() ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 px-2.5 text-xs"
              disabled={visitFinalized || !canEditDocs}
              onClick={() => setSoapEditOpen(true)}
              aria-label="SOAP note"
              title="SOAP note"
            >
              <FileText className="size-4 shrink-0" />
              <span>SOAP</span>
            </Button>
            <Button
              type="button"
              variant={treatmentPlan.trim() ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 px-2.5 text-xs"
              disabled={visitFinalized || !canEditDocs}
              onClick={() => setPlanEditOpen(true)}
              aria-label="Treatment plan"
              title="Treatment plan"
            >
              <ClipboardList className="size-4 shrink-0" />
              <span>Plan</span>
            </Button>
            <Button
              type="button"
              variant={rxLines.length > 0 ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 px-2.5 text-xs"
              disabled={visitFinalized || !canEditDocs}
              onClick={() => setRxListOpen(true)}
              aria-label="Prescriptions"
              title="Prescriptions"
            >
              <Pill className="size-4 shrink-0" />
              <span>Rx</span>
              {rxLines.length > 0 ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem] font-normal tabular-nums">
                  {rxLines.length}
                </Badge>
              ) : null}
            </Button>
          </div>
          <div className="flex min-h-0 w-full min-w-0 gap-2">
            <Textarea
              placeholder="Message the encounter… (chart search, “generate soap note”, “treatment plan”, “prescribe”)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[52px] min-w-0 flex-1 resize-none text-xs"
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
              className="h-[52px] w-11 shrink-0 self-end"
              disabled={disabled || pending || !input.trim()}
              onClick={() => void send()}
              aria-label="Send"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
