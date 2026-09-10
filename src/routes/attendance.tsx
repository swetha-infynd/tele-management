import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { CheckInWidget } from "@/components/check-in-widget";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AttendanceStatusBadge } from "@/components/status-badges";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { longDate, pct } from "@/lib/format";
import { addDays, api, iso } from "@/lib/mock/api";
import { useTeamScope } from "@/lib/session";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance & Shift Tracking | Apex CRM" },
      {
        name: "description",
        content:
          "Track check-in/check-out, late logins, working hours, overtime and absenteeism across every BPO team.",
      },
      { property: "og:title", content: "Attendance & Shift Tracking | Apex CRM" },
      { property: "og:description", content: "Check-ins, late logins, working hours and overtime." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const scope = useTeamScope();
  const [from, setFrom] = useState(iso(addDays(new Date(), -6)));
  const [to, setTo] = useState(iso(new Date()));
  const [team, setTeam] = useState(scope ?? "all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const params = { from, to, team, status, search };
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["attendance", params],
    queryFn: () => api.listAttendance(params),
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: daily = [] } = useQuery({
    queryKey: ["attendance-summary", from, to, team],
    queryFn: () => api.attendanceSummary({ from, to, team }),
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
        description="Shift logins, working hours, late marks and absenteeism."
        actions={
          <ExportMenu
            filename="attendance"
            columns={["Date", "Employee", "Team", "Check in", "Check out", "Hours", "OT", "Status"]}
            rows={rows.map((r) => [
              r.date,
              r.employeeName,
              r.team,
              r.checkIn ?? "—",
              r.checkOut ?? "—",
              r.workingHours,
              r.overtimeHours,
              r.status,
            ])}
          />
        }
      />

      <CheckInWidget />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attendance rate" value={pct(attendanceRate)} />
        <StatCard label="Present days" value={String(totals.present)} />
        <StatCard label="Late logins" value={String(totals.late)} />
        <StatCard label="Absent days" value={String(totals.absent)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance register</CardTitle>
          <div className="flex flex-col gap-2 pt-2 lg:flex-row lg:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="from" className="text-xs">
                From
              </Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
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
            />
            <Select value={team} onValueChange={setTeam} disabled={!!scope}>
              <SelectTrigger className="lg:w-[160px]">
                <SelectValue placeholder="Team" />
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
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden md:table-cell">Team</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead className="hidden sm:table-cell">Check out</TableHead>
                <TableHead className="hidden lg:table-cell">Hours</TableHead>
                <TableHead className="hidden xl:table-cell">Late (min)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={8} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={8} message="No attendance records for this range." />
              ) : (
                rows.slice(0, 60).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{longDate(r.date)}</TableCell>
                    <TableCell className="font-medium">{r.employeeName}</TableCell>
                    <TableCell className="hidden md:table-cell">{r.team}</TableCell>
                    <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">{r.checkIn ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell font-medium text-rose-600 dark:text-rose-400">{r.checkOut ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{r.workingHours}h</TableCell>
                    <TableCell className="hidden xl:table-cell">{r.lateMinutes || "—"}</TableCell>
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
    </AppShell>
  );
}
