import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Info } from "lucide-react";

import { AttendanceStatusBadge } from "@/components/status-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { api } from "@/lib/mock/api";
import type { HourlyCampaignLog } from "@/lib/mock/types";
import { useSession } from "@/lib/session";

const CAMPAIGN_COLORS: Record<string, string> = {
  "Solar UK": "bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300 border-sky-500/30",
  "Medicare US":
    "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30",
  "Web Design AU":
    "bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300 border-purple-500/30",
  "Insurance CA":
    "bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30",
  "SEO Retainer":
    "bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300 border-rose-500/30",
};

const colorFor = (campaign: string) =>
  CAMPAIGN_COLORS[campaign] ??
  "bg-slate-500/15 text-slate-700 dark:bg-slate-500/25 dark:text-slate-300 border-slate-500/30";

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

/** "mine" = my own timeline (any role); "agents" = matrix of every in-scope agent. */
type View = "mine" | "agents";

export function HourlyCampaignView({ team, employeeId }: { team?: string; employeeId?: string }) {
  const { session } = useSession();
  const isAgent = session.role === "agent";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // Agents only ever see their own attendance; BDE/admin can toggle.
  const [view, setView] = useState<View>(isAgent ? "mine" : "agents");

  const showMine = isAgent || view === "mine";
  const showAgents = !isAgent && view === "agents";

  const queryTeam = team === "all" ? undefined : team;
  const selfId = employeeId ?? session.employeeId;

  // Self timeline — agents always; BDE/admin when toggled to "My activity".
  const { data: myLogs = [], isLoading: myLoading } = useQuery({
    queryKey: ["hourly-campaigns", date, "self", selfId],
    queryFn: () => api.listHourlyCampaignLogs({ date, employeeId: selfId }),
    enabled: showMine,
  });

  // Matrix — BDE: own team, admin: everyone (role "agent").
  const { data: logs = [], isLoading: matrixLoading } = useQuery({
    queryKey: ["hourly-campaigns", date, queryTeam ?? "all", "matrix"],
    queryFn: () => api.listHourlyCampaignLogs({ date, ...(queryTeam ? { team: queryTeam } : {}) }),
    enabled: showAgents,
  });
  const { data: agentsPage, isLoading: agentsLoading } = useQuery({
    queryKey: ["employees", "hourly-matrix", queryTeam ?? "all"],
    queryFn: () =>
      api.listEmployees({
        role: "agent",
        pageSize: 500,
        ...(queryTeam ? { team: queryTeam } : {}),
      }),
    enabled: showAgents,
  });
  // Attendance status for the date so absent / on-leave agents appear too.
  const { data: attendanceRows = [] } = useQuery({
    queryKey: ["attendance", "hourly-date", date, queryTeam ?? "all"],
    queryFn: () => api.listAttendance({ date, ...(queryTeam ? { team: queryTeam } : {}) }),
    enabled: showAgents,
  });

  const byEmployee = new Map<string, HourlyCampaignLog[]>();
  for (const log of logs) {
    const arr = byEmployee.get(log.employeeId) ?? [];
    arr.push(log);
    byEmployee.set(log.employeeId, arr);
  }
  const hours = Array.from(new Set(logs.map((l) => l.hour))).sort((a, b) => a - b);
  const attByEmp = new Map(attendanceRows.map((a) => [a.employeeId, a]));

  type MatrixRow = {
    id: string;
    name: string;
    team: string;
    att: (typeof attendanceRows)[number] | undefined;
    logs: HourlyCampaignLog[];
  };
  // Every in-scope agent (even with no dial activity), plus any log-only leftovers.
  const agents = agentsPage?.rows ?? [];
  const matrixRows: MatrixRow[] = [
    ...agents.map((e) => ({
      id: e.id,
      name: e.name,
      team: e.team,
      att: attByEmp.get(e.id),
      logs: byEmployee.get(e.id) ?? [],
    })),
    ...[...byEmployee.entries()]
      .filter(([id]) => !agents.some((e) => e.id === id))
      .map(([id, empLogs]) => ({
        id,
        name: empLogs[0]?.employeeName ?? id,
        team: empLogs[0]?.team ?? "—",
        att: attByEmp.get(id),
        logs: empLogs,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const header = (
    <>
      <CardTitle className="text-base flex items-center gap-2">
        <Clock className="size-4" />
        {showMine
          ? "My hour-wise campaign log"
          : session.role === "admin"
            ? "Hour-wise campaign tracking"
            : "My team's hour-wise campaign tracking"}
      </CardTitle>
      <CardDescription>
        {showMine ? (
          "Which campaign you worked on each hour of the day, derived from dialler activity."
        ) : (
          <span className="inline-flex items-center gap-1">
            <Info className="size-3" />
            Per agent, per hour: which campaign they dialled on — everyone in scope, including
            absent and on-leave team members.
          </span>
        )}
      </CardDescription>
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div className="grid gap-1.5">
          <Label htmlFor="hourly-date" className="text-xs">
            Date
          </Label>
          <Input
            id="hourly-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="max-w-[180px]"
          />
        </div>
        {!isAgent && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(v) => {
              if (v) setView(v as View);
            }}
          >
            <ToggleGroupItem value="mine">My activity</ToggleGroupItem>
            <ToggleGroupItem value="agents">
              {session.role === "admin" ? "Everyone" : "My team"}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
    </>
  );

  if (showMine) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hour</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Dials</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Connects</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Approx. minutes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myLoading ? (
                <TableSkeleton cols={5} />
              ) : myLogs.length === 0 ? (
                <EmptyRow cols={5} message="No campaign activity recorded for this date." />
              ) : (
                myLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium tabular-nums">
                      {hourLabel(log.hour)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={colorFor(log.campaign)}>
                        {log.campaign}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{log.dials}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">
                      {log.connects}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">
                      {log.minutes}m
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent className="overflow-x-auto px-0">
        {matrixLoading || agentsLoading ? (
          <div className="px-6">
            <TableSkeleton cols={Math.max(3, hours.length + 2)} />
          </div>
        ) : matrixRows.length === 0 ? (
          <div className="px-6">
            <EmptyRow
              cols={Math.max(3, hours.length + 2)}
              message="No agents found for this scope."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Agent</TableHead>
                {hours.map((h) => (
                  <TableHead key={h} className="text-center tabular-nums min-w-[90px]">
                    {hourLabel(h)}
                  </TableHead>
                ))}
                <TableHead className="text-right">Dials</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrixRows.map((row) => {
                const totalDials = row.logs.reduce((s, l) => s + l.dials, 0);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="sticky left-0 bg-background">
                      <span className="font-medium">{row.name}</span>
                      <p className="text-xs text-muted-foreground">{row.team}</p>
                      <span className="mt-1 inline-flex">
                        {row.att ? (
                          <AttendanceStatusBadge status={row.att.status} />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Not marked</span>
                        )}
                      </span>
                    </TableCell>
                    {hours.map((h) => {
                      const cell = row.logs.filter((l) => l.hour === h);
                      if (!cell.length)
                        return (
                          <TableCell key={h} className="text-center text-muted-foreground">
                            —
                          </TableCell>
                        );
                      return (
                        <TableCell key={h} className="p-1">
                          <div className="flex flex-col gap-0.5">
                            {cell.map((log) => (
                              <div
                                key={log.id}
                                className={`rounded border px-1.5 py-0.5 text-[11px] leading-tight ${colorFor(log.campaign)}`}
                                title={`${log.campaign}: ${log.dials} dials, ${log.connects} connects, ~${log.minutes}m`}
                              >
                                <span className="block truncate font-medium">{log.campaign}</span>
                                <span className="block text-muted-foreground">
                                  {log.dials}d · {log.connects}c
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right tabular-nums">{totalDials || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
