import {
  CAMPAIGNS,
  CAMPAIGN_META,
  CLIENTS,
  INCENTIVE_SLABS,
  TODAY,
  addDays,
  iso,
  seedAttendance,
  seedEmployees,
  seedHolidays,
  seedLeads,
  seedLeave,
  seedNotifications,
  seedPerformance,
  seedQa,
} from "./seed";
import {
  hydrateDiscoveredAgentsFromUploads,
  loadDialUploads,
  loadDiscoveredAgents,
  normalizeAgentName,
} from "../dial-upload";
import type {
  AppNotification,
  Campaign,
  AttendanceRecord,
  Employee,
  Holiday,
  IncentiveSlab,
  Lead,
  LeaveRequest,
  PerformanceRecord,
  QaScorecard,
} from "./types";

export interface Database {
  employees: Employee[];
  campaigns: Campaign[];
  attendance: AttendanceRecord[];
  performance: PerformanceRecord[];
  leads: Lead[];
  qa: QaScorecard[];
  leave: LeaveRequest[];
  holidays: Holiday[];
  notifications: AppNotification[];
  slabs: IncentiveSlab[];
  settings: {
    orgName: string;
    currency: string;
    dailyCallTarget: number;
    dailySalesTarget: number;
    monthlyRevenueTarget: number;
    shiftStart: string;
    lateGraceMinutes: number;
    dailyLoginHoursTarget: number;
    agentWeeklySalesTarget: number;
    campaignWeeklySalesTarget: Record<string, number>;
  };
}

function seedCampaigns(performance: { campaign: string; employeeId: string }[]): Campaign[] {
  return CAMPAIGNS.map((name, i) => {
    const meta = CAMPAIGN_META[name];
    return {
      id: `camp-${i + 1}`,
      name,
      client: meta?.client ?? `${name} Client`,
      country: meta?.country ?? "United Kingdom",
      startDate: meta?.start ?? "2025-01-06",
      endDate: null,
      agentIds: [
        ...new Set(performance.filter((p) => p.campaign === name).map((p) => p.employeeId)),
      ],
      weeklySalesTarget: 50,
      createdAt: meta?.start ?? "2025-01-06",
    } satisfies Campaign;
  });
}

/** One BDE per client account; keyed by the client name on Employee.team. */
const TEAM_LEADERS: Record<string, string> = {
  [CLIENTS[0]!]: "James Whitfield",
  [CLIENTS[1]!]: "Daniel Carter",
  [CLIENTS[2]!]: "Sophie Bennett",
  [CLIENTS[3]!]: "Liam Fletcher",
  [CLIENTS[4]!]: "Hannah Price",
};

const AVATAR_COLORS = ["#0f172a", "#334155", "#475569", "#1e293b", "#64748b"];

function hash36(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Stable Employee record for an agent discovered via CSV upload. */
export function employeeFromDiscoveredAgent(name: string, key: string): Employee {
  const h = hash36(key);
  const team = CLIENTS[Number.parseInt(h.slice(0, 4), 36) % CLIENTS.length] ?? "Management";
  const parts = name.split(" ");
  const first = (parts[0] ?? name).toLowerCase().replace(/[^a-z0-9]/g, "");
  const last = (parts[parts.length - 1] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "agent";
  return {
    id: `emp-up-${h}`,
    employeeId: `BPO-U${h.slice(0, 6).toUpperCase()}`,
    name,
    email: `${first}.${last}.${h.slice(0, 4)}@apexbpo.co.uk`,
    mobile: `+44 7${(Number.parseInt(h.slice(0, 8), 36) % 900000000) + 100000000}`,
    team,
    manager: TEAM_LEADERS[team] ?? "James Whitfield",
    role: "agent",
    joiningDate: iso(addDays(TODAY, -30)),
    shift: "Morning",
    status: "Active",
    leaveBalance: 0,
    commissionRate: 2.5,
    avatarColor:
      AVATAR_COLORS[Number.parseInt(h.slice(0, 2), 36) % AVATAR_COLORS.length] ?? "#334155",
  };
}

let hydratedUploadAgents = false;

/**
 * Inject agents discovered from dial CSV uploads into the employee list
 * and auto-create any campaign names that only exist on uploads.
 * Runs on every getDb() so a fresh upload appears without a full reload.
 */
export function syncUploadAgentsToDb(database: Database): number {
  if (!hydratedUploadAgents) {
    hydrateDiscoveredAgentsFromUploads();
    hydratedUploadAgents = true;
  }
  const known = new Set(database.employees.map((e) => normalizeAgentName(e.name)));
  let added = 0;
  for (const a of loadDiscoveredAgents()) {
    if (!a.key || known.has(a.key)) continue;
    database.employees.push(employeeFromDiscoveredAgent(a.name, a.key));
    known.add(a.key);
    added++;
  }

  const knownCampaigns = new Set(database.campaigns.map((c) => c.name));
  let campAdded = 0;
  for (const b of loadDialUploads()) {
    const name = b.campaign?.trim();
    if (!name || knownCampaigns.has(name)) continue;
    knownCampaigns.add(name);
    const agentIds = [
      ...new Set(
        (b.agents ?? [])
          .map((a) => database.employees.find((e) => normalizeAgentName(e.name) === a.key)?.id)
          .filter((id): id is string => !!id),
      ),
    ];
    database.campaigns.push({
      id: `camp-up-${hash36(name)}`,
      name,
      client: `${name} (upload)`,
      country: "United Kingdom",
      startDate: b.uploadDate ?? b.uploadedAt.slice(0, 10),
      endDate: null,
      agentIds,
      weeklySalesTarget: 50,
      createdAt: b.uploadedAt,
    });
    campAdded++;
  }

  return added + campAdded;
}

let db: Database | null = null;

/** Single in-memory database instance, seeded deterministically on first access. */
export function getDb(): Database {
  if (db) {
    syncUploadAgentsToDb(db);
    return db;
  }
  const employees = seedEmployees();
  const attendance = seedAttendance(employees);
  const performance = seedPerformance(employees, attendance);
  db = {
    employees,
    campaigns: seedCampaigns(performance),
    attendance,
    performance,
    leads: seedLeads(employees),
    qa: seedQa(employees),
    leave: seedLeave(employees),
    holidays: seedHolidays(),
    notifications: seedNotifications(),
    slabs: INCENTIVE_SLABS,
    settings: {
      orgName: "Apex BPO Solutions",
      currency: "GBP",
      dailyCallTarget: 250,
      dailySalesTarget: 5,
      monthlyRevenueTarget: 9000000,
      shiftStart: "09:00",
      lateGraceMinutes: 10,
      dailyLoginHoursTarget: 8,
      agentWeeklySalesTarget: 12,
      campaignWeeklySalesTarget: {
        BEC: 70,
        "Cream Life Insurance": 60,
        EDF: 65,
        "Scottish Power": 55,
        "Staycovered Over 50s": 50,
      },
    },
  };
  syncUploadAgentsToDb(db);
  return db;
}

export const today = () => iso(TODAY);
export const dayOffset = (n: number) => iso(addDays(TODAY, n));
