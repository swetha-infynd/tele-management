/**
 * Campaign-level analytics, week-on-week history, automated consistency
 * flagging and dialler-data interpretation. Pure reads over the in-memory
 * database — the shapes match what a real analytics endpoint would return.
 */
import { getDb } from "./db";
import { CAMPAIGNS, TODAY, addDays, iso } from "./seed";
import type {
  CampaignSummary,
  ConsistencyFlag,
  DiallerAnalysis,
  DiallerFinding,
  PerfStatus,
  PerformanceRecord,
  WeekPoint,
} from "./types";

export const ALL_CAMPAIGNS = [...CAMPAIGNS];

export function weekStart(date: string | Date): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return iso(addDays(d, -day));
}

export function weekLabel(weekStartIso: string): string {
  const d = new Date(`${weekStartIso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Last `n` completed weeks (most recent last). Excludes the in-progress week. */
export function lastWeeks(n: number, includeCurrent = false): string[] {
  const current = weekStart(TODAY);
  const out: string[] = [];
  const offset = includeCurrent ? 0 : 1;
  for (let i = n - 1 + offset; i >= offset; i--) {
    out.push(weekStart(addDays(new Date(`${current}T00:00:00`), -7 * i)));
  }
  return out;
}

export function statusFor(attainment: number): PerfStatus {
  if (attainment >= 100) return "on-target";
  if (attainment >= 80) return "borderline";
  return "below";
}

interface Scope {
  campaign?: string | undefined;
  employeeId?: string | undefined;
  team?: string | undefined;
}

function records(scope: Scope): PerformanceRecord[] {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  return db.performance.filter((p) => {
    if (scope.employeeId && p.employeeId !== scope.employeeId) return false;
    if (scope.campaign && scope.campaign !== "all" && p.campaign !== scope.campaign) return false;
    if (scope.team && scope.team !== "all" && empById.get(p.employeeId)?.team !== scope.team)
      return false;
    return true;
  });
}

/** Weekly sales target applied to a single agent for the given scope. */
export function agentWeeklyTarget(campaign?: string): number {
  const base = getDb().settings.agentWeeklySalesTarget;
  return campaign && campaign !== "all" ? Math.max(3, Math.round(base * 0.6)) : base;
}

export function campaignWeeklyTarget(campaign?: string): number {
  const targets = getDb().settings.campaignWeeklySalesTarget;
  if (campaign && campaign !== "all") return targets[campaign] ?? 50;
  return Object.values(targets).reduce((s, v) => s + v, 0);
}

/** Week-on-week series for a campaign, a team, an agent, or the whole floor. */
export function weeklySeries(
  scope: Scope & { weeks?: number; target?: number; includeCurrent?: boolean } = {},
): WeekPoint[] {
  const weeks = scope.weeks ?? 6;
  const keys = lastWeeks(weeks, scope.includeCurrent ?? true);
  const target =
    scope.target ??
    (scope.employeeId ? agentWeeklyTarget(scope.campaign) : campaignWeeklyTarget(scope.campaign));
  const buckets = new Map<string, WeekPoint>(
    keys.map((k) => [
      k,
      {
        weekStart: k,
        label: `w/c ${weekLabel(k)}`,
        calls: 0,
        connects: 0,
        leads: 0,
        sales: 0,
        revenue: 0,
        conversion: 0,
        target,
        attainment: 0,
        status: "below" as PerfStatus,
      },
    ]),
  );
  for (const p of records(scope)) {
    const k = weekStart(p.date);
    const b = buckets.get(k);
    if (!b) continue;
    b.calls += p.callsMade;
    b.connects += p.callsConnected;
    b.leads += p.leadsGenerated;
    b.sales += p.sales;
    b.revenue += p.revenue;
  }
  return keys.map((k) => {
    const b = buckets.get(k)!;
    const attainment = target ? Number(((b.sales / target) * 100).toFixed(1)) : 0;
    return {
      ...b,
      conversion: b.leads ? Number(((b.sales / b.leads) * 100).toFixed(1)) : 0,
      attainment,
      status: statusFor(attainment),
    };
  });
}

/** How many of the most recent completed weeks in a row were below target. */
export function weeksBelowTarget(employeeId: string, campaign?: string, weeks = 6): number {
  const series = weeklySeries({ employeeId, campaign, weeks, includeCurrent: false });
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if ((series[i]?.attainment ?? 0) < 100) streak++;
    else break;
  }
  return streak;
}

/** Agents whose week-on-week pattern warrants an automated prompt. */
export function consistencyFlags(campaign?: string, minWeeks = 3): ConsistencyFlag[] {
  const db = getDb();
  const agents = db.employees.filter((e) => e.role === "agent" && e.status === "Active");
  const flags: ConsistencyFlag[] = [];
  for (const a of agents) {
    const series = weeklySeries({
      employeeId: a.id,
      campaign,
      weeks: 6,
      includeCurrent: false,
    });
    if (series.every((w) => w.calls === 0)) continue;
    let streak = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      if ((series[i]?.attainment ?? 0) < 100) streak++;
      else break;
    }
    if (streak < minWeeks) continue;
    const recent = series.slice(-3).map((w) => w.sales);
    const direction =
      (recent[2] ?? 0) < (recent[0] ?? 0) - 1
        ? "declining"
        : (recent[2] ?? 0) > (recent[0] ?? 0) + 1
          ? "recovering"
          : "flat";
    const last = series[series.length - 1]!;
    const primaryCampaign =
      campaign && campaign !== "all"
        ? campaign
        : (mostDialledCampaign(a.id) ?? "Multiple campaigns");
    flags.push({
      employeeId: a.id,
      name: a.name,
      team: a.team,
      campaign: primaryCampaign,
      weeksBelow: streak,
      severity: streak >= 4 ? "critical" : "warning",
      trendDirection: direction,
      message: `${a.name} has finished below the weekly sales target for ${streak} weeks running on ${primaryCampaign} (last week ${last.sales}/${last.target}, ${last.attainment}% of target, trend ${direction}).`,
      action:
        direction === "declining"
          ? "Book a coaching session this week and review recent call recordings for objection handling."
          : direction === "recovering"
            ? "Trend is improving — keep the current coaching plan and re-check next week."
            : "Reassign a batch of fresh leads and set a short daily check-in for the next five days.",
    });
  }
  return flags.sort((a, b) => b.weeksBelow - a.weeksBelow || a.name.localeCompare(b.name));
}

export function mostDialledCampaign(employeeId: string): string | null {
  const counts = new Map<string, number>();
  for (const p of records({ employeeId })) {
    counts.set(p.campaign, (counts.get(p.campaign) ?? 0) + p.callsMade);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Top-layer rollup: one row per campaign, always the same metric set. */
export function campaignOverview(from: string, to: string): CampaignSummary[] {
  const db = getDb();
  const prevFrom = shiftRange(from, to).from;
  const prevTo = shiftRange(from, to).to;
  return getDb().campaigns.map((c) => c.name).map((campaign) => {
    const inRange = db.performance.filter(
      (p) => p.campaign === campaign && p.date >= from && p.date <= to,
    );
    const prev = db.performance.filter(
      (p) => p.campaign === campaign && p.date >= prevFrom && p.date <= prevTo,
    );
    const sum = (rows: PerformanceRecord[], k: keyof PerformanceRecord) =>
      rows.reduce((s, r) => s + (r[k] as number), 0);
    const calls = sum(inRange, "callsMade");
    const connects = sum(inRange, "callsConnected");
    const leads = sum(inRange, "leadsGenerated");
    const sales = sum(inRange, "sales");
    const revenue = sum(inRange, "revenue");
    const prevSales = sum(prev, "sales");
    const prevRevenue = sum(prev, "revenue");
    const days = Math.max(1, dayDiff(from, to) + 1);
    const salesTarget = Math.round((campaignWeeklyTarget(campaign) / 7) * days);
    const attainment = salesTarget ? Number(((sales / salesTarget) * 100).toFixed(1)) : 0;
    const talk = sum(inRange, "talkTimeSec");
    return {
      campaign,
      agents: new Set(inRange.map((p) => p.employeeId)).size,
      calls,
      connects,
      connectRate: calls ? Number(((connects / calls) * 100).toFixed(1)) : 0,
      leads,
      sales,
      revenue,
      conversion: leads ? Number(((sales / leads) * 100).toFixed(1)) : 0,
      avgTalkTimeSec: connects ? Math.round(talk / connects) : 0,
      salesTarget,
      attainment,
      status: statusFor(attainment),
      wowSales: prevSales ? Number((((sales - prevSales) / prevSales) * 100).toFixed(1)) : 0,
      wowRevenue: prevRevenue
        ? Number((((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
        : 0,
      flags: consistencyFlags(campaign).length,
    };
  });
}

function dayDiff(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 864e5,
  );
}

/** The equally-long window immediately before [from, to]. */
function shiftRange(from: string, to: string) {
  const len = dayDiff(from, to) + 1;
  return {
    from: iso(addDays(new Date(`${from}T00:00:00`), -len)),
    to: iso(addDays(new Date(`${to}T00:00:00`), -len)),
  };
}

/** Interprets the raw dialler feed rather than just totalling it. */
export function diallerAnalysis(campaign: string | undefined, days = 14): DiallerAnalysis {
  const from = iso(addDays(TODAY, -days + 1));
  const rows = records({ campaign }).filter((p) => p.date >= from);
  const hourMap = new Map<number, { dials: number; connects: number; noAnswer: number }>();
  let dialAttempts = 0;
  let connects = 0;
  let noAnswer = 0;
  let busy = 0;
  let voicemail = 0;
  let dnc = 0;
  let talk = 0;
  for (const p of rows) {
    dialAttempts += p.dialAttempts;
    connects += p.callsConnected;
    noAnswer += p.noAnswer;
    busy += p.busy;
    voicemail += p.voicemail;
    dnc += p.dnc;
    talk += p.talkTimeSec;
    for (const h of p.hourly) {
      const cur = hourMap.get(h.hour) ?? { dials: 0, connects: 0, noAnswer: 0 };
      cur.dials += h.dials;
      cur.connects += h.connects;
      cur.noAnswer += h.noAnswer;
      hourMap.set(h.hour, cur);
    }
  }
  const hourly = [...hourMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      dials: v.dials,
      connects: v.connects,
      noAnswer: v.noAnswer,
      connectRate: v.dials ? Number(((v.connects / v.dials) * 100).toFixed(1)) : 0,
      noAnswerRate: v.dials ? Number(((v.noAnswer / v.dials) * 100).toFixed(1)) : 0,
    }))
    .filter((h) => h.dials > 0);

  const ranked = [...hourly].sort((a, b) => b.connectRate - a.connectRate);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const pct = (n: number) => (dialAttempts ? Number(((n / dialAttempts) * 100).toFixed(1)) : 0);
  const connectRate = pct(connects);
  const noAnswerRate = pct(noAnswer);
  const late = hourly.filter((h) => Number(h.hour.slice(0, 2)) >= 15);
  const early = hourly.filter((h) => Number(h.hour.slice(0, 2)) < 15);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
  const lateNa = avg(late.map((h) => h.noAnswerRate));
  const earlyNa = avg(early.map((h) => h.noAnswerRate));
  const avgTalk = connects ? Math.round(talk / connects) : 0;

  const findings: DiallerFinding[] = [];
  if (lateNa - earlyNa > 3) {
    findings.push({
      title: "No-answer rate climbs after 15:00",
      detail: `No-answer sits at ${earlyNa.toFixed(1)}% before 15:00 and ${lateNa.toFixed(1)}% after it — a ${(lateNa - earlyNa).toFixed(1)} point deterioration across the same lead pool.`,
      severity: lateNa - earlyNa > 6 ? "critical" : "warning",
    });
  }
  if (connectRate < 45) {
    findings.push({
      title: "Connect rate below benchmark",
      detail: `Only ${connectRate}% of ${dialAttempts.toLocaleString("en-GB")} dial attempts connected, against a 45% floor benchmark. Data quality on the current list is the most likely driver.`,
      severity: connectRate < 38 ? "critical" : "warning",
    });
  }
  if (avgTalk < 150) {
    findings.push({
      title: "Short average talk time",
      detail: `Connected calls average ${avgTalk}s. Conversations ending under 2.5 minutes rarely reach the pitch stage.`,
      severity: "warning",
    });
  }
  if (pct(voicemail) > 12) {
    findings.push({
      title: "High voicemail share",
      detail: `${pct(voicemail)}% of attempts drop to voicemail, suggesting a large slice of the list is mobile-only or out of shift hours.`,
      severity: "info",
    });
  }
  if (!findings.length) {
    findings.push({
      title: "Dialler behaviour is stable",
      detail: `Connect rate ${connectRate}%, no-answer ${noAnswerRate}%, average talk time ${avgTalk}s — all within expected ranges for this window.`,
      severity: "info",
    });
  }

  const suggestions = [
    lateNa - earlyNa > 3
      ? `Shift roughly 20% of the post-15:00 dial volume into the ${best?.hour ?? "10:00"} window, where connect rate peaks at ${best?.connectRate ?? 0}%.`
      : `Protect the ${best?.hour ?? "10:00"} block — it is the strongest connect window at ${best?.connectRate ?? 0}%.`,
    `Retire or re-cycle numbers that have hit three consecutive no-answers; they account for the bulk of the ${noAnswerRate}% no-answer rate.`,
    avgTalk < 170
      ? "Run a five-minute opener drill at shift start; talk time below 170s correlates with the lowest converting agents on this campaign."
      : "Talk time is healthy — focus coaching on the close rather than call length.",
    `Move the ${worst?.hour ?? "16:00"} hour to callback and admin work; it is the weakest connect window at ${worst?.connectRate ?? 0}%.`,
  ];

  return {
    campaign: campaign && campaign !== "all" ? campaign : "All campaigns",
    dialAttempts,
    connects,
    connectRate,
    noAnswerRate,
    busyRate: pct(busy),
    voicemailRate: pct(voicemail),
    dncRate: pct(dnc),
    avgTalkTimeSec: avgTalk,
    hourly,
    bestHour: best?.hour ?? "—",
    worstHour: worst?.hour ?? "—",
    findings,
    suggestions,
  };
}
