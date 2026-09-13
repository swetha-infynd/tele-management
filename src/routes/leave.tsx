import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { LeaveStatusBadge } from "@/components/status-badges";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { longDate } from "@/lib/format";
import { api, ApiError } from "@/lib/mock/api";
import type { LeaveType } from "@/lib/mock/types";
import { useSession, useTeamScope } from "@/lib/session";

export const Route = createFileRoute("/leave")({
  head: () => ({
    meta: [
      { title: "Leave Management — Requests & Approvals | Apex CRM" },
      {
        name: "description",
        content:
          "Apply for leave, track balances, approve or reject requests and view the company holiday calendar.",
      },
      { property: "og:title", content: "Leave Management | Apex CRM" },
      { property: "og:description", content: "Leave requests, approvals and holiday calendar." },
    ],
  }),
  component: LeavePage,
});

function LeavePage() {
  const { session, can } = useSession();
  const scope = useTeamScope();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "Casual" as LeaveType,
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const isAgent = session.role === "agent";
  const params = {
    status,
    ...(isAgent ? { employeeId: session.employeeId } : {}),
    ...(scope && !isAgent ? { team: scope } : {}),
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leave", params],
    queryFn: () => api.listLeave(params),
  });
  const { data: holidays = [] } = useQuery({ queryKey: ["holidays"], queryFn: api.listHolidays });
  const { data: me } = useQuery({
    queryKey: ["employee", session.employeeId],
    queryFn: () => api.getEmployee(session.employeeId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["leave"] });
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : "Request failed");

  const apply = useMutation({
    mutationFn: () =>
      api.applyLeave({
        employeeId: session.employeeId,
        type: form.type,
        from: form.from,
        to: form.to,
        reason: form.reason,
      }),
    onSuccess: () => {
      toast.success("Leave request submitted", {
        description: "Your team leader has been notified.",
      });
      setOpen(false);
      setForm((f) => ({ ...f, reason: "" }));
      invalidate();
    },
    onError,
  });

  const decide = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "Approved" | "Rejected" }) =>
      api.decideLeave(id, next, session.name),
    onSuccess: (r) => {
      toast.success(`Request ${r.status.toLowerCase()}`);
      invalidate();
    },
    onError,
  });

  const pending = rows.filter((r) => r.status === "Pending").length;
  const approved = rows.filter((r) => r.status === "Approved").length;

  return (
    <AppShell>
      <PageHeader
        title="Leave management"
        description="Apply for time off, track balances and clear pending approvals."
        actions={
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <CalendarPlus className="mr-2 size-4" /> Apply for leave
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My leave balance" value={`${me?.leaveBalance ?? 0} days`} />
        <StatCard label="Pending requests" value={String(pending)} />
        <StatCard label="Approved" value={String(approved)} />
        <StatCard label="Upcoming holidays" value={String(holidays.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Leave requests</CardTitle>
                <CardDescription>
                  {can("approve_leave") ? "Approve or reject team requests." : "Your requests."}
                </CardDescription>
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  {can("approve_leave") && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton cols={6} />
                ) : rows.length === 0 ? (
                  <EmptyRow cols={6} message="No leave requests found." />
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.employeeName}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {longDate(r.from)} → {longDate(r.to)}
                      </TableCell>
                      <TableCell>{r.days}</TableCell>
                      <TableCell>
                        <LeaveStatusBadge status={r.status} />
                      </TableCell>
                      {can("approve_leave") && (
                        <TableCell className="text-right">
                          {r.status === "Pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                aria-label="Approve"
                                onClick={() => decide.mutate({ id: r.id, next: "Approved" })}
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                aria-label="Reject"
                                onClick={() => decide.mutate({ id: r.id, next: "Rejected" })}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {r.decidedBy ? `by ${r.decidedBy}` : "—"}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Holiday calendar</CardTitle>
            <CardDescription>Paid company holidays for this year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {holidays.map((h) => (
              <div key={h.date} className="flex items-center justify-between text-sm">
                <span>{h.name}</span>
                <span className="text-muted-foreground">{longDate(h.date)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for leave</DialogTitle>
            <DialogDescription>
              Requests are routed to your team leader for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Leave type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as LeaveType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Casual", "Sick", "Earned", "Unpaid"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="lfrom">From</Label>
                <Input
                  id="lfrom"
                  type="date"
                  value={form.from}
                  onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lto">To</Label>
                <Input
                  id="lto"
                  type="date"
                  value={form.to}
                  onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Family function, medical appointment…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
