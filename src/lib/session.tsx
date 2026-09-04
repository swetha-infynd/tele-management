import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  | "view_all_teams"
  | "approve_leave"
  | "review_qa"
  | "view_reports"
  | "manage_settings"
  | "manage_all_leads";

const MATRIX: Record<Role, Permission[]> = {
  admin: [
    "manage_employees",
    "view_all_teams",
    "approve_leave",
    "review_qa",
    "view_reports",
    "manage_settings",
    "manage_all_leads",
  ],
  manager: ["manage_employees", "view_all_teams", "approve_leave", "review_qa", "view_reports", "manage_all_leads"],
  team_leader: ["approve_leave", "review_qa", "view_reports", "manage_all_leads"],
  agent: [],
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSession(JSON.parse(raw) as Session);
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
      },
      signOut: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setSession(DEFAULT_SESSION);
        setAuthenticated(false);
      },
      can: (perm) => MATRIX[session.role].includes(perm),
    }),
    [session, isAuthenticated, hydrated],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** Team scope for the current user: team leaders and agents see their own team only. */
export function useTeamScope() {
  const { session } = useSession();
  return session.role === "team_leader" || session.role === "agent" ? session.team : undefined;
}
