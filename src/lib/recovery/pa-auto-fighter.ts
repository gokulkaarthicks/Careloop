import { executeConnectorOperation } from "@/lib/recovery/connectors/router";
import { withConnectorRetry } from "@/lib/recovery/reliability";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { AppealBundle, RecoveryCase } from "@/types/recovery";

type GenerateAppealArgs = {
  recoveryCase: RecoveryCase;
};

function asPdfBase64(text: string): string {
  // Minimal valid PDF wrapper for MVP demos.
  const safe = text.replace(/[()]/g, "");
  const body = `%PDF-1.3
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Count 1 /Kids [3 0 R]>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>> >> >> endobj
4 0 obj <</Length ${safe.length + 60}>> stream
BT /F1 11 Tf 48 740 Td (${safe.slice(0, 2200)}) Tj ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000115 00000 n 
0000000240 00000 n 
0000000000 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
320
%%EOF`;
  if (typeof window !== "undefined") {
    return window.btoa(unescape(encodeURIComponent(body)));
  }
  return Buffer.from(body, "utf8").toString("base64");
}

function buildAppealBundle(args: GenerateAppealArgs): AppealBundle {
  const now = new Date().toISOString();
  const snap = useCareWorkflowStore.getState().snapshot;
  const pa = snap.priorAuthCases.find((x) => x.id === args.recoveryCase.priorAuthCaseId);
  const patient = snap.patients.find((p) => p.id === args.recoveryCase.patientId);
  const denialSummary = pa?.denialReason ?? args.recoveryCase.summary;
  const clinicalJustification = `Patient ${patient?.displayName ?? "Unknown"} has medically necessary need for ${pa?.drugName ?? "requested medication"} based on chart history, existing medication profile, and risk of treatment interruption.`;
  const checklist = [
    "Most recent progress note and assessment",
    "Failed therapy history and contraindication detail",
    "Current medication list and adherence context",
    "Plan-specific denial code and policy reference",
  ];
  const letter = [
    `Prior Authorization Appeal`,
    `Case: ${args.recoveryCase.id}`,
    `Patient: ${patient?.displayName ?? args.recoveryCase.patientId}`,
    `Drug: ${pa?.drugName ?? "N/A"}`,
    "",
    `Denial summary: ${denialSummary}`,
    "",
    `Clinical justification: ${clinicalJustification}`,
    "",
    "Supporting evidence:",
    ...checklist.map((x) => `- ${x}`),
    "",
    "Request: Please overturn this denial and authorize treatment.",
  ].join("\n");
  return {
    id: `appeal_${Date.now()}`,
    recoveryCaseId: args.recoveryCase.id,
    patientId: args.recoveryCase.patientId,
    priorAuthCaseId: args.recoveryCase.priorAuthCaseId,
    generatedAt: now,
    generatedBy: "pa_auto_fighter",
    denialSummary,
    clinicalJustification,
    supportingEvidenceChecklist: checklist,
    letterMarkdown: letter,
    pdfFileName: `appeal_${args.recoveryCase.id}.pdf`,
    pdfBase64: asPdfBase64(letter),
    submissionDeadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  };
}

export async function runPaAutoFighter(recoveryCase: RecoveryCase): Promise<AppealBundle> {
  const store = useCareWorkflowStore.getState();
  const bundle = buildAppealBundle({ recoveryCase });
  store.saveAppealBundle(bundle);
  store.appendRecoveryAction({
    recoveryCaseId: recoveryCase.id,
    kind: "generate_appeal_package",
    status: "completed",
    ownerRole: "payer",
    priority: "high",
    summary: "Appeal package generated",
    detail: bundle.denialSummary,
    completedAt: new Date().toISOString(),
  });
  store.pushWorkflowEngineEvent({
    kind: "appeal_generated",
    title: "PA Auto-Fighter generated appeal package",
    detail: `${bundle.pdfFileName} ready for review and submission.`,
    trigger: "Recovery planner detected PA denial",
    decision: "Generate appeal letter + supporting checklist",
    action: "Build evidence bundle and attach downloadable PDF",
    result: "Provider/payer can submit appeal immediately",
    patientId: recoveryCase.patientId,
    prescriptionId: recoveryCase.prescriptionId,
    role: "payer",
  });

  const connectorRunId = `cr_${Date.now()}`;
  store.logConnectorRun({
    id: connectorRunId,
    recoveryCaseId: recoveryCase.id,
    connectorKey: "mock_default",
    operation: "submit_appeal",
    status: "running",
    startedAt: new Date().toISOString(),
    idempotencyKey: `submit_appeal_${recoveryCase.id}`,
    requestSummary: "Submit generated appeal package",
  });
  const { connector, result } = await withConnectorRetry(
    recoveryCase.id,
    "submit_appeal",
    () =>
      executeConnectorOperation("submit_appeal", {
        recoveryCaseId: recoveryCase.id,
        patientId: recoveryCase.patientId,
        appointmentId: recoveryCase.appointmentId,
        prescriptionId: recoveryCase.prescriptionId,
        connectorPayload: recoveryCase.connectorPayload,
      }),
  );
  store.logConnectorRun({
    id: connectorRunId,
    recoveryCaseId: recoveryCase.id,
    connectorKey: connector?.key ?? "none",
    operation: "submit_appeal",
    status: result.ok ? "completed" : "failed",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    idempotencyKey: `submit_appeal_${recoveryCase.id}`,
    requestSummary: "Submit generated appeal package",
    responseSummary: result.summary,
    error: result.error,
  });
  store.pushWorkflowEngineEvent({
    kind: result.ok ? "appeal_submitted" : "recovery_escalated",
    title: result.ok ? "Appeal submitted to connector" : "Appeal submission failed",
    detail: result.summary,
    patientId: recoveryCase.patientId,
    prescriptionId: recoveryCase.prescriptionId,
    role: "payer",
  });
  return bundle;
}
