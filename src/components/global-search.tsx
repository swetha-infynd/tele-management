import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/mock/api";
import { useSession, useDataScope, type Permission } from "@/lib/session";

const PAGES: Array<[string, string, Permission?]> = [
  ["Dashboard", "/"],
  ["Leads", "/leads"],
  ["Attendance", "/attendance"],
  ["Performance", "/performance"],
  ["Leaderboard", "/leaderboard"],
  ["Reports", "/reports", "view_reports"],
  ["Quality", "/quality", "review_qa"],
  ["Incentives", "/incentives"],
  ["Leave", "/leave"],
  ["AI Insights", "/ai-insights"],
  ["Employees", "/employees", "view_employees"],
  ["Settings", "/settings"],
];

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { session, can } = useSession();
  const scope = useDataScope();
  const isAgent = session.role === "agent";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const { data: employees } = useQuery({
    queryKey: ["employees", "search-all", scope.team],
    queryFn: () =>
      api.listEmployees({
        pageSize: 100,
        ...(scope.team ? { team: scope.team } : {}),
      }),
    enabled: open && !isAgent,
  });
  const { data: leads } = useQuery({
    queryKey: ["leads", "search-all", scope.employeeId, scope.team],
    queryFn: () =>
      api.listLeads({
        pageSize: 40,
        ...(scope.employeeId ? { agentId: scope.employeeId } : {}),
        ...(scope.team ? { team: scope.team } : {}),
      }),
    enabled: open,
  });

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  const visiblePages = PAGES.filter(([, , perm]) => !perm || can(perm));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, agents and leads…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {visiblePages.map(([label, url]) => (
            <CommandItem key={url} value={`page ${label}`} onSelect={() => go(url)}>
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {!isAgent && (
          <CommandGroup heading="Employees">
            {employees?.rows.slice(0, 30).map((e) => (
              <CommandItem
                key={e.id}
                value={`emp ${e.name} ${e.employeeId}`}
                onSelect={() => go(`/employees/${e.id}`)}
              >
                {e.name}
                <span className="ml-auto text-xs text-muted-foreground">{e.team}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Leads">
          {leads?.rows.map((l) => (
            <CommandItem
              key={l.id}
              value={`lead ${l.customerName} ${l.businessName}`}
              onSelect={() => go(`/leads/${l.id}`)}
            >
              {l.customerName}
              <span className="ml-auto text-xs text-muted-foreground">{l.businessName}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
