import {
  CAMPAIGNS,
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
    agentWeeklySalesTarget: number;
    campaignWeeklySalesTarget: Record<string, number>;
  };
}

const CAMPAIGN_META: Record<string, { client: string; country: string; start: string }> = {
  "Solar UK": { client: "Brightvolt Energy Ltd", country: "United Kingdom", start: "2025-04-07" },
  "Medicare US": { client: "Northbridge Health Inc", country: "United States", start: "2025-06-02" },
  "Web Design AU": { client: "Coral Digital Pty", country: "Australia", start: "2025-08-11" },
  "Insurance CA": { client: "Maple Shield Insurance", country: "Canada", start: "2025-09-01" },
  "SEO Retainer": { client: "Fieldmark Media Group", country: "United Kingdom", start: "2025-10-06" },
};

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
      agentIds: [...new Set(performance.filter((p) => p.campaign === name).map((p) => p.employeeId))],
      weeklySalesTarget: 50,
      createdAt: meta?.start ?? "2025-01-06",
    } satisfies Campaign;
  });
}

let db: Database | null = null;

/** Single in-memory database instance, seeded deterministically on first access. */
export function getDb(): Database {
  if (db) return db;
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
      currency: "INR",
      dailyCallTarget: 250,
      dailySalesTarget: 5,
      monthlyRevenueTarget: 9000000,
      shiftStart: "09:00",
      lateGraceMinutes: 10,
      agentWeeklySalesTarget: 12,
      campaignWeeklySalesTarget: {
        "Solar UK": 70,
        "Medicare US": 60,
        "Web Design AU": 45,
        "Insurance CA": 55,
        "SEO Retainer": 35,
      },
    },
  };
  return db;
}

export const today = () => iso(TODAY);
export const dayOffset = (n: number) => iso(addDays(TODAY, n));
