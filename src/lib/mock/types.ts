export type Role = "admin" | "manager" | "team_leader" | "agent";

export type EmployeeStatus = "Active" | "Inactive";

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  mobile: string;
  team: string;
  manager: string;
  role: Role;
  joiningDate: string;
  shift: "Morning" | "Afternoon" | "Night";
  status: EmployeeStatus;
  leaveBalance: number;
  commissionRate: number;
  avatarColor: string;
}

export type AttendanceStatus = "Present" | "Late" | "Absent" | "Leave" | "Half Day";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // yyyy-mm-dd
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number;
  breakMinutes: number;
  overtimeHours: number;
  lateMinutes: number;
  status: AttendanceStatus;
}

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Follow-up",
  "Quote Sent",
  "Converted",
  "Not Interested",
  "No Answer",
  "Wrong Number",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadNote {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  businessName: string;
  campaign: string;
  source: string;
  assignedAgentId: string;
  status: LeadStatus;
  notes: LeadNote[];
  followUpDate: string | null;
  saleAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HourlyDial {
  hour: number;
  dials: number;
  connects: number;
  noAnswer: number;
}

export interface PerformanceRecord {
  id: string;
  employeeId: string;
  date: string;
  campaign: string;
  callsMade: number;
  callsConnected: number;
  leadsGenerated: number;
  sales: number;
  revenue: number;
  avgTalkTimeSec: number;
  loginHours: number;
  qualityScore: number;
  /* dialler telemetry */
  dialAttempts: number;
  noAnswer: number;
  busy: number;
  voicemail: number;
  dnc: number;
  talkTimeSec: number;
  hourly: HourlyDial[];
}

export interface QaScorecard {
  id: string;
  employeeId: string;
  reviewerId: string;
  callId: string;
  date: string;
  scores: {
    opening: number;
    verification: number;
    pitch: number;
    objectionHandling: number;
    compliance: number;
    closing: number;
  };
  overall: number;
  comments: string;
}

export type LeaveType = "Casual" | "Sick" | "Earned" | "Unpaid";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  decidedBy?: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export type NotificationKind =
  | "followup"
  | "birthday"
  | "performance"
  | "target"
  | "attendance"
  | "alert";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  severity: "info" | "success" | "warning" | "critical";
}

export interface IncentiveSlab {
  minSales: number;
  amount: number;
}

export interface IncentiveRow {
  employeeId: string;
  sales: number;
  revenue: number;
  slabAmount: number;
  commission: number;
  total: number;
}

export interface DashboardStats {
  totalAgents: number;
  loggedIn: number;
  present: number;
  absent: number;
  callsToday: number;
  leadsGenerated: number;
  salesClosed: number;
  revenue: number;
  conversionRate: number;
  attendanceRate: number;
  deltas: {
    calls: number;
    leads: number;
    sales: number;
    revenue: number;
  };
}

export interface TrendPoint {
  date: string;
  calls: number;
  leads: number;
  sales: number;
  revenue: number;
  conversion: number;
}

export interface LeaderboardRow {
  rank: number;
  employeeId: string;
  name: string;
  team: string;
  sales: number;
  revenue: number;
  calls: number;
  leads: number;
  conversion: number;
  qualityScore: number;
  campaign: string;
  target: number;
  attainment: number;
  status: "on-target" | "borderline" | "below";
  weeklySales: number[];
  wow: number;
  weeksBelow: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PerfStatus = "on-target" | "borderline" | "below";

export interface WeekPoint {
  weekStart: string;
  label: string;
  calls: number;
  connects: number;
  leads: number;
  sales: number;
  revenue: number;
  conversion: number;
  target: number;
  attainment: number;
  status: PerfStatus;
}

export interface ConsistencyFlag {
  employeeId: string;
  name: string;
  team: string;
  campaign: string;
  weeksBelow: number;
  severity: "warning" | "critical";
  trendDirection: "declining" | "flat" | "recovering";
  message: string;
  action: string;
}

export interface CampaignSummary {
  campaign: string;
  agents: number;
  calls: number;
  connects: number;
  connectRate: number;
  leads: number;
  sales: number;
  revenue: number;
  conversion: number;
  avgTalkTimeSec: number;
  salesTarget: number;
  attainment: number;
  status: PerfStatus;
  wowSales: number;
  wowRevenue: number;
  flags: number;
}

export interface DiallerFinding {
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface DiallerAnalysis {
  campaign: string;
  dialAttempts: number;
  connects: number;
  connectRate: number;
  noAnswerRate: number;
  busyRate: number;
  voicemailRate: number;
  dncRate: number;
  avgTalkTimeSec: number;
  hourly: Array<{
    hour: string;
    dials: number;
    connects: number;
    noAnswer: number;
    connectRate: number;
    noAnswerRate: number;
  }>;
  bestHour: string;
  worstHour: string;
  findings: DiallerFinding[];
  suggestions: string[];
}

export interface Campaign {
  id: string;
  name: string;
  client: string;
  country: string;
  startDate: string;
  endDate: string | null;
  agentIds: string[];
  weeklySalesTarget: number;
  createdAt: string;
}
