"use client";

import type { PharmacyOrder } from "@/types/workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

function orderTone(status: PharmacyOrder["status"]): "success" | "warning" | "neutral" | "outline" {
  switch (status) {
    case "picked_up":
      return "success";
    case "ready_for_pickup":
    case "filling":
    case "received":
      return "warning";
    case "cancelled":
      return "outline";
    default:
      return "neutral";
  }
}

export function PharmacyOrderCard({
  order,
  className,
}: {
  order: PharmacyOrder | null | undefined;
  className?: string;
}) {
  if (!order) {
    return (
      <Card className={cn("border-border/80 shadow-care-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pharmacy order</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">No order</CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/80 shadow-care-card", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Package className="size-4 text-primary" aria-hidden />
          Order
        </CardTitle>
        <Badge variant={orderTone(order.status)} className="text-[0.65rem] capitalize">
          {order.status.replaceAll("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        <p className="line-clamp-2">{order.nextAction}</p>
        {order.readyAt && (
          <p className="text-[0.65rem]">Ready {new Date(order.readyAt).toLocaleString()}</p>
        )}
      </CardContent>
    </Card>
  );
}
