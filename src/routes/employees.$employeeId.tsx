import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Star } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmployeeFormDialog } from "@/components/employee-form-dialog";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AttendanceStatusBadge, LeadStatusBadge, LeaveStatusBadge } from "@/components/status-badges";
import { EmptyRow } from "@/components/table-states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { compactInr, initials, inr, longDate, num, pct, roleLabel, talkTime } from "@/lib/format";
import { addDays, api, iso } from "@/lib/mock/api";

export const Route = createFileRoute("/employees/$employeeId")({
  head: () => ({
    meta: [
      { title: "Employee Profile — Performance & Attendance | Apex CRM" },
      {
        name: "description",
        content:
          "360° agent profile: attendance record, sales performance, QA scorecards, leave history and AI analysis.",
      },
      { property: "og:title", content: "Employee Profile | Apex CRM" },
      { property: "og:description", content: "Attendance, performance, QA and AI analysis." },
    ],
  }),
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);
  const to = iso(new Date());
  const from = iso(addDays(new Date(), -29));

  const { data: emp, isLoading } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => api.getEmployee(employeeId),
  });
  const { data: perf = [] } = useQuery({
    queryKey: ["employee-perf", employeeId],
    queryFn: () => api.listPerformance({ from, to, employeeId }),
  });
  const { data: attendanceRows = [] } = useQuery({
    queryKey: ["employee-attendance", employeeId],
    queryFn: () => api.listAttendance({ from, to, employeeId }),
  });
  const { data: leads } = useQuery({
    queryKey: ["employee-leads", employeeId],
    queryFn: () => api.listLeads({ agentId: employeeId, pageSize: 8 }),
  });
  const { data: qa = [] } = useQuery({
    queryKey: ["employee-qa", employeeId],
    queryFn: () => api.listQa({ employeeId }),
  });
  const { data: leave = [] } = useQuery({
    queryKey: ["employee-leave", employeeId],
    queryFn: () => api.listLeave({ employeeId }),
  });
  const { data: ai } = useQuery({
    queryKey: ["employee-ai", employeeId],
    queryFn: () => api.aiAgentAnalysis(employeeId),
  });

  const p = perf[0];

  if (isLoading || !emp) {
    return (
      <AppShell>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link to="/employees">
          <ArrowLeft className="mr-2 size-4" /> Back to employees
        </Link>
      </Button>

      <PageHeader
        title={emp.name}
        description={`${emp.employeeId} • ${emp.team} • ${roleLabel[emp.role] ?? emp.role}`}
        actions={<Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit profile</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="size-16">
              <AvatarFallback>{initials(emp.name)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-base">{emp.name}</CardTitle>
            <CardDescription>{emp.email}</CardDescription>
            <Badge variant={emp.status === "Active" ? "default" : "secondary"}>{emp.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Separator className="mb-2" />
            <Row label="Mobile" value={emp.mobile} />
            <Row label="Manager" value={emp.manager} />
            <Row label="Shift" value={emp.shift} />
            <Row label="Joined" value={longDate(emp.joiningDate)} />
            <Row label="Leave balance" value={`${emp.leaveBalance} days`} />
            <Row label="Commission" value={`${emp.commissionRate}%`} />
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sales (30d)" value={num(p?.sales ?? 0)} />
            <StatCard label="Revenue (30d)" value={compactInr(p?.revenue ?? 0)} />
            <StatCard label="Conversion" value={pct(p?.conversion ?? 0)} />
            <StatCard label="Avg QA score" value={`${p?.qualityScore ?? 0}%`} />
          </div>

          {ai && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4" /> AI performance analysis
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  Verdict: {ai.verdict}
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-3.5 ${i < ai.stars ? "fill-current" : "opacity-30"}`}
                      />
                    ))}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {ai.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="rounded-md bg-muted p-3 text-sm">{ai.recommendation}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="qa">QA</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 30 days</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Calls made" value={num(p?.callsMade ?? 0)} />
              <Metric label="Calls connected" value={num(p?.callsConnected ?? 0)} />
              <Metric label="Leads generated" value={num(p?.leadsGenerated ?? 0)} />
              <Metric label="Avg talk time" value={talkTime(p?.avgTalkTimeSec ?? 0)} />
              <Metric label="Login hours" value={`${p?.loginHours ?? 0}h`} />
              <Metric label="Revenue" value={inr(p?.revenue ?? 0)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance — last 30 days</CardTitle>
              <CardDescription>
                Present {attendanceRows.filter((r) => r.status === "Present").length} • Late{" "}
                {attendanceRows.filter((r) => r.status === "Late").length} • Absent{" "}
                {attendanceRows.filter((r) => r.status === "Absent").length}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check in</TableHead>
                    <TableHead>Check out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRows.slice(0, 15).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{longDate(r.date)}</TableCell>
                      <TableCell>{r.checkIn ?? "—"}</TableCell>
                      <TableCell>{r.checkOut ?? "—"}</TableCell>
                      <TableCell>{r.workingHours}h</TableCell>
                      <TableCell>
                        <AttendanceStatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {attendanceRows.length === 0 && (
                    <EmptyRow cols={5} message="No attendance records in this window." />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent leads</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(leads?.rows ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Link
                          to="/leads/$leadId"
                          params={{ leadId: l.id }}
                          className="hover:underline"
                        >
                          {l.customerName}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{l.campaign}</TableCell>
                      <TableCell>
                        <LeadStatusBadge status={l.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {l.saleAmount ? inr(l.saleAmount) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(leads?.rows.length ?? 0) === 0 && (
                    <EmptyRow cols={4} message="No leads assigned yet." />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qa">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quality scorecards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qa.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No QA audits recorded for this agent.
                </p>
              )}
              {qa.slice(0, 5).map((s) => (
                <div key={s.id} className="space-y-2 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Call {s.callId} • {longDate(s.date)}
                    </p>
                    <Badge variant={s.overall >= 80 ? "default" : "secondary"}>{s.overall}%</Badge>
                  </div>
                  <Progress value={s.overall} />
                  <p className="text-sm text-muted-foreground">{s.comments}</p>
                  <p className="text-xs text-muted-foreground">Reviewed by {s.reviewerName}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave history</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">From</TableHead>
                    <TableHead className="hidden sm:table-cell">To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leave.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.type}</TableCell>
                      <TableCell className="hidden sm:table-cell">{longDate(l.from)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{longDate(l.to)}</TableCell>
                      <TableCell>{l.days}</TableCell>
                      <TableCell>
                        <LeaveStatusBadge status={l.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {leave.length === 0 && <EmptyRow cols={5} message="No leave requests." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employeeId={employeeId} />
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
