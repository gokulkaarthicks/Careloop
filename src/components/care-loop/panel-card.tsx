import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PanelCard({
  title,
  description,
  children,
  className,
  action,
  /** When used in a grid row, stretch to match the tallest sibling card. */
  fillHeight = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  fillHeight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-border/70 shadow-care-card",
        fillHeight && "flex h-full min-h-0 flex-col",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-xs leading-relaxed">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent
        className={cn(
          "text-sm",
          fillHeight && "flex min-h-0 flex-1 flex-col",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
