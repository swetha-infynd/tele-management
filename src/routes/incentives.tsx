import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Award, CalendarCheck, PoundSterling, Wallet } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ClientNamesCell } from "@/components/client-names-cell";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clientNamesText } from "@/lib/dial-upload";
import { compactGbp, gbp, num } from "@/lib/format";
import { api } from "@/lib/mock/api";
import { useSession, useTeamScope } from "@/lib/session";
import { useClientNameIndex } from "@/hooks/use-client-names";

export const Route = createFileRoute("/incentives")({
  head: () => ({
    meta: [
      { title: "Incentives & Commission Payouts | Apex CRM" },
      {
        name: "description",
        content:
          "Slab-based incentives and commission calculations for every agent, with weekly and monthly payout views.",
      },
      { property: "og:title", content: "Incentives & Commissions | Apex CRM" },
      {
        property: "og:description",
        content: "Automatic slab and commission payout calculation for sales agents.",
      },
    ],
  }),
  component: IncentivesPage,
});

function IncentivesPage() {
  const { session } = useSession();
  const scope = useTeamScope();
  const isAgent = session.role === "agent";
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [team, setTeam] = useState<string>(scope ?? "all");
  const clientNames = useClientNameIndex();

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data, isLoading } = useQuery({
    queryKey: ["incentives", period, team, isAgent ? session.employeeId : "all"],
    queryFn: () =>
      api.incentives(
        period,
        isAgent ? undefined : team === "all" ? undefined : team,
        isAgent ? session.employeeId : undefined,
      ),
  });

  const allRows = data?.rows ?? [];
  const rows = isAgent ? allRows.filter((r) => r.employeeId === session.employeeId) : allRows;
  const slabs = data?.slabs ?? [];
  const totalPayout = rows.reduce((s, r) => s + r.total, 0);
  const qualified = rows.filter((r) => r.total > 0).length;

  return (
    <AppShell>
      <PageHeader
        title={isAgent ? "My Incentives" : "Incentives"}
        description={
          isAgent
            ? "Your slab bonuses and revenue commission from booked sales."
            : "Slab bonuses and revenue commission calculated from booked sales."
        }
        actions={
          <>
            {!isAgent && (
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
            )}
            <ExportMenu
              filename={`incentives-${period}`}
              columns={["Agent", "Client", "Sales", "Revenue", "Slab bonus", "Commission", "Total"]}
              rows={rows.map((r) => [
                r.name,
                clientNamesText(clientNames.agent(r.name)),
                r.sales,
                r.revenue,
                r.slabAmount,
                r.commission,
                r.total,
              ])}
            />
          </>
        }
      />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as "weekly" | "monthly")}>
        <TabsList>
          <TabsTrigger value="weekly">This week</TabsTrigger>
          <TabsTrigger value="monthly">This month</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total payout"
          value={compactGbp(totalPayout)}
          icon={Wallet}
          iconClassName="bg-emerald-500/15 text-gray-700 dark:bg-emerald-500/25 dark:text-gray-300"
          hint="Bonus + commission"
        />
        <StatCard
          label="Qualified agents"
          value={`${qualified}/${rows.length}`}
          icon={Award}
          iconClassName="bg-purple-500/15 text-gray-700 dark:bg-purple-500/25 dark:text-gray-300"
          hint="Reached a slab"
        />
        <StatCard
          label="Total sales"
          value={num(rows.reduce((s, r) => s + r.sales, 0))}
          icon={CalendarCheck}
          iconClassName="bg-amber-500/15 text-gray-700 dark:bg-amber-500/25 dark:text-gray-300"
          hint="Closed in period"
        />
        <StatCard
          label="Revenue booked"
          value={compactGbp(rows.reduce((s, r) => s + r.revenue, 0))}
          icon={PoundSterling}
          iconClassName="bg-teal-500/15 text-gray-700 dark:bg-teal-500/25 dark:text-gray-300"
          hint="Basis for commission"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incentive slabs</CardTitle>
          <CardDescription>
            Bonus awarded once an agent crosses the sales threshold for the period.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {slabs.map((s) => (
            <div key={s.minSales} className="rounded-md border px-4 py-3">
              <p className="text-xs text-muted-foreground">{s.minSales}+ sales</p>
              <p className="text-lg font-semibold">{gbp(s.amount)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout sheet</CardTitle>
          <CardDescription>Ranked by total payout for the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Revenue</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Slab bonus</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Commission</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={7} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={7} message="No incentive data for this period." />
              ) : (
                rows.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell>
                      <Link
                        to="/employees/$employeeId"
                        params={{ employeeId: r.employeeId }}
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <ClientNamesCell {...clientNames.agent(r.name)} />
                    </TableCell>
                    <TableCell className="text-right">{num(r.sales)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      {compactGbp(r.revenue)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      {r.slabAmount ? gbp(r.slabAmount) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      {gbp(r.commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.total > 0 ? "default" : "outline"}>{gbp(r.total)}</Badge>
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
