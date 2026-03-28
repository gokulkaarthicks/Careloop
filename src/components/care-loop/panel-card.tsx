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
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn("border-border/70 shadow-care-card", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
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
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}
