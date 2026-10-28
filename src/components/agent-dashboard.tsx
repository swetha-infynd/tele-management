import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  PoundSterling,
  Percent,
  PhoneCall,
  Target,
  UserCheck,
  Clock,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { CheckInWidget } from "@/components/check-in-widget";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AttendanceStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { compactGbp, initials, num, shortDate } from "@/lib/format";
import { api } from "@/lib/mock/api";
import { useSession } from "@/lib/session";

const chartConfig = {
  calls: { label: "Calls", color: "var(--chart-1)" },
  leads: { label: "Leads", color: "var(--chart-2)" },
  dials: { label: "Dials", color: "var(--chart-1)" },
  connects: { label: "Connects", color: "var(--chart-2)" },
};

export function AgentDashboard() {
  const { session } = useSession();
  const today = new Date().toISOString().slice(0, 10);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-dashboard", session.employeeId],
    queryFn: () => api.myDashboardStats(session.employeeId),
  });
  const { data: myTodayPerf } = useQuery({
    queryKey: ["my-perf-today", session.employeeId, today],
    queryFn: async () => {
      const rows = await api.listPerformance({
        from: today,
        to: today,
        employeeId: session.employeeId,
      });
      return rows[0] ?? null;
    },
  });
  const { data: hourly = [] } = useQuery({
    queryKey: ["my-hourly", session.employeeId, today],
    queryFn: () => api.listHourlyCampaignLogs({ date: today, employeeId: session.employeeId }),
  });
  const { data: followUps = [] } = useQuery({
    queryKey: ["followups", session.employeeId],
    queryFn: () => api.followUpsDue(session.employeeId),
  });
  const { data: attendance } = useQuery({
    queryKey: ["my-attendance-today", session.employeeId],
    queryFn: () => api.getMyAttendanceToday(session.employeeId),
  });
  const { data: myBoard = [] } = useQuery({
    queryKey: ["leaderboard", "daily", "mine", session.employeeId],
    queryFn: () => api.leaderboard("daily", "sales", undefined, undefined, session.employeeId),
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const campaignTotals = hourly.reduce<
    Record<string, { dials: number; connects: number; minutes: number }>
  >((acc, h) => {
    const cur = acc[h.campaign] ?? { dials: 0, connects: 0, minutes: 0 };
    cur.dials += h.dials;
    cur.connects += h.connects;
    cur.minutes += h.minutes;
    acc[h.campaign] = cur;
    return acc;
  }, {});
  const campaignRows = Object.entries(campaignTotals)
    .map(([campaign, v]) => ({ campaign, ...v }))
    .sort((a, b) => b.dials - a.dials);

  const hourChart = Array.from({ length: 9 }, (_, i) => {
    const hour = 9 + i;
    const rows = hourly.filter((h) => h.hour === hour);
    return {
      hour: `${hour}:00`,
      dials: rows.reduce((s, h) => s + h.dials, 0),
      connects: rows.reduce((s, h) => s + h.connects, 0),
    };
  });

  const hoursTarget = settings?.dailyLoginHoursTarget ?? 8;
  const myRank = myBoard[0]?.rank;

  return (
    <>
      <PageHeader
        title={`Good day, ${session.name.split(" ")[0]}`}
        description="Your personal workspace — calls, campaigns and follow-ups for today."
      />
      <CheckInWidget />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My calls today"
          value={num(stats?.callsToday ?? 0)}
          delta={stats?.deltas.calls}
          icon={PhoneCall}
          iconClassName="bg-sky-500/15 text-gray-700 dark:bg-sky-500/25 dark:text-gray-300"
          loading={isLoading}
        />
        <StatCard
          label="Leads generated"
          value={num(stats?.leadsGenerated ?? 0)}
          delta={stats?.deltas.leads}
          icon={Target}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
          loading={isLoading}
        />
        <StatCard
          label="Sales closed"
          value={num(stats?.salesClosed ?? 0)}
          delta={stats?.deltas.sales}
          icon={CalendarCheck}
          iconClassName="bg-amber-500/15 text-gray-700 dark:bg-amber-500/25 dark:text-gray-300"
          loading={isLoading}
        />
        <StatCard
          label="Revenue booked"
          value={compactGbp(stats?.revenue ?? 0)}
          delta={stats?.deltas.revenue}
          icon={PoundSterling}
          iconClassName="bg-teal-500/15 text-gray-700 dark:bg-teal-500/25 dark:text-gray-300"
          loading={isLoading}
        />
        <StatCard
          label="Conversion rate"
          value={`${stats?.conversionRate ?? 0}%`}
          icon={Percent}
          iconClassName="bg-rose-500/15 text-gray-700 dark:bg-rose-500/25 dark:text-gray-300"
          hint="sales / leads today"
          loading={isLoading}
        />
        <StatCard
          label="My rank today"
          value={myRank ? `#${myRank}` : "—"}
          icon={UserCheck}
          iconClassName="bg-indigo-500/15 text-gray-700 dark:bg-indigo-500/25 dark:text-gray-300"
          hint={myBoard[0] ? `${myBoard[0].sales} sales` : "No activity yet"}
        />
        <Card className="relative overflow-hidden border-primary/30 transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {myTodayPerf?.loginHours ?? attendance?.workingHours ?? 0}h
              <span className="text-sm font-normal text-muted-foreground"> / {hoursTarget}h</span>
            </div>
            <Progress
              value={Math.min(
                100,
                ((myTodayPerf?.loginHours ?? attendance?.workingHours ?? 0) / hoursTarget) * 100,
              )}
              className="h-2.5"
            />
            <p className="text-xs text-muted-foreground">
              {attendance?.status ? (
                <AttendanceStatusBadge status={attendance.status} />
              ) : (
                "Not checked in yet"
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-primary/30 transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm">
                {attendance?.checkIn
                  ? `In ${attendance.checkIn}${attendance.checkOut ? ` • Out ${attendance.checkOut}` : " • On shift"}`
                  : "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Late: {attendance?.lateMinutes ?? 0} min • Break: {attendance?.breakMinutes ?? 0} min
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My hourly activity today</CardTitle>
            <CardDescription>Dials and connects hour by hour across your campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {hourChart.every((h) => h.dials === 0) ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[200px] w-full sm:h-[240px]">
                <BarChart data={hourChart}>
                  <CartesianGrid vertical={false} opacity={0.3} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="dials" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="connects" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaigns I worked today</CardTitle>
            <CardDescription>Time and dials per campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaignRows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No campaign activity recorded yet today.
              </p>
            )}
            {campaignRows.map((c) => (
              <div key={c.campaign} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{c.campaign}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {c.minutes}m • {c.dials} dials
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (c.connects / Math.max(1, c.dials)) * 100)}
                  className="h-1.5"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>My follow-ups due</CardTitle>
              <CardDescription>{followUps.length} leads need your attention</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/leads">Open leads</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUps.slice(0, 8).map((l) => (
              <Link
                key={l.id}
                to="/leads/$leadId"
                params={{ leadId: l.id }}
                className="flex items-center gap-3 rounded-md p-1 hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.businessName} • {l.campaign}
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

        <Card>
          <CardHeader>
            <CardTitle>My last 14 days</CardTitle>
            <CardDescription>Your daily call and lead volume</CardDescription>
          </CardHeader>
          <CardContent>
            <PersonalTrend employeeId={session.employeeId} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function PersonalTrend({ employeeId }: { employeeId: string }) {
  const { data: points = [], isLoading } = useQuery({
    queryKey: ["personal-trend", employeeId],
    queryFn: () => api.myDailyTrend(employeeId, 14),
    select: (data) => data.map((p) => ({ ...p, date: shortDate(p.date) })),
  });

  if (isLoading) return <Skeleton className="h-[200px] w-full" />;
  if (!points.length)
    return <p className="text-sm text-muted-foreground">No activity in the last 14 days.</p>;

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full sm:h-[240px]">
      <AreaChart data={points}>
        <defs>
          <linearGradient id="agentCalls" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="calls"
          type="monotone"
          fill="url(#agentCalls)"
          fillOpacity={1}
          stroke="var(--chart-1)"
          strokeWidth={2}
        />
        <Area dataKey="leads" type="monotone" stroke="var(--chart-2)" strokeWidth={2} fill="none" />
      </AreaChart>
    </ChartContainer>
  );
}
