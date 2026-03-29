import type { CareLoopSnapshot } from "@/types/workflow";

export type RecoveryMetrics = {
  totalCases: number;
  completedCases: number;
  escalatedCases: number;
  failedCases: number;
  avgOpenMinutes: number;
  autoSubmitCount: number;
};

export function computeRecoveryMetrics(snapshot: CareLoopSnapshot): RecoveryMetrics {
  const cases = snapshot.recoveryCases ?? [];
  const totalCases = cases.length;
  const completedCases = cases.filter((c) => c.status === "completed").length;
  const escalatedCases = cases.filter((c) => c.status === "escalated").length;
  const failedCases = cases.filter((c) => c.status === "failed").length;
  const autoSubmitCount = snapshot.recoveryActions.filter(
    (a) => a.kind === "submit_appeal" && a.status === "completed",
  ).length;
  const avgOpenMinutes =
    totalCases === 0
      ? 0
      : Math.round(
          cases.reduce((sum, c) => {
            const end = Date.parse(c.closedAt ?? c.updatedAt);
            const start = Date.parse(c.openedAt);
            return Number.isFinite(end) && Number.isFinite(start)
              ? sum + (end - start) / 60000
              : sum;
          }, 0) / totalCases,
        );
  return {
    totalCases,
    completedCases,
    escalatedCases,
    failedCases,
    avgOpenMinutes,
    autoSubmitCount,
  };
}
