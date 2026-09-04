import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { api, ApiError, type LeadInput } from "@/lib/mock/api";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/mock/types";
import { useSession } from "@/lib/session";

const EMPTY: LeadInput = {
  customerName: "",
  phone: "",
  email: "",
  businessName: "",
  campaign: "",
  source: "",
  assignedAgentId: "",
  status: "New",
  followUpDate: null,
  saleAmount: 0,
};

export function LeadFormDialog({
  open,
  onOpenChange,
  leadId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId?: string | null;
  onSaved?: () => void;
}) {
  const { session } = useSession();
  const qc = useQueryClient();
  const [form, setForm] = useState<LeadInput>(EMPTY);

  const { data: meta } = useQuery({ queryKey: ["lead-meta"], queryFn: api.leadMeta });
  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listEmployees({ role: "agent", pageSize: 100 }),
  });
  const { data: lead } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => api.getLead(leadId!),
    enabled: !!leadId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (lead && leadId) {
      setForm({
        customerName: lead.customerName,
        phone: lead.phone,
        email: lead.email,
        businessName: lead.businessName,
        campaign: lead.campaign,
        source: lead.source,
        assignedAgentId: lead.assignedAgentId,
        status: lead.status,
        followUpDate: lead.followUpDate,
        saleAmount: lead.saleAmount,
      });
    } else if (!leadId) {
      setForm({
        ...EMPTY,
        campaign: meta?.campaigns[0] ?? "",
        source: meta?.sources[0] ?? "",
        assignedAgentId:
          session.role === "agent" ? session.employeeId : (agents?.rows[0]?.id ?? ""),
      });
    }
  }, [open, lead, leadId, meta, agents, session]);

  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () => (leadId ? api.updateLead(leadId, form) : api.createLead(form)),
    onSuccess: () => {
      toast.success(leadId ? "Lead updated" : "Lead created");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save lead"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{leadId ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>
            {leadId
              ? "Update the customer record and pipeline status."
              : "Capture a new prospect and assign it to an agent."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="customerName">Customer name</Label>
            <Input
              id="customerName"
              value={form.customerName}
              onChange={(e) => set("customerName", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Campaign</Label>
            <Select value={form.campaign} onValueChange={(v) => set("campaign", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {meta?.campaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Source</Label>
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {meta?.sources.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Assigned agent</Label>
            <Select
              value={form.assignedAgentId}
              onValueChange={(v) => set("assignedAgentId", v)}
              disabled={session.role === "agent"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {agents?.rows.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as LeadStatus)}>
              <SelectTrigger>
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="followUp">Follow-up date</Label>
            <Input
              id="followUp"
              type="date"
              value={form.followUpDate ?? ""}
              onChange={(e) => set("followUpDate", e.target.value || null)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="saleAmount">Sale amount (₹)</Label>
            <Input
              id="saleAmount"
              type="number"
              value={form.saleAmount}
              onChange={(e) => set("saleAmount", Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : leadId ? "Save changes" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
