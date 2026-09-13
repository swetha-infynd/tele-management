import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { num, pct } from "@/lib/format";
import { api } from "@/lib/mock/api";

export const Route = createFileRoute("/dial-data")({
  head: () => ({
    meta: [
      { title: "Dial Data Analysis | Apex CRM" },
      { name: "description", content: "Analyze dialling performance across campaigns." },
    ],
  }),
  component: DialDataPage,
});

const chartConfig = {
  connectRate: { label: "Connect Rate %", color: "var(--chart-1)" },
  noAnswerRate: { label: "No Answer Rate %", color: "var(--chart-2)" },
} satisfies ChartConfig;

function DialDataPage() {
  const [range, setRange] = useState("14");
  const days = Number(range);

  const { data: analysis = [], isLoading } = useQuery({
    queryKey: ["dialler-analysis-all", days],
    queryFn: async () => {
      const campaigns = await api.listCampaigns();
      const results = await Promise.all(campaigns.map((c) => api.diallerAnalysis(c, days)));
      return results.map((r, i) => ({ ...r, campaign: campaigns[i] }));
    },
  });

  const totals = analysis.reduce(
    (acc, curr) => ({
      dials: acc.dials + curr.dialAttempts,
      connects: acc.connects + curr.connects,
    }),
    { dials: 0, connects: 0 }
  );

  const overallConnectRate = totals.dials > 0 ? (totals.connects / totals.dials) * 100 : 0;

  const chartData = analysis.map((a) => ({
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
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard label="Total Dial Attempts" value={num(totals.dials)} />
        <StatCard label="Total Connects" value={num(totals.connects)} />
        <StatCard label="Avg Connect Rate" value={pct(overallConnectRate)} />
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
              <Bar dataKey="connectRate" name="Connect Rate %" fill="var(--color-connectRate)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="noAnswerRate" name="No Answer Rate %" fill="var(--color-noAnswerRate)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Campaign Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Campaign</TableHead>
                <TableHead className="text-right">Dials</TableHead>
                <TableHead className="text-right">Connects</TableHead>
                <TableHead className="text-right">Connect %</TableHead>
                <TableHead className="text-right">No Answer %</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Busy %</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Voicemail %</TableHead>
                <TableHead className="text-right hidden md:table-cell">DNC %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={8} />
              ) : analysis.length === 0 ? (
                <EmptyRow cols={8} message="No dial data found." />
              ) : (
                analysis.map((row) => (
                  <TableRow key={row.campaign}>
                    <TableCell className="pl-6 font-medium">{row.campaign}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(row.dialAttempts)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(row.connects)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(row.connectRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(row.noAnswerRate)}</TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">{pct(row.busyRate)}</TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">{pct(row.voicemailRate)}</TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">{pct(row.dncRate)}</TableCell>
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
