import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarCheck, Clock, PoundSterling, Percent, PhoneCall } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { ClientNamesCell } from "@/components/client-names-cell";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { clientNamesText } from "@/lib/dial-upload";
import { compactGbp, num, pct, shortDate, talkTime } from "@/lib/format";
import { addDays, api, iso } from "@/lib/mock/api";
import { useSession, useTeamScope } from "@/lib/session";
import { useClientNameIndex } from "@/hooks/use-client-names";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "Performance Analytics — Hours & Sales | Apex CRM" },
      {
        name: "description",
        content:
          "Hours-based performance tracking: login hours vs target, calls, leads, conversions and revenue per agent.",
      },
      { property: "og:title", content: "Performance Analytics | Apex CRM" },
      {
        property: "og:description",
        content: "Hours worked vs target, calls, conversions and revenue by agent.",
      },
    ],
  }),
  component: PerformancePage,
});

const chartConfig = {
  calls: { label: "Calls", color: "var(--chart-1)" },
  leads: { label: "Leads", color: "var(--chart-2)" },
  sales: { label: "Sales", color: "var(--chart-3)" },
  revenue: { label: "Revenue", color: "var(--chart-4)" },
  conversion: { label: "Conversion %", color: "var(--chart-5)" },
} satisfies ChartConfig;

function hoursStatus(attainment: number): "on-target" | "borderline" | "below" {
  if (attainment >= 100) return "on-target";
  if (attainment >= 80) return "borderline";
  return "below";
}

function HoursStatusBadge({ attainment }: { attainment: number }) {
  const s = hoursStatus(attainment);
  if (s === "on-target")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20">
        On target
      </Badge>
    );
  if (s === "borderline")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20">
        Borderline
      </Badge>
    );
  return (
    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/20">
      Below
    </Badge>
  );
}

function PerformancePage() {
  const { session } = useSession();

  if (session.role === "agent") {
    return (
      <AppShell>
        <MyPerformance />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <FloorPerformance />
    </AppShell>
  );
}

function MyPerformance() {
  const { session } = useSession();
  const [range, setRange] = useState("30");
  const days = Number(range);
  const to = iso(new Date());
  const from = iso(addDays(new Date(), -(days - 1)));

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const dailyHoursTarget = settings?.dailyLoginHoursTarget ?? 8;
  const periodHoursTarget = dailyHoursTarget * days;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["performance-mine", from, to, session.employeeId],
    queryFn: () => api.listPerformance({ from, to, employeeId: session.employeeId }),
  });
  const mine = rows[0];
  const conversion = mine?.conversion ?? 0;
  const hoursAtt = periodHoursTarget ? ((mine?.loginHours ?? 0) / periodHoursTarget) * 100 : 0;

  const { data: campaignPerf = [] } = useQuery({
    queryKey: ["campaign-perf-mine", from, to, session.employeeId],
    queryFn: async () => {
      const campaigns = await api.listCampaigns();
      const results = await Promise.all(
        campaigns.map(async (c) => {
          const r = await api.campaignAgents({
            campaign: c,
            from,
            to,
            employeeId: session.employeeId,
          });
          const mineRow = r.find((x) => x.employeeId === session.employeeId);
          return mineRow ? { ...mineRow, campaign: c } : null;
        }),
      );
      return results.filter((x): x is NonNullable<typeof x> => x !== null && x.callsMade > 0);
    },
  });

  const { data: trend = [] } = useQuery({
    queryKey: ["my-daily-perf", session.employeeId, days],
    queryFn: () => api.myDailyTrend(session.employeeId, days),
  });

  const chartData = trend.map((t) => ({ ...t, date: shortDate(t.date) }));

  return (
    <>
      <PageHeader
        title="My Performance"
        description="Your hours, calls, leads and sales — measured against your daily targets."
        actions={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="My login hours"
          value={`${(mine?.loginHours ?? 0).toFixed(1)}h`}
          icon={Clock}
          iconClassName="bg-sky-500/15 text-gray-700 dark:bg-sky-500/25 dark:text-gray-300"
          hint={`Target ${periodHoursTarget}h`}
          loading={isLoading}
        />
        <StatCard
          label="Calls made"
          value={num(mine?.callsMade ?? 0)}
          icon={PhoneCall}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
          loading={isLoading}
        />
        <StatCard
          label="Sales closed"
          value={num(mine?.sales ?? 0)}
          icon={CalendarCheck}
          iconClassName="bg-amber-500/15 text-gray-700 dark:bg-amber-500/25 dark:text-gray-300"
          loading={isLoading}
        />
        <StatCard
          label="Revenue"
          value={compactGbp(mine?.revenue ?? 0)}
          icon={PoundSterling}
          iconClassName="bg-teal-500/15 text-gray-700 dark:bg-teal-500/25 dark:text-gray-300"
          loading={isLoading}
        />
        <StatCard
          label="Conversion rate"
          value={pct(conversion)}
          icon={Percent}
          iconClassName="bg-rose-500/15 text-gray-700 dark:bg-rose-500/25 dark:text-gray-300"
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hours vs target</CardTitle>
          <CardDescription>
            Daily target {dailyHoursTarget}h × {days} days = <strong>{periodHoursTarget}h</strong>{" "}
            for this period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Progress value={Math.min(100, hoursAtt)} className="h-3 flex-1" />
            <span className="text-sm font-medium tabular-nums w-14 text-right">
              {hoursAtt.toFixed(0)}%
            </span>
            <HoursStatusBadge attainment={hoursAtt} />
          </div>
          <p className="text-sm text-muted-foreground">
            Talk time: {talkTime(mine?.avgTalkTimeSec ?? 0)} avg • Connected:{" "}
            {num(mine?.callsConnected ?? 0)} • Leads: {num(mine?.leadsGenerated ?? 0)}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My daily activity</CardTitle>
            <CardDescription>Calls and leads you generated each day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-52 w-full sm:h-64">
              <AreaChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="calls"
                  type="monotone"
                  stroke="var(--color-calls)"
                  fill="var(--color-calls)"
                  fillOpacity={0.15}
                />
                <Area
                  dataKey="leads"
                  type="monotone"
                  stroke="var(--color-leads)"
                  fill="var(--color-leads)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My revenue trend</CardTitle>
            <CardDescription>Revenue you booked per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-52 w-full sm:h-64">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My campaign breakdown</CardTitle>
          <CardDescription>How you performed on each campaign in this period.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Connected</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Revenue</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={7} />
              ) : campaignPerf.length === 0 ? (
                <EmptyRow cols={7} message="No campaign activity in this window." />
              ) : (
                campaignPerf.map((r) => (
                  <TableRow key={r.campaign}>
                    <TableCell className="font-medium">{r.campaign}</TableCell>
                    <TableCell className="text-right">{num(r.callsMade)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      {num(r.callsConnected)}
                    </TableCell>
                    <TableCell className="text-right">{num(r.leadsGenerated)}</TableCell>
                    <TableCell className="text-right">{num(r.sales)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      {compactGbp(r.revenue)}
                    </TableCell>
                    <TableCell className="text-right">{pct(r.conversion)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function FloorPerformance() {
  const scope = useTeamScope();
  const [range, setRange] = useState("30");
  const [team, setTeam] = useState(scope ?? "all");
  const [campaign, setCampaign] = useState("all");
  const clientNames = useClientNameIndex();
  const clientsFor = (agentName: string) =>
    clientNames.agent(agentName, campaign === "all" ? undefined : campaign);

  const days = Number(range);
  const to = iso(new Date());
  const from = iso(addDays(new Date(), -(days - 1)));

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });
  const dailyHoursTarget = settings?.dailyLoginHoursTarget ?? 8;
  const periodHoursTarget = dailyHoursTarget * days;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["performance", from, to, team, campaign],
    queryFn: () => api.listPerformance({ from, to, team, campaign }),
  });
  const { data: trend = [] } = useQuery({
    queryKey: ["trend", days, team],
    queryFn: () => api.trend(days, team),
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.listCampaigns,
  });

  const totals = rows.reduce(
    (a, r) => ({
      calls: a.calls + r.callsMade,
      leads: a.leads + r.leadsGenerated,
      sales: a.sales + r.sales,
      revenue: a.revenue + r.revenue,
      loginHours: a.loginHours + r.loginHours,
    }),
    { calls: 0, leads: 0, sales: 0, revenue: 0, loginHours: 0 },
  );
  const conversion = totals.leads ? (totals.sales / totals.leads) * 100 : 0;
  const chartData = trend.map((t) => ({ ...t, date: shortDate(t.date) }));

  return (
    <>
      <PageHeader
        title="Performance"
        description="Agent productivity measured in hours worked vs daily target, plus sales output."
        actions={
          <>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={team} onValueChange={setTeam} disabled={!!scope}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportMenu
              filename="performance"
              columns={[
                "Agent",
                "Client",
                "Campaigns",
                "Login Hours",
                "Hours Target",
                "Hours %",
                "Calls",
                "Connected",
                "Leads",
                "Sales",
                "Revenue",
                "Conversion %",
                "Talk Time",
                "QA",
              ]}
              rows={rows.map((r) => {
                const hoursAtt = periodHoursTarget
                  ? Number(((r.loginHours / periodHoursTarget) * 100).toFixed(1))
                  : 0;
                return [
                  r.employeeName,
                  clientNamesText(clientsFor(r.employeeName)),
                  r.campaigns || r.campaign || "—",
                  r.loginHours,
                  periodHoursTarget,
                  hoursAtt,
                  r.callsMade,
                  r.callsConnected,
                  r.leadsGenerated,
                  r.sales,
                  r.revenue,
                  r.conversion,
                  r.avgTalkTimeSec,
                  r.qualityScore,
                ];
              })}
            />
          </>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total login hours"
          value={`${totals.loginHours.toFixed(1)}h`}
          icon={Clock}
          iconClassName="bg-sky-500/15 text-gray-700 dark:bg-sky-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Calls made"
          value={num(totals.calls)}
          icon={PhoneCall}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Sales closed"
          value={num(totals.sales)}
          icon={CalendarCheck}
          iconClassName="bg-amber-500/15 text-gray-700 dark:bg-amber-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Revenue"
          value={compactGbp(totals.revenue)}
          icon={PoundSterling}
          iconClassName="bg-teal-500/15 text-gray-700 dark:bg-teal-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Conversion rate"
          value={pct(conversion)}
          icon={Percent}
          iconClassName="bg-rose-500/15 text-gray-700 dark:bg-rose-500/25 dark:text-gray-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls vs leads</CardTitle>
            <CardDescription>Daily dialler activity and qualified leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-52 w-full sm:h-64">
              <AreaChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="calls"
                  type="monotone"
                  stroke="var(--color-calls)"
                  fill="var(--color-calls)"
                  fillOpacity={0.15}
                />
                <Area
                  dataKey="leads"
                  type="monotone"
                  stroke="var(--color-leads)"
                  fill="var(--color-leads)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue trend</CardTitle>
            <CardDescription>Closed-won value per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-52 w-full sm:h-64">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Conversion rate</CardTitle>
            <CardDescription>Sales as a share of leads generated.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full sm:h-56">
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="conversion"
                  type="monotone"
                  stroke="var(--color-conversion)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent breakdown</CardTitle>
          <CardDescription>
            Performance target is <strong>hours-based</strong>: daily target {dailyHoursTarget}h ×{" "}
            {days} days = <strong>{periodHoursTarget}h</strong> per agent for this period.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Campaigns</TableHead>
                <TableHead className="text-right">Login Hours</TableHead>
                <TableHead className="min-w-[140px]">Hours Attainment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Connected</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Revenue</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Talk time</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={13} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={13} message="No performance data for this window." />
              ) : (
                rows.map((r) => {
                  const hoursAtt = periodHoursTarget
                    ? Number(((r.loginHours / periodHoursTarget) * 100).toFixed(1))
                    : 0;
                  return (
                    <TableRow key={r.employeeId}>
                      <TableCell className="font-medium">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {r.employeeName}
                          {r.fromUpload ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                              title="Includes uploaded call-detail CSV data"
                            >
                              Upload
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        <ClientNamesCell {...clientsFor(r.employeeName)} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.campaigns || r.campaign || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.loginHours.toFixed(1)}h
                        <span className="text-muted-foreground text-xs ml-1">
                          / {periodHoursTarget}h
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, hoursAtt)} className="h-2" />
                          <span className="w-12 text-right text-xs tabular-nums">{hoursAtt}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <HoursStatusBadge attainment={hoursAtt} />
                      </TableCell>
                      <TableCell className="text-right">{num(r.callsMade)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-right">
                        {num(r.callsConnected)}
                      </TableCell>
                      <TableCell className="text-right">{num(r.leadsGenerated)}</TableCell>
                      <TableCell className="text-right">{num(r.sales)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {compactGbp(r.revenue)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {talkTime(r.avgTalkTimeSec)}
                      </TableCell>
                      <TableCell className="text-right">{pct(r.conversion)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
