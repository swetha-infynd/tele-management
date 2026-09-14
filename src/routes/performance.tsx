import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarCheck, IndianRupee, Percent, PhoneCall, Target } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { compactInr, num, pct, shortDate, talkTime } from "@/lib/format";
import { addDays, api, iso } from "@/lib/mock/api";
import { useTeamScope } from "@/lib/session";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "Performance Analytics — Calls, Sales, Conversion | Apex CRM" },
      {
        name: "description",
        content:
          "Daily and monthly performance tracking: calls, connects, leads, conversions, revenue and talk time per agent.",
      },
      { property: "og:title", content: "Performance Analytics | Apex CRM" },
      { property: "og:description", content: "Calls, conversions, revenue and talk time by agent." },
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

function PerformancePage() {
  const scope = useTeamScope();
  const [range, setRange] = useState("30");
  const [team, setTeam] = useState(scope ?? "all");

  const days = Number(range);
  const to = iso(new Date());
  const from = iso(addDays(new Date(), -(days - 1)));

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["performance", from, to, team],
    queryFn: () => api.listPerformance({ from, to, team }),
  });
  const { data: trend = [] } = useQuery({
    queryKey: ["trend", days, team],
    queryFn: () => api.trend(days, team),
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });

  const totals = rows.reduce(
    (a, r) => ({
      calls: a.calls + r.callsMade,
      leads: a.leads + r.leadsGenerated,
      sales: a.sales + r.sales,
      revenue: a.revenue + r.revenue,
    }),
    { calls: 0, leads: 0, sales: 0, revenue: 0 },
  );
  const conversion = totals.leads ? (totals.sales / totals.leads) * 100 : 0;
  const chartData = trend.map((t) => ({ ...t, date: shortDate(t.date) }));

  return (
    <AppShell>
      <PageHeader
        title="Performance"
        description="Agent productivity and sales output across the selected window."
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
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportMenu
              filename="performance"
              columns={["Agent", "Campaigns", "Calls", "Connected", "Leads", "Sales", "Revenue", "Conversion %", "QA"]}
              rows={rows.map((r) => [
                r.employeeName,
                r.campaigns || r.campaign || "—",
                r.callsMade,
                r.callsConnected,
                r.leadsGenerated,
                r.sales,
                r.revenue,
                r.conversion,
                r.qualityScore,
              ])}
            />
          </>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Calls made"
          value={num(totals.calls)}
          icon={PhoneCall}
          iconClassName="bg-sky-500/15 text-gray-700 dark:bg-sky-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Leads generated"
          value={num(totals.leads)}
          icon={Target}
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
          value={compactInr(totals.revenue)}
          icon={IndianRupee}
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
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden md:table-cell">Campaigns</TableHead>
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
                <TableSkeleton cols={9} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={9} message="No performance data for this window." />
              ) : (
                rows.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell className="font-medium">{r.employeeName}</TableCell>
                    <TableCell className="hidden md:table-cell">{r.campaigns || r.campaign || "—"}</TableCell>
                    <TableCell className="text-right">{num(r.callsMade)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      {num(r.callsConnected)}
                    </TableCell>
                    <TableCell className="text-right">{num(r.leadsGenerated)}</TableCell>
                    <TableCell className="text-right">{num(r.sales)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      {compactInr(r.revenue)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      {talkTime(r.avgTalkTimeSec)}
                    </TableCell>
                    <TableCell className="text-right">{pct(r.conversion)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
