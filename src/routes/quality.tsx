import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Award, FileCheck, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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
import { api } from "@/lib/mock/api";
import { useSession, useTeamScope } from "@/lib/session";

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title: "Quality Monitoring & Call QA Scorecards | Apex CRM" },
      {
        name: "description",
        content:
          "Review call quality scorecards, track QA parameters and log new evaluations for every agent on the floor.",
      },
      { property: "og:title", content: "Quality Monitoring | Apex CRM" },
      {
        property: "og:description",
        content: "Call QA scorecards, parameter breakdowns and coaching notes.",
      },
    ],
  }),
  component: QualityPage,
});

const PARAMS = [
  { key: "opening", label: "Opening & greeting" },
  { key: "verification", label: "Customer verification" },
  { key: "pitch", label: "Product pitch" },
  { key: "objectionHandling", label: "Objection handling" },
  { key: "compliance", label: "Compliance" },
  { key: "closing", label: "Closing" },
] as const;

type ParamKey = (typeof PARAMS)[number]["key"];

function QualityPage() {
  const { session, can } = useSession();
  const scope = useTeamScope();
  const qc = useQueryClient();
  const [team, setTeam] = useState<string>(scope ?? "all");
  const [open, setOpen] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["qa", team],
    queryFn: () => api.listQa({ team }),
  });
  const { data: employees } = useQuery({
    queryKey: ["employees", "all"],
    queryFn: () => api.listEmployees({ pageSize: 200 }),
  });

  const [form, setForm] = useState({
    employeeId: "",
    callId: "",
    comments: "",
    scores: {
      opening: 8,
      verification: 8,
      pitch: 7,
      objectionHandling: 7,
      compliance: 9,
      closing: 7,
    } as Record<ParamKey, number>,
  });

  const previewOverall = Math.round(
    (Object.values(form.scores).reduce((s, v) => s + v, 0) / 60) * 100,
  );

  const create = useMutation({
    mutationFn: () =>
      api.createQa({
        employeeId: form.employeeId,
        reviewerId: session.employeeId,
        callId: form.callId || `CALL-${Math.floor(Math.random() * 90000 + 10000)}`,
        date: new Date().toISOString().slice(0, 10),
        scores: form.scores,
        comments: form.comments,
      }),
    onSuccess: () => {
      toast.success("Scorecard submitted");
      setOpen(false);
      setForm((f) => ({ ...f, callId: "", comments: "" }));
      qc.invalidateQueries({ queryKey: ["qa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    if (!rows.length) return { avg: 0, best: 0, worst: 0, count: 0, params: {} as Record<string, number> };
    const avg = Math.round(rows.reduce((s, r) => s + r.overall, 0) / rows.length);
    const params: Record<string, number> = {};
    for (const p of PARAMS) {
      params[p.key] =
        Math.round((rows.reduce((s, r) => s + r.scores[p.key], 0) / rows.length) * 10) / 10;
    }
    return {
      avg,
      best: Math.max(...rows.map((r) => r.overall)),
      worst: Math.min(...rows.map((r) => r.overall)),
      count: rows.length,
      params,
    };
  }, [rows]);

  return (
    <AppShell>
      <PageHeader
        title="Quality monitoring"
        description="Call evaluations, scorecards and coaching feedback across the floor."
        actions={
          <>
            <Select value={team} onValueChange={setTeam} disabled={!!scope}>
              <SelectTrigger className="w-[160px]">
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
            <ExportMenu
              filename="qa-scorecards"
              columns={["Date", "Agent", "Client", "Reviewer", "Call ID", "Score"]}
              rows={rows.map((r) => [
                r.date,
                r.employeeName,
                r.team,
                r.reviewerName,
                r.callId,
                r.overall,
              ])}
            />
            {can("review_qa") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">New evaluation</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Log a call evaluation</DialogTitle>
                    <DialogDescription>
                      Score each parameter out of 10. The overall score is calculated automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Agent</Label>
                      <Select
                        value={form.employeeId}
                        onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {(employees?.rows ?? []).map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name} — {e.team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="callId">Call ID</Label>
                      <Input
                        id="callId"
                        placeholder="CALL-48120"
                        value={form.callId}
                        onChange={(e) => setForm((f) => ({ ...f, callId: e.target.value }))}
                      />
                    </div>
                    {PARAMS.map((p) => (
                      <div key={p.key} className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label>{p.label}</Label>
                          <span className="text-sm text-muted-foreground">
                            {form.scores[p.key]}/10
                          </span>
                        </div>
                        <Slider
                          value={[form.scores[p.key]]}
                          min={0}
                          max={10}
                          step={1}
                          onValueChange={([v]) =>
                            setForm((f) => ({ ...f, scores: { ...f.scores, [p.key]: v ?? 0 } }))
                          }
                        />
                      </div>
                    ))}
                    <div className="grid gap-2">
                      <Label htmlFor="comments">Coaching comments</Label>
                      <Textarea
                        id="comments"
                        rows={3}
                        value={form.comments}
                        onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                        placeholder="What went well and what to improve…"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm text-muted-foreground">Overall score</span>
                      <span className="text-xl font-semibold">{previewOverall}%</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (!form.employeeId) {
                          toast.error("Select an agent first");
                          return;
                        }
                        create.mutate();
                      }}
                      disabled={create.isPending}
                    >
                      {create.isPending ? "Submitting…" : "Submit scorecard"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Evaluations"
          value={String(stats.count)}
          icon={FileCheck}
          iconClassName="bg-indigo-500/15 text-gray-700 dark:bg-indigo-500/25 dark:text-gray-300"
          hint="In current scope"
        />
        <StatCard
          label="Average score"
          value={`${stats.avg}%`}
          icon={Award}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
          hint="All parameters"
        />
        <StatCard
          label="Highest score"
          value={`${stats.best}%`}
          icon={TrendingUp}
          iconClassName="bg-emerald-500/15 text-gray-700 dark:bg-emerald-500/25 dark:text-gray-300"
          hint="Best evaluated call"
        />
        <StatCard
          label="Lowest score"
          value={`${stats.worst}%`}
          icon={TrendingDown}
          iconClassName="bg-rose-500/15 text-gray-700 dark:bg-rose-500/25 dark:text-gray-300"
          hint="Needs coaching"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parameter breakdown</CardTitle>
          <CardDescription>Average score per QA parameter (out of 10).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {PARAMS.map((p) => {
            const v = stats.params[p.key] ?? 0;
            return (
              <div key={p.key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{p.label}</span>
                  <span className="text-muted-foreground">{v}/10</span>
                </div>
                <Progress value={v * 10} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scorecards</CardTitle>
          <CardDescription>Most recent evaluations first.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="hidden lg:table-cell">Reviewer</TableHead>
                <TableHead className="hidden sm:table-cell">Call ID</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={6} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={6} message="No evaluations recorded yet." />
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{longDate(r.date)}</TableCell>
                    <TableCell>
                      <Link
                        to="/employees/$employeeId"
                        params={{ employeeId: r.employeeId }}
                        className="font-medium hover:underline"
                      >
                        {r.employeeName}
                      </Link>
                      {r.comments && (
                        <p className="max-w-sm truncate text-xs text-muted-foreground">
                          {r.comments}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{r.team}</TableCell>
                    <TableCell className="hidden lg:table-cell">{r.reviewerName}</TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">
                      {r.callId}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          r.overall >= 85 ? "default" : r.overall >= 70 ? "secondary" : "destructive"
                        }
                      >
                        {r.overall}%
                      </Badge>
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
