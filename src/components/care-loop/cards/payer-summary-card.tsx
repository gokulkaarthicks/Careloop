"use client";

import type { PayerStatus } from "@/types/workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

function claimTone(s: PayerStatus["claimStatus"]): "success" | "warning" | "neutral" | "outline" {
  switch (s) {
    case "paid":
    case "approved":
      return "success";
    case "denied":
      return "outline";
    case "submitted":
      return "warning";
    default:
      return "neutral";
  }
}

export function PayerSummaryCard({
  payerStatus,
  className,
}: {
  payerStatus: PayerStatus | null | undefined;
  className?: string;
}) {
  if (!payerStatus) {
    return (
      <Card className={cn("border-border/80 shadow-care-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Payer</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">No payer row</CardContent>
      </Card>
    );
  }

  const score = payerStatus.closureCompletionScore ?? 0;

  return (
    <Card className={cn("border-border/80 shadow-care-card", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="size-4 text-primary" aria-hidden />
          Payer
        </CardTitle>
        <Badge variant={claimTone(payerStatus.claimStatus)} className="text-[0.65rem] capitalize">
          {payerStatus.claimStatus}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Closure score</span>
          <span className="tabular-nums font-medium text-foreground">{score}%</span>
        </div>
        <Progress value={score} className="h-1.5" />
        {payerStatus.authorizedAmountUsd != null && (
          <p className="text-muted-foreground">
            Authorized <span className="tabular-nums text-foreground">${payerStatus.authorizedAmountUsd}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
