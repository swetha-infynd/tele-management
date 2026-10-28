import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileUp, Percent, Phone, PhoneCall, Upload } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { ClientNamesCell } from "@/components/client-names-cell";
import { DialUploadDialog } from "@/components/dial-upload-dialog";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
import { num, pct } from "@/lib/format";
import {
  loadDialUploads,
  uploadTotalsForCampaign,
  type ClientNameList,
  type DialUploadBatch,
} from "@/lib/dial-upload";
import { api } from "@/lib/mock/api";
import { useSession } from "@/lib/session";
import { useClientNameIndex } from "@/hooks/use-client-names";

export const Route = createFileRoute("/dial-data")({
  head: () => ({
    meta: [
      { title: "Dial Data Analysis | Apex CRM" },
      {
        name: "description",
        content:
          "Analyze dialling performance across campaigns with hour-by-hour connect and no-answer rates.",
      },
    ],
  }),
  component: DialDataPage,
});

const chartConfig = {
  connectRate: { label: "Connect Rate %", color: "var(--chart-1)" },
  noAnswerRate: { label: "No Answer Rate %", color: "var(--chart-2)" },
} satisfies ChartConfig;

interface CampaignDialRow {
  campaign: string;
  dialAttempts: number;
  connects: number;
  connectRate: number;
  noAnswerRate: number;
  busyRate: number;
  voicemailRate: number;
  dncRate: number;
  avgTalkTimeSec: number;
  fromUpload: boolean;
  uploadBatches?: number | undefined;
  /**
   * Client names extracted from the uploaded dial data (Customer / Customer Name
   * / Title + First name + Surname) — the "Client" per record.
   */
  clients: ClientNameList;
}

function pctOf(part: number, whole: number): number {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0;
}

function DialDataPage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const [range, setRange] = useState("14");
  const [uploadOpen, setUploadOpen] = useState(false);
  const days = Number(range);
  const clientNames = useClientNameIndex();

  // api.diallerAnalysis already merges localStorage uploads — do not re-merge here.
  const { data: analysis = [], isLoading } = useQuery({
    queryKey: ["dialler-analysis-all", days],
    queryFn: async () => {
      const campaigns = await api.listCampaigns();
      const results = await Promise.all(campaigns.map((c) => api.diallerAnalysis(c, days)));
      return results.map((r, i) => ({ ...r, campaign: r.campaign || campaigns[i] }));
    },
  });

  const { data: uploads = [] } = useQuery({
    queryKey: ["dial-uploads"],
    queryFn: () => loadDialUploads(),
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "apex-dial-uploads") {
        void qc.invalidateQueries({ queryKey: ["dial-uploads"] });
        void qc.invalidateQueries({ queryKey: ["dialler-analysis-all"] });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [qc]);

  if (session.role === "agent") {
    return (
      <AppShell>
        <PageHeader
          title="Dial Data"
          description="Dialler analytics are available to supervisors and admins only."
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You do not have permission to view floor-wide dial data. Check My Performance for your
            own stats.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  // Client names per campaign, extracted from the uploaded call-detail CSVs.
  const clientsFor = (name: string) => clientNames.campaign(name);

  const baseRows: CampaignDialRow[] = analysis.map((a) => ({
    campaign: a.campaign || "Unknown campaign",
    dialAttempts: a.dialAttempts,
    connects: a.connects,
    connectRate: a.connectRate,
    noAnswerRate: a.noAnswerRate,
    busyRate: a.busyRate,
    voicemailRate: a.voicemailRate,
    dncRate: a.dncRate,
    avgTalkTimeSec: a.avgTalkTimeSec,
    fromUpload: !!a.fromUpload,
    uploadBatches: a.uploadBatches,
    clients: clientsFor(a.campaign || "Unknown campaign"),
  }));

  // Append upload-only campaigns that are not in the mock feed (already merged above for known ones).
  const known = new Set(baseRows.map((r) => r.campaign));
  const uploadCampaigns = new Set(uploads.map((b) => b.campaign));
  const rows: CampaignDialRow[] = [...baseRows];
  for (const name of uploadCampaigns) {
    if (known.has(name)) continue;
    const up = uploadTotalsForCampaign(name);
    const s = up.summary;
    const dials = s.dialAttempts;
    const connects = s.connects;
    rows.push({
      campaign: name,
      dialAttempts: dials,
      connects,
      connectRate: pctOf(connects, dials),
      noAnswerRate: pctOf(s.noAnswer, dials),
      busyRate: pctOf(s.busy, dials),
      voicemailRate: pctOf(s.voicemail, dials),
      dncRate: pctOf(s.dnc, dials),
      avgTalkTimeSec: connects ? Math.round(s.talkTimeSec / connects) : 0,
      fromUpload: true,
      uploadBatches: up.batchCount,
      clients: clientsFor(name),
    });
  }

  const totals = rows.reduce(
    (acc, curr) => ({
      dials: acc.dials + curr.dialAttempts,
      connects: acc.connects + curr.connects,
    }),
    { dials: 0, connects: 0 },
  );

  const overallConnectRate = totals.dials > 0 ? (totals.connects / totals.dials) * 100 : 0;

  const chartData = rows.map((a) => ({
    campaign: a.campaign,
    connectRate: a.connectRate,
    noAnswerRate: a.noAnswerRate,
  }));

  return (
    <AppShell>
      <PageHeader
        title="Dial Data Analysis"
        description="Dialling performance and call outcomes broken down by campaign."
        actions={
          <>
            <Button
              type="button"
              size="sm"
              className="bg-purple-600 text-white shadow-sm hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="mr-2 size-4" /> Upload call data
            </Button>
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
          </>
        }
      />

      {uploads.length > 0 && (
        <Card className="border-dashed border-purple-500/35">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-md bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300">
                <FileUp className="size-3.5" />
              </span>
              Uploaded call details
              <Badge
                variant="secondary"
                className="bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300"
              >
                {uploads.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Imported Infynd CSVs are merged into Dial Data, campaign pages, and reports — and
              persist in this browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-4">
            {uploads.slice(0, 12).map((b: DialUploadBatch) => (
              <div
                key={b.id}
                className="grid gap-1 rounded-lg border border-purple-500/25 bg-purple-500/5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{b.campaign}</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {num(b.rowCount)} rows
                  </Badge>
                </div>
                {(b.rawCampaignNames?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {b.rawCampaignNames!.slice(0, 4).map((n) => (
                      <Badge
                        key={n}
                        variant="outline"
                        className="px-1.5 py-0 text-[9px] font-normal text-purple-700 dark:text-purple-300"
                      >
                        {n}
                      </Badge>
                    ))}
                    {b.rawCampaignNames!.length > 4 && (
                      <span className="text-[9px] text-muted-foreground">
                        +{b.rawCampaignNames!.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Total Dial Attempts"
          value={num(totals.dials)}
          icon={Phone}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Total Connects"
          value={num(totals.connects)}
          icon={PhoneCall}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
        />
        <StatCard
          label="Avg Connect Rate"
          value={pct(overallConnectRate)}
          icon={Percent}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Campaign Performance Comparison</CardTitle>
          <CardDescription>Connect Rate vs No Answer Rate by Campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="campaign" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend verticalAlign="top" height={36} />
              <Bar
                dataKey="connectRate"
                name="Connect Rate %"
                fill="var(--color-connectRate)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="noAnswerRate"
                name="No Answer Rate %"
                fill="var(--color-noAnswerRate)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Campaign Breakdown</CardTitle>
          <CardDescription>
            Mock dialler feed combined with imported call-detail CSVs
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Campaign</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="text-right">Dials</TableHead>
                <TableHead className="text-right">Connects</TableHead>
                <TableHead className="text-right">Connect %</TableHead>
                <TableHead className="text-right">No Answer %</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Busy %</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Voicemail %</TableHead>
                <TableHead className="text-right hidden md:table-cell">DNC %</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={10} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={10} message="No dial data found." />
              ) : (
                rows.map((row) => (
                  <TableRow key={row.campaign}>
                    <TableCell className="pl-6 font-medium">{row.campaign}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      <ClientNamesCell names={row.clients.names} total={row.clients.total} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.dialAttempts)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(row.connects)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(row.connectRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(row.noAnswerRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      {pct(row.busyRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      {pct(row.voicemailRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {pct(row.dncRate)}
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {row.fromUpload ? (
                        <Badge
                          variant="secondary"
                          className="bg-purple-500/15 text-[10px] text-purple-700 dark:bg-purple-500/25 dark:text-purple-300"
                        >
                          {row.uploadBatches && row.uploadBatches > 0
                            ? `Feed + ${row.uploadBatches} upload${row.uploadBatches > 1 ? "s" : ""}`
                            : "Upload"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Feed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DialUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </AppShell>
  );
}
