import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BellRing,
  Cake,
  CalendarClock,
  Target,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/format";
import { api } from "@/lib/mock/api";
import type { NotificationKind } from "@/lib/mock/types";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Centre | Apex CRM" },
      {
        name: "description",
        content:
          "Follow-up reminders, target alerts, attendance warnings and performance notifications in one feed.",
      },
      { property: "og:title", content: "Notification Centre | Apex CRM" },
      {
        property: "og:description",
        content: "All operational alerts and reminders for your BPO floor.",
      },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<NotificationKind, typeof BellRing> = {
  followup: CalendarClock,
  birthday: Cake,
  performance: TrendingUp,
  target: Target,
  attendance: AlertTriangle,
  alert: BellRing,
};

const SEVERITY: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "outline",
  success: "default",
  warning: "secondary",
  critical: "destructive",
};

function NotificationsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "unread" | NotificationKind>("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.listNotifications,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unread = data.filter((n) => !n.read).length;
  const rows = data.filter((n) =>
    tab === "all" ? true : tab === "unread" ? !n.read : n.kind === tab,
  );

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        description={`${unread} unread ${unread === 1 ? "alert" : "alerts"} across the floor.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unread === 0}
          >
            Mark all as read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="followup">Follow-ups</TabsTrigger>
          <TabsTrigger value="target">Targets</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="birthday">Birthdays</TabsTrigger>
          <TabsTrigger value="alert">Alerts</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity feed</CardTitle>
          <CardDescription>Newest notifications appear first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing here right now.
            </p>
          ) : (
            rows.map((n) => {
              const Icon = ICONS[n.kind] ?? BellRing;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-md border p-3 ${n.read ? "opacity-70" : "bg-muted/40"}`}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      <Badge variant={SEVERITY[n.severity] ?? "outline"}>{n.severity}</Badge>
                      {!n.read && <Badge variant="secondary">New</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
