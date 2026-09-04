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

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

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
    queryKey: ["employees", "search-all"],
    queryFn: () => api.listEmployees({ pageSize: 100 }),
    enabled: open,
  });
  const { data: leads } = useQuery({
    queryKey: ["leads", "search-all"],
    queryFn: () => api.listLeads({ pageSize: 40 }),
    enabled: open,
  });

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, agents and leads…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {[
            ["Dashboard", "/"],
            ["Leads", "/leads"],
            ["Attendance", "/attendance"],
            ["Performance", "/performance"],
            ["Leaderboard", "/leaderboard"],
            ["Reports", "/reports"],
            ["Quality", "/quality"],
            ["Incentives", "/incentives"],
            ["Leave", "/leave"],
            ["AI Insights", "/ai-insights"],
            ["Employees", "/employees"],
            ["Settings", "/settings"],
          ].map(([label, url]) => (
            <CommandItem key={url} value={`page ${label}`} onSelect={() => go(url!)}>
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
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
