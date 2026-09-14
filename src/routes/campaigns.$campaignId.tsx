import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck, Clock, IndianRupee, Percent, Phone, PhoneCall, PhoneOff } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { CampaignDeleteDialog } from "@/components/campaign-delete-dialog";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { RagBadge, Sparkline } from "@/components/rag-status";
import { StatCard } from "@/components/stat-card";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compactInr, num, pct, talkTime } from "@/lib/format";
import { api } from "@/lib/mock/api";

export const Route = createFileRoute("/campaigns/$campaignId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.campaignId} Campaign Dashboard | Apex CRM` },
      {
        name: "description",
        content: `Campaign-level dashboard for ${params.campaignId}: agent attainment, week-on-week sales trend, dialler outcomes and AI suggestions.`,
      },
      { property: "og:title", content: `${params.campaignId} Campaign | Apex CRM` },
      {
        property: "og:description",
        content: `Agent-level performance and dialler analysis for the ${params.campaignId} campaign.`,
      },
    ],
  }),
  component: CampaignDetailPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

function CampaignDetailPage() {
  const { campaignId } = Route.useParams();
  const navigate = useNavigate();
  const days = 7;
  const from = iso(new Date(Date.now() - (days - 1) * 864e5));
  const to = iso(new Date());

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.listCampaigns,
  });
  const { data: overview = [] } = useQuery({
    queryKey: ["campaign-overview", from, to],
    queryFn: () => api.campaignOverview({ from, to }),
  });
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["campaign-agents", campaignId, from, to],
    queryFn: () => api.campaignAgents({ campaign: campaignId, from, to }),
  });
  const { data: weeks = [] } = useQuery({
    queryKey: ["campaign-weeks", campaignId],
    queryFn: () => api.weeklySeries({ campaign: campaignId, weeks: 6 }),
  });
  const { data: flags = [] } = useQuery({
    queryKey: ["consistency-flags", campaignId],
    queryFn: () => api.consistencyFlags(campaignId),
  });
  const { data: dialler } = useQuery({
    queryKey: ["dialler", campaignId, 14],
    queryFn: () => api.diallerAnalysis(campaignId, 14),
  });

  const summary = overview.find((c) => c.campaign === campaignId);

  return (
    <AppShell>
      <PageHeader
        title={campaignId}
        description="Campaign dashboard — the same layout and metric set for every campaign."
        actions={
          <>
            <Select
              value={campaignId}
              onValueChange={(v) =>
                navigate({ to: "/campaigns/$campaignId", params: { campaignId: v } })
              }
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportMenu
              filename={`campaign-${campaignId.toLowerCase().replace(/\s+/g, "-")}`}
              columns={["Agent", "Team", "Calls", "Connected", "Leads", "Sales", "Target", "Attainment %", "Revenue", "Weeks below"]}
              rows={agents.map((a) => [
                a.employeeName,
                a.team,
                a.callsMade,
                a.callsConnected,
                a.leadsGenerated,
                a.sales,
                a.target,
                a.attainment,
                a.revenue,
                a.weeksBelow,
              ])}
            />
            <CampaignDeleteDialog campaignName={campaignId} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link to="/campaigns" className="text-sm text-muted-foreground hover:underline">
          ← All campaigns
        </Link>
        {summary && <RagBadge status={summary.status} />}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Calls (7 days)"
          value={num(summary?.calls ?? 0)}
          icon={PhoneCall}
          iconClassName="bg-sky-500/15 text-gray-700 dark:bg-sky-500/25 dark:text-gray-300"
          hint={`${pct(summary?.connectRate ?? 0)} connect rate`}
        />
        <StatCard
          label="Sales"
          value={num(summary?.sales ?? 0)}
          delta={summary?.wowSales}
          icon={CalendarCheck}
          iconClassName="bg-amber-500/15 text-gray-700 dark:bg-amber-500/25 dark:text-gray-300"
          hint={`Target ${num(summary?.salesTarget ?? 0)} · ${summary?.attainment ?? 0}%`}
        />
        <StatCard
          label="Revenue"
          value={compactInr(summary?.revenue ?? 0)}
          delta={summary?.wowRevenue}
          icon={IndianRupee}
          iconClassName="bg-teal-500/15 text-gray-700 dark:bg-teal-500/25 dark:text-gray-300"
          hint="Booked in the last 7 days"
        />
        <StatCard
          label="Flagged agents"
          value={String(flags.length)}
          icon={AlertTriangle}
          iconClassName="bg-rose-500/15 text-gray-700 dark:bg-rose-500/25 dark:text-gray-300"
          hint="Below weekly target 3+ weeks"
        />
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="trend">Week-on-week</TabsTrigger>
          <TabsTrigger value="dialler">Dialler data</TabsTrigger>
          <TabsTrigger value="flags">Flags ({flags.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent level</CardTitle>
              <CardDescription>
                Campaign → agent drill-down for {from} to {to}.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="hidden md:table-cell">Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Connected</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="min-w-[130px]">Attainment</TableHead>
                    <TableHead className="hidden sm:table-cell">6-week trend</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton cols={9} />
                  ) : agents.length === 0 ? (
                    <EmptyRow cols={9} message="No agent activity on this campaign." />
                  ) : (
                    [...agents]
                      .sort((a, b) => b.attainment - a.attainment)
                      .map((a) => (
                        <TableRow key={a.employeeId}>
                          <TableCell className="font-medium">
                            <Link
                              to="/employees/$employeeId"
                              params={{ employeeId: a.employeeId }}
                              className="hover:underline"
                            >
                              {a.employeeName}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{a.team}</TableCell>
                          <TableCell>
                            <RagBadge status={a.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(a.callsMade)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-right tabular-nums">
                            {num(a.callsConnected)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {a.sales}
                            <span className="text-muted-foreground"> / {a.target}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(100, a.attainment)} className="h-2" />
                              <span className="w-11 text-right text-xs tabular-nums">
                                {a.attainment}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Sparkline values={a.weeklySales} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-right">
                            {compactInr(a.revenue)}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales versus weekly target</CardTitle>
              <CardDescription>Last six weeks for {campaignId}.</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeks} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill="currentColor" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="target" name="Target" stroke="currentColor" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly detail</CardTitle>
              <CardDescription>Calls, conversion and attainment per week.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Attainment</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.length === 0 ? (
                    <EmptyRow cols={8} message="No weekly history yet." />
                  ) : (
                    weeks.map((w) => (
                      <TableRow key={w.weekStart}>
                        <TableCell className="font-medium">{w.label}</TableCell>
                        <TableCell>
                          <RagBadge status={w.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(w.calls)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(w.leads)}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.sales}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.target}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.attainment}%</TableCell>
                        <TableCell className="hidden sm:table-cell text-right">
                          {compactInr(w.revenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dialler" className="mt-4 space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Dial attempts"
              value={num(dialler?.dialAttempts ?? 0)}
              icon={Phone}
              iconClassName="bg-indigo-500/15 text-gray-700 dark:bg-indigo-500/25 dark:text-gray-300"
              hint="Last 14 days"
            />
            <StatCard
              label="Connect rate"
              value={pct(dialler?.connectRate ?? 0)}
              icon={Percent}
              iconClassName="bg-emerald-500/15 text-gray-700 dark:bg-emerald-500/25 dark:text-gray-300"
              hint={`Best hour ${dialler?.bestHour ?? "—"}`}
            />
            <StatCard
              label="No answer"
              value={pct(dialler?.noAnswerRate ?? 0)}
              icon={PhoneOff}
              iconClassName="bg-rose-500/15 text-gray-700 dark:bg-rose-500/25 dark:text-gray-300"
              hint={`Weakest hour ${dialler?.worstHour ?? "—"}`}
            />
            <StatCard
              label="Avg talk time"
              value={talkTime(dialler?.avgTalkTimeSec ?? 0)}
              icon={Clock}
              iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
              hint="Per connected call"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call outcomes by hour</CardTitle>
              <CardDescription>Imported dialler feed, aggregated across agents.</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] sm:h-[300px]">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI suggestions</CardTitle>
              <CardDescription>Derived from the dialler outcomes above.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dialler?.findings ?? []).map((f) => (
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
                {(dialler?.suggestions ?? []).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automated consistency flags</CardTitle>
              <CardDescription>
                Raised automatically when an agent finishes below the weekly sales target for three
                or more consecutive weeks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {flags.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No agents are currently flagged on this campaign.
                </p>
              ) : (
                flags.map((f) => (
                  <div key={f.employeeId} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/employees/$employeeId"
                        params={{ employeeId: f.employeeId }}
                        className="text-sm font-medium hover:underline"
                      >
                        {f.name}
                      </Link>
                      <Badge variant={f.severity === "critical" ? "destructive" : "secondary"}>
                        {f.weeksBelow} weeks below target
                      </Badge>
                      <Badge variant="outline">{f.trendDirection}</Badge>
                      <span className="text-xs text-muted-foreground">{f.team}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.message}</p>
                    <p className="mt-1 text-sm">{f.action}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
