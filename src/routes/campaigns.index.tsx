import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { CampaignFormDialog } from "@/components/campaign-form-dialog";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { RagBadge } from "@/components/rag-status";
import { StatCard } from "@/components/stat-card";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { compactInr, num, pct } from "@/lib/format";
import { api } from "@/lib/mock/api";

export const Route = createFileRoute("/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaign Overview — All Campaigns Rolled Up | Apex CRM" },
      {
        name: "description",
        content:
          "Master overview rolling up every campaign: calls, connect rate, sales attainment, revenue and automated performance flags.",
      },
      { property: "og:title", content: "Campaign Overview | Apex CRM" },
      {
        property: "og:description",
        content: "One dashboard rolling up every outbound campaign on the floor.",
      },
    ],
  }),
  component: CampaignsOverviewPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

function CampaignsOverviewPage() {
  const [range, setRange] = useState("7");
  const days = Number(range);
  const from = iso(new Date(Date.now() - (days - 1) * 864e5));
  const to = iso(new Date());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["campaign-overview", from, to],
    queryFn: () => api.campaignOverview({ from, to }),
  });
  const { data: flags = [] } = useQuery({
    queryKey: ["consistency-flags", "all"],
    queryFn: () => api.consistencyFlags(),
  });
  const { data: dialler } = useQuery({
    queryKey: ["dialler", "all", days],
    queryFn: () => api.diallerAnalysis(undefined, days),
  });

  const totals = rows.reduce(
    (a, c) => ({
      calls: a.calls + c.calls,
      sales: a.sales + c.sales,
      revenue: a.revenue + c.revenue,
      target: a.target + c.salesTarget,
    }),
    { calls: 0, sales: 0, revenue: 0, target: 0 },
  );
  const attainment = totals.target ? (totals.sales / totals.target) * 100 : 0;

  return (
    <AppShell>
      <PageHeader
        title="Campaign overview"
        description="Every campaign on one page, with the same metric set and drill-down into agent level."
        actions={
          <>
            <CampaignFormDialog />
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportMenu
              filename={`campaign-overview-${from}-to-${to}`}
              columns={[
                "Campaign",
                "Agents",
                "Calls",
                "Connect %",
                "Leads",
                "Sales",
                "Target",
                "Attainment %",
                "Revenue",
                "WoW sales %",
                "Flags",
              ]}
              rows={rows.map((r) => [
                r.campaign,
                r.agents,
                r.calls,
                r.connectRate,
                r.leads,
                r.sales,
                r.salesTarget,
                r.attainment,
                r.revenue,
                r.wowSales,
                r.flags,
              ])}
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Calls" value={num(totals.calls)} hint={`Across ${rows.length} campaigns`} />
        <StatCard
          label="Sales"
          value={num(totals.sales)}
          hint={`Target ${num(totals.target)} · ${attainment.toFixed(1)}%`}
        />
        <StatCard label="Revenue" value={compactInr(totals.revenue)} hint="Booked in range" />
        <StatCard
          label="Consistency flags"
          value={String(flags.length)}
          hint="Agents below target 3+ weeks"
        />
      </div>

      {flags.length > 0 && (
        <Alert>
          <AlertTitle>{flags.length} agents flagged automatically</AlertTitle>
          <AlertDescription>
            {flags
              .slice(0, 3)
              .map((f) => `${f.name} (${f.weeksBelow} weeks)`)
              .join(", ")}
            {flags.length > 3 ? ` and ${flags.length - 3} more.` : "."} Open a campaign to review
            coaching actions.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign rollup</CardTitle>
          <CardDescription>
            Ranked by sales attainment against the pro-rated weekly target for this range.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell text-right">Agents</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Connect</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="min-w-[140px]">Attainment</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Revenue</TableHead>
                <TableHead className="hidden lg:table-cell text-right">WoW</TableHead>
                <TableHead className="text-right">Flags</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={11} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={11} message="No campaign data in this range." />
              ) : (
                [...rows]
                  .sort((a, b) => b.attainment - a.attainment)
                  .map((r) => (
                    <TableRow key={r.campaign}>
                      <TableCell className="font-medium">
                        <Link
                          to="/campaigns/$campaignId"
                          params={{ campaignId: r.campaign }}
                          className="hover:underline"
                        >
                          {r.campaign}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <RagBadge status={r.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">{r.agents}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.calls)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {pct(r.connectRate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.sales}
                        <span className="text-muted-foreground"> / {r.salesTarget}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, r.attainment)} className="h-2" />
                          <span className="w-12 text-right text-xs tabular-nums">
                            {r.attainment}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right">
                        {compactInr(r.revenue)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">
                        {r.wowSales > 0 ? "+" : ""}
                        {r.wowSales}%
                      </TableCell>
                      <TableCell className="text-right">
                        {r.flags ? (
                          <Badge variant="destructive">{r.flags}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/campaigns/$campaignId" params={{ campaignId: r.campaign }}>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales versus target by campaign</CardTitle>
            <CardDescription>Pro-rated target for the selected range.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="campaign" tick={{ fontSize: 11 }} interval={0} angle={-12} dy={8} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill="currentColor" radius={[4, 4, 0, 0]} />
                <Bar dataKey="salesTarget" name="Target" fill="currentColor" opacity={0.3} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dialler pattern across all campaigns</CardTitle>
            <CardDescription>
              Connect and no-answer rate by hour of day, last {days} days.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dialler?.hourly ?? []} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="connectRate" name="Connect %" stroke="currentColor" dot={false} />
                <Line
                  type="monotone"
                  dataKey="noAnswerRate"
                  name="No answer %"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {dialler && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI suggestions from dialler data</CardTitle>
            <CardDescription>
              Generated from {num(dialler.dialAttempts)} dial attempts across the floor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dialler.findings.map((f) => (
              <div key={f.title} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{f.title}</p>
                  <Badge variant={f.severity === "critical" ? "destructive" : "secondary"}>
                    {f.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
              </div>
            ))}
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {dialler.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
