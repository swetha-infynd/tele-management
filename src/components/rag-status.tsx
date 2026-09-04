import { Line, LineChart, ResponsiveContainer } from "recharts";

import { Badge } from "@/components/ui/badge";
import type { PerfStatus } from "@/lib/mock/types";

const LABEL: Record<PerfStatus, string> = {
  "on-target": "On target",
  borderline: "Borderline",
  below: "Below target",
};

const DOT: Record<PerfStatus, string> = {
  "on-target": "bg-emerald-500",
  borderline: "bg-amber-500",
  below: "bg-red-500",
};

/** Red / amber / green status pill built on the default shadcn Badge. */
export function RagBadge({ status, label }: { status: PerfStatus; label?: string }) {
  return (
    <Badge variant="outline" className="gap-1.5 whitespace-nowrap font-normal">
      <span className={`size-2 rounded-full ${DOT[status]}`} aria-hidden />
      {label ?? LABEL[status]}
    </Badge>
  );
}

export function RagDot({ status }: { status: PerfStatus }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${DOT[status]}`}
      title={LABEL[status]}
      aria-label={LABEL[status]}
    />
  );
}

/** Tiny week-on-week sparkline for trend columns. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const data = values.map((v, i) => ({ i, v }));
  if (data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className={className ?? "h-8 w-24"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
