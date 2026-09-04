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
import { api, ApiError, type EmployeeInput } from "@/lib/mock/api";
import type { Role } from "@/lib/mock/types";

const EMPTY: EmployeeInput = {
  employeeId: "",
  name: "",
  email: "",
  mobile: "",
  team: "",
  manager: "",
  role: "agent",
  joiningDate: new Date().toISOString().slice(0, 10),
  shift: "Morning",
  status: "Active",
  leaveBalance: 12,
  commissionRate: 2,
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employeeId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId?: string | null;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EmployeeInput>(EMPTY);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: employee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => api.getEmployee(employeeId!),
    enabled: !!employeeId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (employeeId && employee) {
      const { id: _id, avatarColor: _c, ...rest } = employee;
      setForm(rest);
    } else if (!employeeId) {
      setForm({ ...EMPTY, team: teams[0] ?? "" });
    }
  }, [open, employeeId, employee, teams]);

  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      employeeId ? api.updateEmployee(employeeId, form) : api.createEmployee(form),
    onSuccess: () => {
      toast.success(employeeId ? "Employee updated" : "Employee onboarded");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employee", employeeId] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save employee"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{employeeId ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {employeeId
              ? "Update role, team, shift and payout settings."
              : "Onboard a new team member to the floor."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="empId">Employee ID</Label>
            <Input
              id="empId"
              value={form.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
              placeholder="APX-1042"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mobile">Mobile</Label>
            <Input id="mobile" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Team</Label>
            <Select value={form.team} onValueChange={(v) => set("team", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manager">Reporting manager</Label>
            <Input
              id="manager"
              value={form.manager}
              onChange={(e) => set("manager", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => set("role", v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Shift</Label>
            <Select
              value={form.shift}
              onValueChange={(v) => set("shift", v as EmployeeInput["shift"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Morning">Morning</SelectItem>
                <SelectItem value="Afternoon">Afternoon</SelectItem>
                <SelectItem value="Night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="joining">Joining date</Label>
            <Input
              id="joining"
              type="date"
              value={form.joiningDate}
              onChange={(e) => set("joiningDate", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as EmployeeInput["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="leave">Leave balance (days)</Label>
            <Input
              id="leave"
              type="number"
              value={form.leaveBalance}
              onChange={(e) => set("leaveBalance", Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="commission">Commission rate (%)</Label>
            <Input
              id="commission"
              type="number"
              value={form.commissionRate}
              onChange={(e) => set("commissionRate", Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : employeeId ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
