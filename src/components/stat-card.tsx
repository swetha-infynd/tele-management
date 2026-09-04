import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  loading,
}: {
  label: string;
  value: string | number;
  delta?: number | undefined;
  icon?: LucideIcon | undefined;
  hint?: string | undefined;
  loading?: boolean | undefined;
}) {
  const DeltaIcon = delta === undefined ? Minus : delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {delta !== undefined && !loading && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-destructive",
              )}
            >
              <DeltaIcon className="size-3" />
              {Math.abs(delta)}%
            </span>
          )}
          <span>{hint ?? (delta !== undefined ? "vs yesterday" : "")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
