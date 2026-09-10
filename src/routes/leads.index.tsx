import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MoreHorizontal, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { LeadStatusBadge } from "@/components/status-badges";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
import { LeadFormDialog } from "@/components/lead-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/mock/api";
import { inr } from "@/lib/format";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/mock/types";
import { useSession, useTeamScope } from "@/lib/session";

export const Route = createFileRoute("/leads/")({
  head: () => ({
    meta: [
      { title: "Sales CRM — Lead Pipeline | Apex CRM" },
      {
        name: "description",
        content:
          "Manage every lead: campaigns, sources, assigned agents, statuses, follow-ups and sale values in one pipeline.",
      },
      { property: "og:title", content: "Sales CRM — Lead Pipeline | Apex CRM" },
      { property: "og:description", content: "Manage leads, follow-ups and conversions." },
    ],
  }),
  component: LeadsPage,
});

const PAGE_SIZE = 10;

function LeadsPage() {
  const { session, can } = useSession();
  const scope = useTeamScope();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isAgent = session.role === "agent";
  const query = {
    search,
    status,
    campaign,
    source,
    page,
    pageSize: PAGE_SIZE,
    ...(isAgent ? { agentId: session.employeeId } : {}),
    ...(scope && !isAgent ? { team: scope } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["leads", query],
    queryFn: () => api.listLeads(query),
  });
  const { data: meta } = useQuery({ queryKey: ["lead-meta"], queryFn: api.leadMeta });
  const { data: pipeline = [] } = useQuery({ queryKey: ["pipeline"], queryFn: api.leadPipeline });
  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listEmployees({ role: "agent", pageSize: 100 }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["pipeline"] });
  };
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : "Request failed");

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: LeadStatus }) =>
      api.updateLead(id, { status: next }),
    onSuccess: (l) => {
      toast.success(`Lead moved to "${l.status}"`);
      invalidate();
    },
    onError,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.deleteLead(id),
    onSuccess: () => {
      toast.success("Lead deleted");
      setDeleteId(null);
      invalidate();
    },
    onError,
  });

  const assignMutation = useMutation({
    mutationFn: (agentId: string) => api.bulkAssignLeads(selected, agentId),
    onSuccess: (r) => {
      toast.success(`${r.updated} leads reassigned`);
      setSelected([]);
      invalidate();
    },
    onError,
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <AppShell>
      <PageHeader
        title="Sales CRM"
        description="Every lead, follow-up and conversion in one pipeline."
        actions={
          <>
            <ExportMenu
              filename="leads"
              columns={["Customer", "Business", "Phone", "Campaign", "Agent", "Status", "Sale"]}
              rows={rows.map((l) => [
                l.customerName,
                l.businessName,
                l.phone,
                l.campaign,
                l.agentName,
                l.status,
                l.saleAmount,
              ])}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditId(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" /> New lead
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {pipeline.slice(0, 5).map((p) => (
          <Card key={p.status}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{p.status}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{p.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Input
              placeholder="Search name, business, phone or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="lg:max-w-xs"
            />
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="lg:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={campaign} onValueChange={(v) => { setCampaign(v); setPage(1); }}>
              <SelectTrigger className="lg:w-[160px]">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {meta?.campaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
              <SelectTrigger className="lg:w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {meta?.sources.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected.length > 0 && can("manage_all_leads") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="lg:ml-auto">
                    <Users className="mr-2 size-4" /> Assign {selected.length}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Reassign to</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {agents?.rows.map((a) => (
                    <DropdownMenuItem key={a.id} onSelect={() => assignMutation.mutate(a.id)}>
                      {a.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) =>
                      setSelected(v ? rows.map((r) => r.id) : [])
                    }
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Business</TableHead>
                <TableHead className="hidden lg:table-cell">Campaign</TableHead>
                <TableHead className="hidden lg:table-cell">Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Follow-up</TableHead>
                <TableHead className="text-right">Sale</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={9} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={9} message="No leads match these filters." />
              ) : (
                rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(l.id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) =>
                            v ? [...prev, l.id] : prev.filter((x) => x !== l.id),
                          )
                        }
                        aria-label={`Select ${l.customerName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/leads/$leadId"
                        params={{ leadId: l.id }}
                        className="font-medium hover:underline"
                      >
                        {l.customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{l.phone}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{l.businessName}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline">{l.campaign}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {l.agentName}
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {l.followUpDate ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.saleAmount ? inr(l.saleAmount) : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Lead actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/leads/$leadId" params={{ leadId: l.id }}>
                              View details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditId(l.id);
                              setFormOpen(true);
                            }}
                          >
                            Edit lead
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {LEAD_STATUSES.map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onSelect={() => statusMutation.mutate({ id: l.id, next: s })}
                                >
                                  {s}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteId(l.id)}
                          >
                            <Trash2 className="mr-2 size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {rows.length} of {data?.total ?? 0} leads
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        leadId={editId}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the lead and its notes from the pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && removeMutation.mutate(deleteId)}>
              Delete lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
