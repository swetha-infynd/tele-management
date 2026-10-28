import { cn } from "@/lib/utils";
import type { DailyCampaignSegment } from "@/lib/mock/api";

/**
 * Stacked horizontal bar showing which campaigns a person worked on during a
 * day. Segment width is proportional to dial activity; hovering the bar shows
 * dials / connects / approx. minutes per campaign.
 */

const BAR_COLORS = [
  "bg-purple-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

/** Stable per-campaign colour so the same campaign keeps the same colour across rows. */
function hashCampaign(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function campaignBarColor(campaign: string): string {
  return BAR_COLORS[hashCampaign(campaign) % BAR_COLORS.length] ?? "bg-slate-500";
}

export function CampaignDayBar({
  segments,
  className,
}: {
  segments: DailyCampaignSegment[];
  className?: string;
}) {
  if (segments.length === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>No campaign activity</span>
    );
  }

  const total = segments.reduce((s, seg) => s + seg.dials, 0);
  const title = segments
    .map((s) => `${s.campaign}: ${s.dials} dials · ${s.connects} connects · ~${s.minutes}m`)
    .join("\n");

  return (
    <div className={cn("min-w-[150px] max-w-[280px]", className)}>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        title={title}
        role="img"
        aria-label={title}
      >
        {segments.map((s) => (
          <div
            key={s.campaign}
            className={cn("h-full", campaignBarColor(s.campaign))}
            style={{ width: `${(s.dials / total) * 100}%`, minWidth: 3 }}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
        {segments.map((s) => (
          <span
            key={s.campaign}
            className="inline-flex max-w-full items-center gap-1 text-[10px] text-muted-foreground"
            title={`${s.campaign}: ${s.dials} dials`}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", campaignBarColor(s.campaign))} />
            <span className="truncate">{s.campaign}</span>
            <span className="tabular-nums">{s.dials}d</span>
          </span>
        ))}
      </div>
    </div>
  );
}
