import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Mail, Phone, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { PageHeader } from "@/components/page-header";
import { LeadStatusBadge } from "@/components/status-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { initials, inr, longDate, timeAgo } from "@/lib/format";
import { api, ApiError } from "@/lib/mock/api";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/mock/types";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Lead Details — Sales CRM | Apex CRM" },
      {
        name: "description",
        content: "Full lead history: contact details, pipeline status, follow-ups and call notes.",
      },
      { property: "og:title", content: "Lead Details — Sales CRM | Apex CRM" },
      { property: "og:description", content: "Lead history, status and call notes." },
    ],
  }),
  component: LeadDetailPage,
});

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const { session } = useSession();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => api.getLead(leadId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lead", leadId] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : "Request failed");

  const statusMutation = useMutation({
    mutationFn: (next: LeadStatus) => api.updateLead(leadId, { status: next }),
    onSuccess: (l) => {
      toast.success(`Status updated to "${l.status}"`);
      invalidate();
    },
    onError,
  });

  const noteMutation = useMutation({
    mutationFn: () => api.addLeadNote(leadId, session.name, note.trim()),
    onSuccess: () => {
      toast.success("Note added to timeline");
      setNote("");
      invalidate();
    },
    onError,
  });

  return (
    <AppShell>
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link to="/leads">
          <ArrowLeft className="mr-2 size-4" /> Back to pipeline
        </Link>
      </Button>

      {isLoading || !lead ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={lead.customerName}
            description={`${lead.businessName} • ${lead.campaign} • ${lead.source}`}
            actions={
              <>
                <Select
                  value={lead.status}
                  onValueChange={(v) => statusMutation.mutate(v as LeadStatus)}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 size-4" /> Edit
                </Button>
              </>
            }
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <span>{lead.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="truncate">{lead.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <span>{lead.businessName}</span>
                </div>
                <Separator />
                <Row label="Status" value={<LeadStatusBadge status={lead.status} />} />
                <Row label="Assigned agent" value={lead.agentName} />
                <Row label="Follow-up" value={lead.followUpDate ? longDate(lead.followUpDate) : "—"} />
                <Row label="Sale value" value={lead.saleAmount ? inr(lead.saleAmount) : "—"} />
                <Row label="Created" value={longDate(lead.createdAt)} />
                <Row label="Last updated" value={timeAgo(lead.updatedAt)} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Call notes & activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Log the outcome of your call…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!note.trim() || noteMutation.isPending}
                      onClick={() => noteMutation.mutate()}
                    >
                      {noteMutation.isPending ? "Saving…" : "Add note"}
                    </Button>
                  </div>
                </div>
                <Separator />
                {lead.notes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No notes logged yet for this lead.
                  </p>
                ) : (
                  <ol className="space-y-4">
                    {[...lead.notes]
                      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                      .map((n) => (
                        <li key={n.id} className="flex gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">
                              {initials(n.author)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {n.author}{" "}
                              <span className="font-normal text-muted-foreground">
                                • {timeAgo(n.createdAt)}
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground">{n.body}</p>
                          </div>
                        </li>
                      ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <LeadFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            leadId={leadId}
            onSaved={invalidate}
          />
        </>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
