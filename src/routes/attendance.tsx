import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Percent, UserCheck, UserX } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CampaignDayBar } from "@/components/campaign-day-bar";
import { CheckInWidget } from "@/components/check-in-widget";
import { ClientNamesCell } from "@/components/client-names-cell";
import { ExportMenu } from "@/components/export-menu";
import { HourlyCampaignView } from "@/components/hourly-campaign-view";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AttendanceStatusBadge } from "@/components/status-badges";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { clientNamesText } from "@/lib/dial-upload";
import { longDate, pct } from "@/lib/format";
import { addDays, api, iso } from "@/lib/mock/api";
import { useSession, useTeamScope } from "@/lib/session";
import { useClientNameIndex } from "@/hooks/use-client-names";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance & Shift Tracking | Apex CRM" },
      {
        name: "description",
        content:
          "Track check-in/check-out, late logins, working hours, overtime and hour-wise campaign activity across every BPO team.",
      },
      { property: "og:title", content: "Attendance & Shift Tracking | Apex CRM" },
      {
        property: "og:description",
        content: "Check-ins, late logins, working hours, overtime and hour-wise campaigns.",
      },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { session } = useSession();
  const scope = useTeamScope();
  const isAgent = session.role === "agent";
  // Agents are always self-only; admin/BDE can toggle to their own register.
  const [view, setView] = useState<"mine" | "team">(isAgent ? "mine" : "team");
  const showMine = isAgent || view === "mine";
  const [tab, setTab] = useState("daywise");
  const [from, setFrom] = useState(iso(addDays(new Date(), -6)));
  const [to, setTo] = useState(iso(new Date()));
  const [team, setTeam] = useState(scope ?? "all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const clientNames = useClientNameIndex();

  const params = {
    from,
    to,
    status,
    // "My attendance" isolates the signed-in user's own rows (any role).
    ...(showMine ? { employeeId: session.employeeId } : { team, search }),
  };
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["attendance", params],
    queryFn: () => api.listAttendance(params),
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: dayBars = [] } = useQuery({
    queryKey: ["campaign-day-bars", from, to, showMine ? session.employeeId : team],
    queryFn: () =>
      api.listDailyCampaignBars({
        from,
        to,
        ...(showMine ? { employeeId: session.employeeId } : { team }),
      }),
  });
  // employeeId|date → campaign mix for that day (the stacked campaign bar).
  const barByKey = new Map(dayBars.map((b) => [`${b.employeeId}|${b.date}`, b]));
  const { data: daily = [] } = useQuery({
    queryKey: ["attendance-summary", from, to, showMine ? session.employeeId : team],
    queryFn: () =>
      api.attendanceSummary({
        from,
        to,
        ...(showMine ? { employeeId: session.employeeId } : { team }),
      }),
  });

  const totals = daily.reduce(
    (a, d) => ({
      present: a.present + d.present,
      late: a.late + d.late,
      absent: a.absent + d.absent,
      leave: a.leave + d.leave,
    }),
    { present: 0, late: 0, absent: 0, leave: 0 },
  );
  const marked = totals.present + totals.late + totals.absent + totals.leave;
  const attendanceRate = marked ? ((totals.present + totals.late) / marked) * 100 : 0;

  return (
    <AppShell>
      <PageHeader
        title="Attendance"
        description="Shift logins, working hours and hour-wise campaign activity."
        actions={
          tab === "daywise" ? (
            <ExportMenu
              filename="attendance"
              columns={[
                "Date",
                "Employee",
                "Client",
                "Check in",
                "Check out",
                "Hours",
                "OT",
                "Status",
              ]}
              rows={rows.map((r) => [
                r.date,
                r.employeeName,
                clientNamesText(clientNames.agent(r.employeeName)),
                r.checkIn ?? "—",
                r.checkOut ?? "—",
                r.workingHours,
                r.overtimeHours,
                r.status,
              ])}
            />
          ) : undefined
        }
      />

      <CheckInWidget />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance rate"
          value={pct(attendanceRate)}
          icon={Percent}
          iconClassName="bg-indigo-500/15 text-gray-700 dark:bg-indigo-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Present days"
          value={String(totals.present)}
          icon={UserCheck}
          iconClassName="bg-emerald-500/15 text-gray-700 dark:bg-emerald-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Late logins"
          value={String(totals.late)}
          icon={Clock}
          iconClassName="bg-amber-500/15 text-gray-700 dark:bg-amber-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Absent days"
          value={String(totals.absent)}
          icon={UserX}
          iconClassName="bg-rose-500/15 text-gray-700 dark:bg-rose-500/25 dark:text-gray-300"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="daywise">Daywise</TabsTrigger>
          <TabsTrigger value="hourly">Hour-wise campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="daywise" className="space-y-6 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance register</CardTitle>
              <div className="flex flex-col gap-2 pt-2 lg:flex-row lg:items-end">
                <div className="grid gap-1.5">
                  <Label htmlFor="from" className="text-xs">
                    From
                  </Label>
                  <Input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="to" className="text-xs">
                    To
                  </Label>
                  <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <Input
                  placeholder="Search employee…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="lg:max-w-xs"
                  disabled={showMine}
                />
                <Select value={team} onValueChange={setTeam} disabled={!!scope || showMine}>
                  <SelectTrigger className="lg:w-[160px]">
                    <SelectValue placeholder="Client" />
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
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="lg:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["Present", "Late", "Absent", "Leave", "Half Day"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isAgent && (
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={view}
                    onValueChange={(v) => {
                      if (v) setView(v as "mine" | "team");
                    }}
                    className="lg:ml-auto"
                  >
                    <ToggleGroupItem value="team">
                      {session.role === "admin" ? "Everyone" : "My team"}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="mine">My attendance</ToggleGroupItem>
                  </ToggleGroup>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead>Check in</TableHead>
                    <TableHead className="hidden sm:table-cell">Check out</TableHead>
                    <TableHead className="hidden lg:table-cell">Hours</TableHead>
                    <TableHead className="hidden xl:table-cell">Late (min)</TableHead>
                    <TableHead className="hidden lg:table-cell">Campaigns worked</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton cols={9} />
                  ) : rows.length === 0 ? (
                    <EmptyRow cols={9} message="No attendance records for this range." />
                  ) : (
                    rows.slice(0, 60).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{longDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.employeeName}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <ClientNamesCell {...clientNames.agent(r.employeeName)} />
                        </TableCell>
                        <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                          {r.checkIn ?? "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell font-medium text-rose-600 dark:text-rose-400">
                          {r.checkOut ?? "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{r.workingHours}h</TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {r.lateMinutes || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <CampaignDayBar
                            segments={barByKey.get(`${r.employeeId}|${r.date}`)?.segments ?? []}
                          />
                        </TableCell>
                        <TableCell>
                          <AttendanceStatusBadge status={r.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="pt-2">
          <HourlyCampaignView {...(scope ? { team: scope } : { team })} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
