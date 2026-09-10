import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/mock/api";

const COUNTRIES = [
  "United Kingdom",
  "United States",
  "Australia",
  "Canada",
  "Ireland",
  "New Zealand",
  "Germany",
  "United Arab Emirates",
];

const empty = {
  name: "",
  client: "",
  country: "United Kingdom",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

export function CampaignFormDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ["employees", "all-for-campaign"],
    queryFn: () => api.listEmployees({ pageSize: 500 }),
  });

  const all = useMemo(
    () => (employees?.rows ?? []).filter((e) => e.status === "Active"),
    [employees],
  );
  const selected = all.filter((e) => agentIds.includes(e.id));
  const available = all.filter(
    (e) => !agentIds.includes(e.id) && e.name.toLowerCase().includes(search.toLowerCase()),
  );

  const create = useMutation({
    mutationFn: () =>
      api.createCampaign({
        name: form.name,
        client: form.client,
        country: form.country,
        startDate: form.startDate,
        endDate: form.endDate || null,
        agentIds,
      }),
    onSuccess: (c) => {
      toast.success(`Campaign "${c.name}" created`, {
        description: `${c.agentIds.length} agents assigned · client ${c.client}`,
      });
      qc.invalidateQueries();
      setOpen(false);
      setForm(empty);
      setAgentIds([]);
      setSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="mr-2 h-4 w-4" />
          New campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Set up the client, market and dates, then assign agents to the dialling roster.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Solar UK Q4"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-client">Client name</Label>
            <Input
              id="campaign-client"
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              placeholder="Brightvolt Energy Ltd"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-country">Country</Label>
            <Select
              value={form.country}
              onValueChange={(v) => setForm({ ...form, country: v })}
            >
              <SelectTrigger id="campaign-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="campaign-start">Start date</Label>
              <Input
                id="campaign-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-end">End date</Label>
              <Input
                id="campaign-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Agents ({selected.length} assigned)</Label>
          <div className="rounded-md border p-2">
            {selected.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">No agents assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selected.map((e) => (
                  <Badge key={e.id} variant="secondary" className="gap-1">
                    {e.name}
                    <button
                      type="button"
                      aria-label={`Remove ${e.name}`}
                      onClick={() => setAgentIds(agentIds.filter((id) => id !== e.id))}
                      className="ml-1 rounded-sm opacity-70 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents to add…"
          />
          <ScrollArea className="h-44 rounded-md border">
            <div className="divide-y">
              {available.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No matching agents.</p>
              ) : (
                available.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.employeeId} · {e.team} · {e.role.replace("_", " ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAgentIds([...agentIds, e.id])}
                    >
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
