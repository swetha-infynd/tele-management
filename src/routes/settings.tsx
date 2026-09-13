import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inr, longDate, roleLabel } from "@/lib/format";
import { api } from "@/lib/mock/api";
import { usePreferences, type AppPreferences } from "@/lib/preferences";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Workspace Settings | Apex CRM" },
      {
        name: "description",
        content:
          "Configure organisation targets, shift timings, incentive slabs, holidays and notification preferences.",
      },
      { property: "og:title", content: "Workspace Settings | Apex CRM" },
      {
        property: "og:description",
        content: "Targets, shifts, incentive slabs and holiday calendar configuration.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { session, can } = useSession();
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: holidays = [] } = useQuery({ queryKey: ["holidays"], queryFn: api.listHolidays });
  const { data: incentiveData } = useQuery({
    queryKey: ["incentives", "monthly", "all"],
    queryFn: () => api.incentives("monthly"),
  });

  const [form, setForm] = useState({
    orgName: "",
    currency: "INR",
    dailyCallTarget: 0,
    dailySalesTarget: 0,
    monthlyRevenueTarget: 0,
    shiftStart: "09:00",
    lateGraceMinutes: 10,
  });

  const [prefs, setPrefs] = useState({
    followUp: true,
    targetMisses: true,
    attendance: true,
    birthdays: false,
    weeklyDigest: true,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: () => api.updateSettings(form),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editable = can("manage_settings");

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Organisation configuration, targets and personal preferences."
        actions={
          editable && (
            <Button variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          )
        }
      />

      <Tabs defaultValue="application">
        <TabsList>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="incentives">Incentives</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="notifications">Alerts</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="application" className="mt-4">
          <ApplicationSettings />
        </TabsContent>



        <TabsContent value="organisation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organisation</CardTitle>
              <CardDescription>Displayed across reports and exports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="orgName">Organisation name</Label>
                <Input
                  id="orgName"
                  value={form.orgName}
                  disabled={!editable}
                  onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={form.currency}
                  disabled={!editable}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Targets and shift rules</CardTitle>
              <CardDescription>
                Used to calculate target attainment, late logins and dashboard progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="calls">Daily call target (floor)</Label>
                <Input
                  id="calls"
                  type="number"
                  value={form.dailyCallTarget}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dailyCallTarget: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sales">Daily sales target (per agent)</Label>
                <Input
                  id="sales"
                  type="number"
                  value={form.dailySalesTarget}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dailySalesTarget: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="revenue">Monthly revenue target</Label>
                <Input
                  id="revenue"
                  type="number"
                  value={form.monthlyRevenueTarget}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, monthlyRevenueTarget: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Currently {inr(form.monthlyRevenueTarget)}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shift">Shift start time</Label>
                <Input
                  id="shift"
                  type="time"
                  value={form.shiftStart}
                  disabled={!editable}
                  onChange={(e) => setForm((f) => ({ ...f, shiftStart: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grace">Late grace period (minutes)</Label>
                <Input
                  id="grace"
                  type="number"
                  value={form.lateGraceMinutes}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lateGraceMinutes: Number(e.target.value) }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incentives" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incentive slabs</CardTitle>
              <CardDescription>
                Bonus paid when an agent crosses the sales threshold in a period.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Minimum sales</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(incentiveData?.slabs ?? []).map((s) => (
                    <TableRow key={s.minSales}>
                      <TableCell>{s.minSales}+ sales</TableCell>
                      <TableCell className="text-right">{inr(s.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Holiday calendar</CardTitle>
              <CardDescription>Non-working days excluded from attendance rules.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Occasion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow key={h.date}>
                      <TableCell className="whitespace-nowrap">{longDate(h.date)}</TableCell>
                      <TableCell>{h.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification preferences</CardTitle>
              <CardDescription>Choose which alerts reach you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  ["followUp", "Follow-up reminders", "Alert me when a follow-up is due today."],
                  ["targetMisses", "Target misses", "Notify when an agent falls below target."],
                  ["attendance", "Attendance alerts", "Late logins and absences."],
                  ["birthdays", "Birthdays & anniversaries", "Celebrate team milestones."],
                  ["weeklyDigest", "Weekly digest", "A summary email every Monday morning."],
                ] as const
              ).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor={key}>{label}</Label>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    id={key}
                    checked={prefs[key]}
                    onCheckedChange={(v) => {
                      setPrefs((p) => ({ ...p, [key]: v }));
                      toast.success(`${label} ${v ? "enabled" : "disabled"}`);
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My profile</CardTitle>
              <CardDescription>Signed-in account details for this session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={session.name} readOnly />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={session.email} readOnly />
                </div>
              </div>
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{roleLabel[session.role] ?? session.role}</Badge>
                <Badge variant="secondary">{session.team}</Badge>
                <span className="text-xs text-muted-foreground">
                  Employee ID: {session.employeeId}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ApplicationSettings() {
  const { prefs, resolvedTheme, setPref, reset } = usePreferences();

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Theme and layout density for this browser. Currently rendering in {resolvedTheme} mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow label="Theme" desc="Light, dark or follow your operating system.">
            <ToggleGroup
              type="single"
              variant="outline"
              value={prefs.theme}
              onValueChange={(v) => {
                if (!v) return;
                setPref("theme", v as AppPreferences["theme"]);
                toast.success(`Theme set to ${v}`);
              }}
            >
              <ToggleGroupItem value="light" aria-label="Light theme">
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" aria-label="System theme">
                System
              </ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>
          <Separator />
          <SettingRow label="Interface density" desc="Compact fits more rows on screen.">
            <ToggleGroup
              type="single"
              variant="outline"
              value={prefs.density}
              onValueChange={(v) => v && setPref("density", v as AppPreferences["density"])}
            >
              <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
              <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>
          <Separator />
          <SettingRow label="Font size" desc="Scales typography across the workspace.">
            <Select
              value={prefs.fontScale}
              onValueChange={(v) => setPref("fontScale", v as AppPreferences["fontScale"])}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <Separator />
          <SettingRow label="Reduce motion" desc="Minimise animations and transitions.">
            <Switch
              checked={prefs.reduceMotion}
              onCheckedChange={(v) => setPref("reduceMotion", v)}
            />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace behaviour</CardTitle>
          <CardDescription>Defaults applied when you open the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow label="Landing page" desc="Where the app opens after sign-in.">
            <Select
              value={prefs.startPage}
              onValueChange={(v) => setPref("startPage", v as AppPreferences["startPage"])}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/">Dashboard</SelectItem>
                <SelectItem value="/leads">Leads</SelectItem>
                <SelectItem value="/attendance">Attendance</SelectItem>
                <SelectItem value="/performance">Performance</SelectItem>
                <SelectItem value="/leaderboard">Leaderboard</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <Separator />
          <SettingRow label="Collapse sidebar by default" desc="Start with a narrow navigation rail.">
            <Switch
              checked={prefs.sidebarCollapsed}
              onCheckedChange={(v) => setPref("sidebarCollapsed", v)}
            />
          </SettingRow>
          <Separator />
          <SettingRow label="Sticky table headers" desc="Keep column headers visible while scrolling.">
            <Switch
              checked={prefs.stickyTableHeaders}
              onCheckedChange={(v) => setPref("stickyTableHeaders", v)}
            />
          </SettingRow>
          <Separator />
          <SettingRow label="Rows per page" desc="Default page size for data tables.">
            <Select
              value={String(prefs.tablePageSize)}
              onValueChange={(v) => setPref("tablePageSize", Number(v))}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <Separator />
          <SettingRow label="Auto-refresh dashboards" desc="Poll live floor metrics on an interval.">
            <Select
              value={String(prefs.autoRefreshSeconds)}
              onValueChange={(v) => setPref("autoRefreshSeconds", Number(v))}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="30">Every 30 seconds</SelectItem>
                <SelectItem value="60">Every minute</SelectItem>
                <SelectItem value="300">Every 5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <Separator />
          <SettingRow label="Show helper tips" desc="Inline hints and empty-state guidance.">
            <Switch checked={prefs.showTips} onCheckedChange={(v) => setPref("showTips", v)} />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formats</CardTitle>
          <CardDescription>How dates and times are displayed for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow label="Date format" desc="Applied to tables, filters and exports.">
            <Select
              value={prefs.dateFormat}
              onValueChange={(v) => setPref("dateFormat", v as AppPreferences["dateFormat"])}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dd MMM yyyy">31 Jul 2026</SelectItem>
                <SelectItem value="yyyy-MM-dd">2026-07-31</SelectItem>
                <SelectItem value="MM/dd/yyyy">07/31/2026</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <Separator />
          <SettingRow label="Time format" desc="Clock display for shift and call timings.">
            <ToggleGroup
              type="single"
              variant="outline"
              value={prefs.timeFormat}
              onValueChange={(v) => v && setPref("timeFormat", v as AppPreferences["timeFormat"])}
            >
              <ToggleGroupItem value="12h">12-hour</ToggleGroupItem>
              <ToggleGroupItem value="24h">24-hour</ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>
          <Separator />
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                toast.success("Application settings reset to defaults");
              }}
            >
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
