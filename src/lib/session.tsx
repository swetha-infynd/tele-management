import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@/lib/mock/api";
import type { Role } from "@/lib/mock/types";

const STORAGE_KEY = "apex-crm-session";

const DEFAULT_SESSION: Session = {
  employeeId: "emp-001",
  name: "Charlotte Hughes",
  role: "admin",
  team: "Management",
  email: "charlotte@apexbpo.co.uk",
};

interface SessionContextValue {
  session: Session;
  isAuthenticated: boolean;
  hydrated: boolean;
  signIn: (s: Session) => void;
  signOut: () => void;
  can: (perm: Permission) => boolean;
}

export type Permission =
  | "manage_employees"
  | "view_employees"
  | "view_all_teams"
  | "approve_leave"
  | "review_qa"
  | "view_reports"
  | "manage_settings"
  | "manage_all_leads";

const MATRIX: Record<Role, Permission[]> = {
  admin: [
    "manage_employees",
    "view_employees",
    "view_all_teams",
    "approve_leave",
    "review_qa",
    "view_reports",
    "manage_settings",
    "manage_all_leads",
  ],
  BDE: [
    "view_employees",
    "view_all_teams",
    "approve_leave",
    "review_qa",
    "view_reports",
    "manage_all_leads",
  ],
  agent: [],
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Session;
        // Migrate legacy roles (manager / team_leader) to BDE on load.
        if (
          (parsed.role as string) === "manager" ||
          (parsed.role as string) === "team_leader"
        ) {
          parsed.role = "BDE";
        }
        setSession(parsed);
        setAuthenticated(true);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isAuthenticated,
      hydrated,
      signIn: (s) => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        setSession(s);
        setAuthenticated(true);
        queryClient.clear();
      },
      signOut: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setSession(DEFAULT_SESSION);
        setAuthenticated(false);
        queryClient.clear();
      },
      can: (perm) => MATRIX[session.role]?.includes(perm) ?? false,
    }),
    [session, isAuthenticated, hydrated, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** Team scope for the current user: BDE and agents see their own team only. */
export function useTeamScope() {
  const { session } = useSession();
  return session.role === "BDE" || session.role === "agent" ? session.team : undefined;
}

/** True for BDE-level role. */
export function isBdeRole(role: Role): boolean {
  return role === "BDE";
}

/**
 * Data scope for the current user based on role:
 * - admin: no restrictions (all data)
 * - BDE: scoped to own team
 * - agent: scoped to self only
 */
export function useDataScope(): { team?: string; employeeId?: string } {
  const { session } = useSession();
  if (session.role === "agent") return { employeeId: session.employeeId };
  if (session.role === "BDE") return { team: session.team };
  return {};
}
