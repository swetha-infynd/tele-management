import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarCheck,
  IndianRupee,
  Percent,
  PhoneCall,
  Sparkles,
  Target,
  UserCheck,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceStatusBadge } from "@/components/status-badges";
import { CheckInWidget } from "@/components/check-in-widget";
import { api } from "@/lib/mock/api";
import { compactInr, initials, num, shortDate } from "@/lib/format";
import { useSession, useTeamScope } from "@/lib/session";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — Apex CRM" },
      {
        name: "description",
        content:
          "Live floor overview: attendance, calls, leads, sales, revenue, conversion and leaderboard for your BPO team.",
      },
      { property: "og:title", content: "Operations Dashboard — Apex CRM" },
      {
        property: "og:description",
        content: "Live floor overview: attendance, calls, leads, sales, revenue, conversion and leaderboard for your BPO team.",
      },
    ],
  }),
  component: DashboardPage,
});

const chartConfig = {
  calls: { label: "Calls", color: "var(--chart-1)" },
  leads: { label: "Leads", color: "var(--chart-2)" },
  sales: { label: "Sales", color: "var(--chart-3)" },
  present: { label: "Present", color: "var(--chart-1)" },
  late: { label: "Late", color: "var(--chart-4)" },
  absent: { label: "Absent", color: "var(--chart-5)" },
};

function DashboardPage() {
  const { session } = useSession();
  const scope = useTeamScope();
  const [team, setTeam] = useState<string>(scope ?? "all");
  const [range, setRange] = useState("14");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard", team],
    queryFn: () => api.dashboardStats(team),
  });
  const { data: trend = [] } = useQuery({
    queryKey: ["trend", range, team],
    queryFn: () => api.trend(Number(range), team),
  });
  const { data: board = [] } = useQuery({
    queryKey: ["leaderboard", "daily", team],
    queryFn: () => api.leaderboard("daily", "sales", team),
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-today", team],
    queryFn: () => api.listAttendance({ date: new Date().toISOString().slice(0, 10), team }),
  });
  const { data: ai } = useQuery({ queryKey: ["ai-summary", team], queryFn: () => api.aiDailySummary(team) });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: followUps = [] } = useQuery({
    queryKey: ["followups", session.role === "agent" ? session.employeeId : "all"],
    queryFn: () => api.followUpsDue(session.role === "agent" ? session.employeeId : undefined),
  });

  const attendanceMix = [
    { name: "Present", value: attendance.filter((a) => a.status === "Present").length },
    { name: "Late", value: attendance.filter((a) => a.status === "Late").length },
    { name: "Absent", value: attendance.filter((a) => a.status === "Absent").length },
    { name: "Leave", value: attendance.filter((a) => a.status === "Leave").length },
  ];

  const monthlyProgress = settings
    ? Math.min(100, Math.round(((stats?.revenue ?? 0) * 22 * 100) / settings.monthlyRevenueTarget))
    : 0;

  return (
    <AppShell>
      <PageHeader
        title={`Good day, ${session.name.split(" ")[0]}`}
        description="Here is what is happening on the floor today."
        actions={
          <>
            {!scope && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="w-[150px]">
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
            )}
            <Button asChild size="sm">
              <Link to="/reports">View reports</Link>
            </Button>
          </>
        }
      />

      <CheckInWidget />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total agents"
          value={stats?.totalAgents ?? 0}
          icon={Users}
          hint={`${stats?.loggedIn ?? 0} currently logged in`}
          loading={isLoading}
        />
        <StatCard
          label="Present today"
          value={`${stats?.present ?? 0} / ${stats?.totalAgents ?? 0}`}
          icon={UserCheck}
          hint={`${stats?.attendanceRate ?? 0}% attendance • ${stats?.absent ?? 0} absent`}
          loading={isLoading}
        />
        <StatCard
          label="Calls made today"
          value={num(stats?.callsToday ?? 0)}
          delta={stats?.deltas.calls}
          icon={PhoneCall}
          loading={isLoading}
        />
        <StatCard
          label="Leads generated"
          value={num(stats?.leadsGenerated ?? 0)}
          delta={stats?.deltas.leads}
          icon={Target}
          loading={isLoading}
        />
        <StatCard
          label="Sales closed"
          value={num(stats?.salesClosed ?? 0)}
          delta={stats?.deltas.sales}
          icon={CalendarCheck}
          loading={isLoading}
        />
        <StatCard
          label="Revenue"
          value={compactInr(stats?.revenue ?? 0)}
          delta={stats?.deltas.revenue}
          icon={IndianRupee}
          loading={isLoading}
        />
        <StatCard
          label="Conversion rate"
          value={`${stats?.conversionRate ?? 0}%`}
          icon={Percent}
          hint="sales / leads today"
          loading={isLoading}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly revenue target
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold tracking-tight">{monthlyProgress}%</div>
            <Progress value={monthlyProgress} />
            <p className="text-xs text-muted-foreground">
              Target {settings ? compactInr(settings.monthlyRevenueTarget) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Call & sales trend</CardTitle>
              <CardDescription>Daily volume across the selected period</CardDescription>
            </div>
            <Tabs value={range} onValueChange={setRange}>
              <TabsList>
                <TabsTrigger value="7">7d</TabsTrigger>
                <TabsTrigger value="14">14d</TabsTrigger>
                <TabsTrigger value="30">30d</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <AreaChart data={trend}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={shortDate}
                  />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
                  <Area
                    dataKey="calls"
                    type="monotone"
                    fill="var(--color-calls)"
                    fillOpacity={0.15}
                    stroke="var(--color-calls)"
                  />
                  <Area
                    dataKey="leads"
                    type="monotone"
                    fill="var(--color-leads)"
                    fillOpacity={0.15}
                    stroke="var(--color-leads)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> AI daily summary
            </CardTitle>
            <CardDescription>{ai?.headline ?? "Generating insights…"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!ai ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Rating {ai.rating}/10</Badge>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {ai.bullets.slice(0, 4).map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/ai-insights">Open AI insights</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Attendance summary</CardTitle>
            <CardDescription>Today across {team === "all" ? "all teams" : team}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={attendanceMix}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>Top sellers today</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/leaderboard">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {board.slice(0, 6).map((row) => (
              <div key={row.employeeId} className="flex items-center gap-3">
                <span className="w-5 text-sm font-medium text-muted-foreground">{row.rank}</span>
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {initials(row.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.team}</p>
                </div>
                <Badge variant="secondary">{row.sales} sales</Badge>
              </div>
            ))}
            {board.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity recorded yet today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Follow-ups due</CardTitle>
              <CardDescription>{followUps.length} leads need attention</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/leads">Open</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUps.slice(0, 6).map((l) => (
              <Link
                key={l.id}
                to="/leads/$leadId"
                params={{ leadId: l.id }}
                className="flex items-center gap-3 rounded-md p-1 hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.businessName} • {l.agentName}
                  </p>
                </div>
                <Badge variant="outline">{l.followUpDate}</Badge>
              </Link>
            ))}
            {followUps.length === 0 && (
              <p className="text-sm text-muted-foreground">No follow-ups pending. Nice work.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live floor status</CardTitle>
          <CardDescription>Check-in and check-out for today</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Logout</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.slice(0, 10).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.employeeName}</TableCell>
                  <TableCell className="text-muted-foreground">{a.team}</TableCell>
                  <TableCell>{a.checkIn ?? "—"}</TableCell>
                  <TableCell>{a.checkOut ?? "—"}</TableCell>
                  <TableCell>{a.workingHours ? `${a.workingHours}h` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <AttendanceStatusBadge status={a.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
