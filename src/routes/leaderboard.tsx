import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Medal, Trophy } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { RagBadge, Sparkline } from "@/components/rag-status";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compactInr, initials, num, pct } from "@/lib/format";
import { api } from "@/lib/mock/api";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Sales Leaderboard — Campaign Rankings | Apex CRM" },
      {
        name: "description",
        content:
          "Campaign-filtered leaderboards with red/amber/green target status, week-on-week sales trends and automated flags for agents below target.",
      },
      { property: "og:title", content: "Sales Leaderboard | Apex CRM" },
      {
        property: "og:description",
        content: "Rank agents per campaign with target status and week-on-week trend.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type Period = "daily" | "weekly" | "monthly";
type Metric = "sales" | "revenue" | "conversion" | "calls" | "qualityScore";

const METRIC_LABEL: Record<Metric, string> = {
  sales: "Sales",
  revenue: "Revenue",
  conversion: "Conversion",
  calls: "Calls",
  qualityScore: "Quality score",
};

function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [metric, setMetric] = useState<Metric>("sales");
  const [campaign, setCampaign] = useState<string>("all");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.listCampaigns,
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard", period, metric, campaign],
    queryFn: () => api.leaderboard(period, metric, undefined, campaign),
  });
  const { data: flags = [] } = useQuery({
    queryKey: ["consistency-flags", campaign],
    queryFn: () => api.consistencyFlags(campaign),
  });

  const podium = rows.slice(0, 3);
  const icons = [Crown, Trophy, Medal];
  const flagged = new Map(flags.map((f) => [f.employeeId, f]));

  return (
    <AppShell>
      <PageHeader
        title="Leaderboard"
        description="Rank the floor campaign by campaign, with target status and week-on-week movement."
        actions={
          <>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {METRIC_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportMenu
              filename={`leaderboard-${period}-${campaign}`}
              columns={[
                "Rank",
                "Agent",
                "Client",
                "Campaign",
                "Sales",
                "Target",
                "Attainment %",
                "Status",
                "WoW %",
                "Weeks below",
                "Revenue",
                "Calls",
                "Conversion",
                "QA",
              ]}
              rows={rows.map((r) => [
                r.rank,
                r.name,
                r.team,
                r.campaign,
                r.sales,
                r.target,
                r.attainment,
                r.status,
                r.wow,
                r.weeksBelow,
                r.revenue,
                r.calls,
                r.conversion,
                r.qualityScore,
              ])}
            />
          </>
        }
      />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="daily">Today</TabsTrigger>
          <TabsTrigger value="weekly">This week</TabsTrigger>
          <TabsTrigger value="monthly">This month</TabsTrigger>
        </TabsList>
      </Tabs>

      {flags.length > 0 && (
        <Alert>
          <AlertTitle>
            {flags.length} agent{flags.length === 1 ? "" : "s"} below target for 3+ weeks
          </AlertTitle>
          <AlertDescription>
            {flags
              .slice(0, 4)
              .map((f) => `${f.name} (${f.weeksBelow}w, ${f.trendDirection})`)
              .join(" · ")}
            {flags.length > 4 ? ` and ${flags.length - 4} more.` : ""}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {podium.map((r, i) => {
          const Icon = icons[i] ?? Medal;
          return (
            <Card key={r.employeeId}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <Avatar className="size-10">
                  <AvatarFallback>{initials(r.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <CardDescription>
                    {r.team} · {r.campaign}
                  </CardDescription>
                </div>
                <Icon className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{METRIC_LABEL[metric]}</p>
                    <p className="text-2xl font-semibold">
                      {metric === "revenue"
                        ? compactInr(r.revenue)
                        : metric === "conversion"
                          ? pct(r.conversion)
                          : metric === "qualityScore"
                            ? `${r.qualityScore}%`
                            : num(metric === "calls" ? r.calls : r.sales)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary">Rank #{r.rank}</Badge>
                    <RagBadge status={r.status} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs">
                    {r.wow > 0 ? "+" : ""}
                    {r.wow}% week on week
                  </span>
                  <Sparkline values={r.weeklySales} className="h-8 w-28" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Full ranking</CardTitle>
          <CardDescription>
            Ranked by {METRIC_LABEL[metric].toLowerCase()} for the selected period ·{" "}
            {campaign === "all" ? "all campaigns" : campaign}. Status compares sales against the
            pro-rated target: green on target, amber within 20%, red below.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Rank</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="min-w-[130px]">Attainment</TableHead>
                <TableHead className="hidden md:table-cell">6-week trend</TableHead>
                <TableHead className="hidden sm:table-cell text-right">WoW</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Revenue</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Calls</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Conversion</TableHead>
                <TableHead className="text-right">QA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={12} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={12} message="No ranking data for this period." />
              ) : (
                rows.map((r) => {
                  const flag = flagged.get(r.employeeId);
                  return (
                    <TableRow key={r.employeeId}>
                      <TableCell className="font-medium">#{r.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            to="/employees/$employeeId"
                            params={{ employeeId: r.employeeId }}
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                          {flag && (
                            <Badge
                              variant={flag.severity === "critical" ? "destructive" : "secondary"}
                              title={flag.message}
                            >
                              {flag.weeksBelow}w below
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{r.team}</TableCell>
                      <TableCell>
                        <RagBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.sales)}
                        <span className="text-muted-foreground"> / {r.target}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, r.attainment)} className="h-2" />
                          <span className="w-11 text-right text-xs tabular-nums">
                            {r.attainment}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Sparkline values={r.weeklySales} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums">
                        {r.wow > 0 ? "+" : ""}
                        {r.wow}%
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {compactInr(r.revenue)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right">
                        {num(r.calls)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right">
                        {pct(r.conversion)}
                      </TableCell>
                      <TableCell className="text-right">{r.qualityScore}%</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
