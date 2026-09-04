import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmployeeFormDialog } from "@/components/employee-form-dialog";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { EmptyRow, TableSkeleton } from "@/components/table-states";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { initials, longDate, roleLabel } from "@/lib/format";
import { api, ApiError } from "@/lib/mock/api";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/employees/")({
  head: () => ({
    meta: [
      { title: "Employee Management — Teams & Roles | Apex CRM" },
      {
        name: "description",
        content:
          "Onboard agents, assign teams and shifts, manage roles, commission rates and leave balances.",
      },
      { property: "og:title", content: "Employee Management | Apex CRM" },
      { property: "og:description", content: "Onboard agents, assign teams, manage roles." },
    ],
  }),
  component: EmployeesPage,
});

const PAGE_SIZE = 10;

function EmployeesPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("all");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const q = { search, team, role, status, page, pageSize: PAGE_SIZE };
  const { data, isLoading } = useQuery({
    queryKey: ["employees", q],
    queryFn: () => api.listEmployees(q),
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteEmployee(id),
    onSuccess: () => {
      toast.success("Employee removed");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Request failed"),
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <AppShell>
      <PageHeader
        title="Employees"
        description="Directory of every agent, team leader and manager on the floor."
        actions={
          <>
            <ExportMenu
              filename="employees"
              columns={["Employee ID", "Name", "Email", "Team", "Role", "Shift", "Status"]}
              rows={rows.map((e) => [
                e.employeeId,
                e.name,
                e.email,
                e.team,
                roleLabel[e.role] ?? e.role,
                e.shift,
                e.status,
              ])}
            />
            {can("manage_employees") && (
              <Button
                size="sm"
                onClick={() => {
                  setEditId(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" /> Add employee
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row">
            <Input
              placeholder="Search name, email or employee ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="lg:max-w-xs"
            />
            <Select value={team} onValueChange={(v) => { setTeam(v); setPage(1); }}>
              <SelectTrigger className="lg:w-[160px]">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
              <SelectTrigger className="lg:w-[150px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="lg:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden md:table-cell">Team</TableHead>
                <TableHead className="hidden lg:table-cell">Role</TableHead>
                <TableHead className="hidden lg:table-cell">Shift</TableHead>
                <TableHead className="hidden xl:table-cell">Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton cols={7} />
              ) : rows.length === 0 ? (
                <EmptyRow cols={7} message="No employees found for these filters." />
              ) : (
                rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(e.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            to="/employees/$employeeId"
                            params={{ employeeId: e.id }}
                            className="font-medium hover:underline"
                          >
                            {e.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{e.employeeId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{e.team}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline">{roleLabel[e.role] ?? e.role}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {e.shift}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {longDate(e.joiningDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.status === "Active" ? "default" : "secondary"}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Employee actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/employees/$employeeId" params={{ employeeId: e.id }}>
                              View profile
                            </Link>
                          </DropdownMenuItem>
                          {can("manage_employees") && (
                            <>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditId(e.id);
                                  setFormOpen(true);
                                }}
                              >
                                Edit employee
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setDeleteId(e.id)}
                              >
                                <Trash2 className="mr-2 size-4" /> Remove
                              </DropdownMenuItem>
                            </>
                          )}
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
          Showing {rows.length} of {data?.total ?? 0} employees
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
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

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employeeId={editId}
        onSaved={() => qc.invalidateQueries({ queryKey: ["employees"] })}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this employee?</AlertDialogTitle>
            <AlertDialogDescription>
              Their attendance and performance history stays intact, but they will no longer appear
              in the active directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
