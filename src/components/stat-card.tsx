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
  iconClassName,
  cardClassName,
}: {
  label: string;
  value: string | number;
  delta?: number | undefined;
  icon?: LucideIcon | undefined;
  hint?: string | undefined;
  loading?: boolean | undefined;
  iconClassName?: string | undefined;
  cardClassName?: string | undefined;
}) {
  const DeltaIcon = delta === undefined ? Minus : delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card
      className={cn(
        "group relative overflow-hidden bg-gradient-to-br from-card to-primary/5 border border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.995]",
        cardClassName,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && (
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-xs",
              iconClassName ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {delta !== undefined && !loading && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-transform group-hover:scale-105",
                delta >= 0
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-400",
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
