import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type ReportResult, type ReportType } from "@/lib/mock/api";
import { useSession, useTeamScope } from "@/lib/session";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Exports | Apex CRM" },
      {
        name: "description",
        content:
          "Generate daily, weekly, monthly, team, attendance, sales and revenue reports and export them to CSV, Excel or PDF.",
      },
      { property: "og:title", content: "Reports & Exports | Apex CRM" },
      {
        property: "og:description",
        content: "Configurable operational and sales reporting for BPO teams.",
      },
    ],
  }),
  component: ReportsPage,
});

const TYPES: Array<{ value: ReportType; label: string; hint: string }> = [
  { value: "daily", label: "Daily performance", hint: "Per-agent activity for the range" },
  { value: "weekly", label: "Weekly summary", hint: "Rolled-up weekly totals" },
  { value: "monthly", label: "Monthly summary", hint: "Month-to-date performance" },
  { value: "team", label: "Team comparison", hint: "Team versus team output" },
  { value: "attendance", label: "Attendance", hint: "Present, late and absent days" },
  { value: "sales", label: "Sales", hint: "Closed sales by agent" },
  { value: "revenue", label: "Revenue", hint: "Revenue booked by agent" },
  { value: "conversion", label: "Conversion", hint: "Lead to sale conversion" },
  { value: "agent", label: "Agent scorecard", hint: "Full per-agent scorecard" },
  { value: "campaign", label: "Campaign rollup", hint: "One row per campaign with attainment" },
  {
    value: "campaign_agent",
    label: "Campaign → agent",
    hint: "Hierarchical: each campaign broken down by agent",
  },
  { value: "dialler", label: "Dialler outcomes", hint: "Call outcomes and talk time by hour" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function ReportsPage() {
  const { can } = useSession();
  const scope = useTeamScope();
  const [type, setType] = useState<ReportType>("daily");
  const [team, setTeam] = useState<string>(scope ?? "all");
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [campaign, setCampaign] = useState<string>("all");
  const [result, setResult] = useState<ReportResult | null>(null);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.listCampaigns,
  });

  const generate = useMutation({
    mutationFn: () =>
      api.generateReport(type, {
        from,
        to,
        ...(team === "all" ? {} : { team }),
        ...(campaign === "all" ? {} : { campaign }),
      }),

    onSuccess: (r) => {
      setResult(r);
      toast.success(`${r.title} generated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("view_reports")) {
    return (
      <AppShell>
        <PageHeader title="Reports" description="Reporting is restricted for your role." />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You do not have permission to view reports. Contact your manager for access.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Build operational and sales reports, then export them in one click."
        actions={
          result && (
            <ExportMenu
              filename={result.title.toLowerCase().replace(/\s+/g, "-")}
              columns={result.columns}
              rows={result.rows}
            />
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report builder</CardTitle>
          <CardDescription>
            Choose a report type, date range, team and campaign scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="grid gap-2">
            <Label>Report type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TYPES.find((t) => t.value === type)?.hint}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Team</Label>
            <Select value={team} onValueChange={setTeam} disabled={!!scope}>
              <SelectTrigger>
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
          </div>
          <div className="grid gap-2">
            <Label>Campaign</Label>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Button variant="secondary" onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? "Generating…" : "Generate report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{result?.title ?? "Report output"}</CardTitle>
          <CardDescription>
            {result
              ? `Generated ${new Date(result.generatedAt).toLocaleString("en-GB")} · ${result.rows.length} rows`
              : "Run the builder above to see results here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          {result && result.summary.length > 0 && (
            <>
              <div className="grid gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
                {result.summary.map((s) => (
                  <div key={s.label} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-semibold">{s.value}</p>
                  </div>
                ))}
              </div>
              <Separator />
            </>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {(result?.columns ?? ["Result"]).map((c, i) => (
                  <TableHead key={c} className={i === 0 ? "" : "text-right"}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {generate.isPending ? (
                <TableSkeleton cols={result?.columns.length ?? 4} />
              ) : !result ? (
                <EmptyRow cols={1} message="No report generated yet." />
              ) : result.rows.length === 0 ? (
                <EmptyRow
                  cols={result.columns.length}
                  message="No data found for the selected range."
                />
              ) : (
                result.rows.map((row, ri) => (
                  <TableRow key={ri}>
                    {row.map((cell, ci) => (
                      <TableCell
                        key={ci}
                        className={ci === 0 ? "font-medium" : "text-right tabular-nums"}
                      >
                        {cell}
                      </TableCell>
                    ))}
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
