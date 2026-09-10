/**
 * Mock backend API.
 *
 * Every export below behaves like a real network call: it is async, adds
 * latency, validates input and reads/writes the in-memory database in
 * `db.ts`. Swapping this file for real `fetch` calls would require no
 * changes in the UI layer.
 */
import { dayOffset, getDb, today } from "./db";
import { CAMPAIGNS, SOURCES, TEAMS, addDays, iso } from "./seed";
import {
  campaignOverview as campaignOverviewSync,
  consistencyFlags as consistencyFlagsSync,
  diallerAnalysis as diallerAnalysisSync,
  agentWeeklyTarget,
  weeklySeries as weeklySeriesSync,
  weeksBelowTarget,
  statusFor,
} from "./analytics";
import type {
  AppNotification,
  AttendanceRecord,
  DashboardStats,
  Employee,
  IncentiveRow,
  Lead,
  LeadStatus,
  LeaderboardRow,
  LeaveRequest,
  LeaveStatus,
  Paginated,
  PerformanceRecord,
  QaScorecard,
  Role,
  TrendPoint,
  Campaign,
  CampaignSummary,
  ConsistencyFlag,
  DiallerAnalysis,
  WeekPoint,
} from "./types";

const LATENCY = [180, 520];

function delay<T>(value: T): Promise<T> {
  const ms = LATENCY[0]! + Math.random() * (LATENCY[1]! - LATENCY[0]!);
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ auth */

export interface Session {
  employeeId: string;
  name: string;
  role: Role;
  team: string;
  email: string;
}

export async function login(email: string, password: string): Promise<Session> {
  const db = getDb();
  const emp = db.employees.find((e) => e.email.toLowerCase() === email.trim().toLowerCase());
  if (!emp) throw new ApiError("No account found with that email address.", 404);
  if (password.length < 4) throw new ApiError("Incorrect password.", 401);
  if (emp.status === "Inactive") throw new ApiError("This account has been deactivated.", 403);
  return delay({
    employeeId: emp.id,
    name: emp.name,
    role: emp.role,
    team: emp.team,
    email: emp.email,
  });
}

export async function listDemoAccounts(): Promise<Session[]> {
  const db = getDb();
  const roles: Role[] = ["admin", "manager", "team_leader", "agent"];
  return delay(
    roles.map((r) => {
      const e = db.employees.find((x) => x.role === r && x.status === "Active")!;
      return { employeeId: e.id, name: e.name, role: e.role, team: e.team, email: e.email };
    }),
  );
}

/* ------------------------------------------------------------- employees */

export interface EmployeeQuery {
  search?: string;
  team?: string;
  status?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}

export async function listEmployees(q: EmployeeQuery = {}): Promise<Paginated<Employee>> {
  const db = getDb();
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 10;
  let rows = [...db.employees];
  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(
      (e) =>
        e.name.toLowerCase().includes(s) ||
        e.employeeId.toLowerCase().includes(s) ||
        e.email.toLowerCase().includes(s),
    );
  }
  if (q.team && q.team !== "all") rows = rows.filter((e) => e.team === q.team);
  if (q.status && q.status !== "all") rows = rows.filter((e) => e.status === q.status);
  if (q.role && q.role !== "all") rows = rows.filter((e) => e.role === q.role);
  const total = rows.length;
  return delay({
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
  });
}

export async function getEmployee(id: string): Promise<Employee> {
  const emp = getDb().employees.find((e) => e.id === id);
  if (!emp) throw new ApiError("Employee not found", 404);
  return delay(emp);
}

export type EmployeeInput = Omit<Employee, "id" | "avatarColor">;

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const db = getDb();
  if (db.employees.some((e) => e.email.toLowerCase() === input.email.toLowerCase()))
    throw new ApiError("An employee with this email already exists.", 409);
  const emp: Employee = { ...input, id: uid("emp"), avatarColor: "#334155" };
  db.employees.unshift(emp);
  return delay(emp);
}

export async function updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee> {
  const db = getDb();
  const idx = db.employees.findIndex((e) => e.id === id);
  if (idx < 0) throw new ApiError("Employee not found", 404);
  db.employees[idx] = { ...db.employees[idx]!, ...patch };
  return delay(db.employees[idx]!);
}

export async function deleteEmployee(id: string): Promise<{ id: string }> {
  const db = getDb();
  const idx = db.employees.findIndex((e) => e.id === id);
  if (idx < 0) throw new ApiError("Employee not found", 404);
  db.employees.splice(idx, 1);
  return delay({ id });
}

export async function listTeams(): Promise<string[]> {
  return delay([...TEAMS]);
}

/* ------------------------------------------------------------ attendance */

export interface AttendanceRow extends AttendanceRecord {
  employeeName: string;
  team: string;
}

export async function listAttendance(params: {
  date?: string;
  from?: string;
  to?: string;
  team?: string;
  employeeId?: string;
  status?: string;
  search?: string;
}): Promise<AttendanceRow[]> {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  let rows = db.attendance.filter((a) => {
    if (params.date && a.date !== params.date) return false;
    if (params.from && a.date < params.from) return false;
    if (params.to && a.date > params.to) return false;
    if (params.employeeId && a.employeeId !== params.employeeId) return false;
    return true;
  });
  if (params.team && params.team !== "all")
    rows = rows.filter((a) => empById.get(a.employeeId)?.team === params.team);
  if (params.status && params.status !== "all")
    rows = rows.filter((a) => a.status === params.status);
  if (params.search) {
    const s = params.search.toLowerCase();
    rows = rows.filter((a) => empById.get(a.employeeId)?.name.toLowerCase().includes(s));
  }
  return delay(
    rows
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((a) => ({
        ...a,
        employeeName: empById.get(a.employeeId)?.name ?? "Unknown",
        team: empById.get(a.employeeId)?.team ?? "—",
      })),
  );
}

export async function checkIn(employeeId: string): Promise<AttendanceRecord> {
  const db = getDb();
  const date = today();
  const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (existing?.checkIn) throw new ApiError("You have already checked in today.", 409);
  const late = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 10);
  const record: AttendanceRecord = existing ?? {
    id: `att-${employeeId}-${date}`,
    employeeId,
    date,
    checkIn: null,
    checkOut: null,
    workingHours: 0,
    breakMinutes: 0,
    overtimeHours: 0,
    lateMinutes: 0,
    status: "Present",
  };
  record.checkIn = hhmm;
  record.status = late ? "Late" : "Present";
  record.lateMinutes = late ? Math.max(0, (now.getHours() - 9) * 60 + now.getMinutes()) : 0;
  if (!existing) db.attendance.push(record);
  return delay(record);
}

export async function checkOut(employeeId: string): Promise<AttendanceRecord> {
  const db = getDb();
  const date = today();
  const record = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
  if (!record?.checkIn) throw new ApiError("You need to check in first.", 400);
  if (record.checkOut) throw new ApiError("You have already checked out today.", 409);
  const now = new Date();
  record.checkOut = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [h, m] = record.checkIn.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes() - (h! * 60 + m!);
  record.workingHours = Number(Math.max(0, mins / 60).toFixed(2));
  record.overtimeHours = Number(Math.max(0, record.workingHours - 8.5).toFixed(2));
  return delay(record);
}

export async function getMyAttendanceToday(employeeId: string): Promise<AttendanceRecord | null> {
  const db = getDb();
  return delay(db.attendance.find((a) => a.employeeId === employeeId && a.date === today()) ?? null);
}

export async function attendanceSummary(params: { from: string; to: string; team?: string }) {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  const rows = db.attendance.filter(
    (a) =>
      a.date >= params.from &&
      a.date <= params.to &&
      (!params.team || params.team === "all" || empById.get(a.employeeId)?.team === params.team),
  );
  const byDate = new Map<string, { present: number; late: number; absent: number; leave: number }>();
  for (const r of rows) {
    const b = byDate.get(r.date) ?? { present: 0, late: 0, absent: 0, leave: 0 };
    if (r.status === "Present") b.present++;
    else if (r.status === "Late") b.late++;
    else if (r.status === "Absent") b.absent++;
    else b.leave++;
    byDate.set(r.date, b);
  }
  return delay(
    [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, v]) => ({ date, ...v })),
  );
}

/* ----------------------------------------------------------------- leads */

export interface LeadRow extends Lead {
  agentName: string;
}

export interface LeadQuery {
  search?: string;
  status?: string;
  campaign?: string;
  source?: string;
  agentId?: string;
  team?: string;
  page?: number;
  pageSize?: number;
}

export async function listLeads(q: LeadQuery = {}): Promise<Paginated<LeadRow>> {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  let rows = [...db.leads];
  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(
      (l) =>
        l.customerName.toLowerCase().includes(s) ||
        l.businessName.toLowerCase().includes(s) ||
        l.phone.includes(s) ||
        l.email.toLowerCase().includes(s),
    );
  }
  if (q.status && q.status !== "all") rows = rows.filter((l) => l.status === q.status);
  if (q.campaign && q.campaign !== "all") rows = rows.filter((l) => l.campaign === q.campaign);
  if (q.source && q.source !== "all") rows = rows.filter((l) => l.source === q.source);
  if (q.agentId) rows = rows.filter((l) => l.assignedAgentId === q.agentId);
  if (q.team && q.team !== "all")
    rows = rows.filter((l) => empById.get(l.assignedAgentId)?.team === q.team);
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 10;
  return delay({
    rows: rows
      .slice((page - 1) * pageSize, page * pageSize)
      .map((l) => ({ ...l, agentName: empById.get(l.assignedAgentId)?.name ?? "Unassigned" })),
    total: rows.length,
    page,
    pageSize,
  });
}

export async function getLead(id: string): Promise<LeadRow> {
  const db = getDb();
  const lead = db.leads.find((l) => l.id === id);
  if (!lead) throw new ApiError("Lead not found", 404);
  const agent = db.employees.find((e) => e.id === lead.assignedAgentId);
  return delay({ ...lead, agentName: agent?.name ?? "Unassigned" });
}

export type LeadInput = Pick<
  Lead,
  | "customerName"
  | "phone"
  | "email"
  | "businessName"
  | "campaign"
  | "source"
  | "assignedAgentId"
  | "status"
  | "followUpDate"
  | "saleAmount"
>;

export async function createLead(input: LeadInput): Promise<Lead> {
  const db = getDb();
  if (!input.customerName.trim()) throw new ApiError("Customer name is required.");
  if (!/^[+0-9 ()-]{7,}$/.test(input.phone)) throw new ApiError("Enter a valid phone number.");
  const lead: Lead = {
    ...input,
    id: uid("lead"),
    notes: [],
    createdAt: today(),
    updatedAt: today(),
  };
  db.leads.unshift(lead);
  return delay(lead);
}

export async function updateLead(id: string, patch: Partial<LeadInput>): Promise<Lead> {
  const db = getDb();
  const lead = db.leads.find((l) => l.id === id);
  if (!lead) throw new ApiError("Lead not found", 404);
  Object.assign(lead, patch, { updatedAt: today() });
  if (patch.status === "Converted" && !lead.saleAmount) lead.saleAmount = 12000;
  return delay(lead);
}

export async function deleteLead(id: string): Promise<{ id: string }> {
  const db = getDb();
  const idx = db.leads.findIndex((l) => l.id === id);
  if (idx < 0) throw new ApiError("Lead not found", 404);
  db.leads.splice(idx, 1);
  return delay({ id });
}

export async function addLeadNote(id: string, author: string, body: string): Promise<Lead> {
  const db = getDb();
  const lead = db.leads.find((l) => l.id === id);
  if (!lead) throw new ApiError("Lead not found", 404);
  if (!body.trim()) throw new ApiError("Note cannot be empty.");
  lead.notes.unshift({ id: uid("note"), author, body: body.trim(), createdAt: today() });
  lead.updatedAt = today();
  return delay(lead);
}

export async function bulkAssignLeads(ids: string[], agentId: string): Promise<{ updated: number }> {
  const db = getDb();
  let updated = 0;
  for (const l of db.leads) {
    if (ids.includes(l.id)) {
      l.assignedAgentId = agentId;
      l.updatedAt = today();
      updated++;
    }
  }
  return delay({ updated });
}

export async function leadMeta() {
  return delay({ campaigns: [...CAMPAIGNS], sources: [...SOURCES] });
}

export async function leadPipeline(): Promise<Array<{ status: LeadStatus; count: number }>> {
  const db = getDb();
  const map = new Map<LeadStatus, number>();
  for (const l of db.leads) map.set(l.status, (map.get(l.status) ?? 0) + 1);
  return delay([...map.entries()].map(([status, count]) => ({ status, count })));
}

export async function followUpsDue(employeeId?: string): Promise<LeadRow[]> {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  const t = today();
  return delay(
    db.leads
      .filter((l) => l.followUpDate && l.followUpDate <= t)
      .filter((l) => !employeeId || l.assignedAgentId === employeeId)
      .map((l) => ({ ...l, agentName: empById.get(l.assignedAgentId)?.name ?? "—" })),
  );
}

/* ----------------------------------------------------------- performance */

export interface PerformanceRow extends PerformanceRecord {
  employeeName: string;
  team: string;
  campaigns?: string;
  conversion: number;
}

function scopeEmployees(role?: Role, team?: string) {
  const db = getDb();
  if (role === "team_leader" && team) return db.employees.filter((e) => e.team === team);
  return db.employees;
}

export async function listPerformance(params: {
  from: string;
  to: string;
  team?: string | undefined;
  employeeId?: string | undefined;
  campaign?: string | undefined;
}): Promise<PerformanceRow[]> {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  const rows = db.performance.filter(
    (p) =>
      p.date >= params.from &&
      p.date <= params.to &&
      (!params.employeeId || p.employeeId === params.employeeId) &&
      (!params.team || params.team === "all" || empById.get(p.employeeId)?.team === params.team) &&
      (!params.campaign || params.campaign === "all" || p.campaign === params.campaign),
  );
  const agg = new Map<string, PerformanceRow & { _campaigns: Set<string> }>();
  for (const p of rows) {
    const e = empById.get(p.employeeId);
    let cur = agg.get(p.employeeId);
    if (!cur) {
      cur = {
        ...p,
        id: p.employeeId,
        callsMade: 0,
        callsConnected: 0,
        leadsGenerated: 0,
        sales: 0,
        revenue: 0,
        avgTalkTimeSec: 0,
        loginHours: 0,
        qualityScore: 0,
        conversion: 0,
        campaign: "",
        campaigns: "",
        _campaigns: new Set<string>(),
        dialAttempts: 0,
        noAnswer: 0,
        busy: 0,
        voicemail: 0,
        dnc: 0,
        talkTimeSec: 0,
        hourly: [],
        employeeName: e?.name ?? "—",
        team: e?.team ?? "—",
      };
      agg.set(p.employeeId, cur);
    }
    if (p.campaign) {
      cur._campaigns.add(p.campaign);
    }
    cur.callsMade += p.callsMade;
    cur.callsConnected += p.callsConnected;
    cur.leadsGenerated += p.leadsGenerated;
    cur.sales += p.sales;
    cur.revenue += p.revenue;
    cur.avgTalkTimeSec += p.avgTalkTimeSec;
    cur.loginHours += p.loginHours;
    cur.qualityScore += p.qualityScore;
    cur.dialAttempts += p.dialAttempts;
    cur.noAnswer += p.noAnswer;
    cur.busy += p.busy;
    cur.voicemail += p.voicemail;
    cur.dnc += p.dnc;
    cur.talkTimeSec += p.talkTimeSec;
  }
  const counts = new Map<string, number>();
  for (const p of rows) counts.set(p.employeeId, (counts.get(p.employeeId) ?? 0) + 1);
  const out = [...agg.values()].map((r) => {
    const n = counts.get(r.employeeId) || 1;
    const campList = Array.from(r._campaigns);
    const campaignStr = campList.length > 0 ? campList.join(", ") : r.campaign || "—";
    const { _campaigns, ...rest } = r;
    return {
      ...rest,
      campaign: campaignStr,
      campaigns: campaignStr,
      avgTalkTimeSec: Math.round(r.avgTalkTimeSec / n),
      qualityScore: Number((r.qualityScore / n).toFixed(1)),
      loginHours: Number(r.loginHours.toFixed(1)),
      conversion: r.leadsGenerated ? Number(((r.sales / r.leadsGenerated) * 100).toFixed(1)) : 0,
    };
  });
  return delay(out.sort((a, b) => b.sales - a.sales));
}

export async function trend(days = 14, team?: string): Promise<TrendPoint[]> {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  const from = dayOffset(-days + 1);
  const map = new Map<string, TrendPoint>();
  for (const p of db.performance) {
    if (p.date < from) continue;
    if (team && team !== "all" && empById.get(p.employeeId)?.team !== team) continue;
    const cur =
      map.get(p.date) ?? { date: p.date, calls: 0, leads: 0, sales: 0, revenue: 0, conversion: 0 };
    cur.calls += p.callsMade;
    cur.leads += p.leadsGenerated;
    cur.sales += p.sales;
    cur.revenue += p.revenue;
    map.set(p.date, cur);
  }
  return delay(
    [...map.values()]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((p) => ({
        ...p,
        conversion: p.leads ? Number(((p.sales / p.leads) * 100).toFixed(1)) : 0,
      })),
  );
}

export async function dashboardStats(team?: string): Promise<DashboardStats> {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  const inScope = (id: string) =>
    !team || team === "all" || empById.get(id)?.team === team;
  const agents = db.employees.filter(
    (e) => e.role === "agent" && e.status === "Active" && inScope(e.id),
  );
  const t = today();
  const y = dayOffset(-1);
  const att = db.attendance.filter((a) => a.date === t && inScope(a.employeeId));
  const perfFor = (date: string) =>
    db.performance.filter((p) => p.date === date && inScope(p.employeeId));
  const sum = (rows: PerformanceRecord[], k: keyof PerformanceRecord) =>
    rows.reduce((s, r) => s + (r[k] as number), 0);

  const tp = perfFor(t);
  const yp = perfFor(y);
  const present = att.filter((a) => a.status === "Present" || a.status === "Late").length;
  const absent = att.filter((a) => a.status === "Absent").length;
  const leads = sum(tp, "leadsGenerated");
  const sales = sum(tp, "sales");
  const pct = (a: number, b: number) => (b ? Number((((a - b) / b) * 100).toFixed(1)) : 0);

  return delay({
    totalAgents: agents.length,
    loggedIn: att.filter((a) => a.checkIn && !a.checkOut).length,
    present,
    absent,
    callsToday: sum(tp, "callsMade"),
    leadsGenerated: leads,
    salesClosed: sales,
    revenue: sum(tp, "revenue"),
    conversionRate: leads ? Number(((sales / leads) * 100).toFixed(1)) : 0,
    attendanceRate: agents.length ? Number(((present / agents.length) * 100).toFixed(1)) : 0,
    deltas: {
      calls: pct(sum(tp, "callsMade"), sum(yp, "callsMade")),
      leads: pct(leads, sum(yp, "leadsGenerated")),
      sales: pct(sales, sum(yp, "sales")),
      revenue: pct(sum(tp, "revenue"), sum(yp, "revenue")),
    },
  });
}

export async function leaderboard(
  period: "daily" | "weekly" | "monthly" = "daily",
  metric: "sales" | "revenue" | "conversion" | "calls" | "qualityScore" = "sales",
  team?: string,
  campaign?: string,
): Promise<LeaderboardRow[]> {
  const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const rows = await listPerformance({
    from: dayOffset(-days + 1),
    to: today(),
    team,
    campaign,
  });
  const target = Math.round(
    (agentWeeklyTarget(campaign) / 7) * days,
  );
  const sorted = rows
    .map((r) => {
      const series = weeklySeriesSync({
        employeeId: r.employeeId,
        ...(campaign && campaign !== "all" ? { campaign } : {}),
        weeks: 6,
      });
      const weeklySales = series.map((w) => w.sales);
      const lastTwo = series.slice(-2);
      const prev = lastTwo[0]?.sales ?? 0;
      const cur = lastTwo[1]?.sales ?? 0;
      const attainment = target ? Number(((r.sales / target) * 100).toFixed(1)) : 0;
      return {
        employeeId: r.employeeId,
        name: r.employeeName,
        team: r.team,
        sales: r.sales,
        revenue: r.revenue,
        calls: r.callsMade,
        leads: r.leadsGenerated,
        conversion: r.conversion,
        qualityScore: r.qualityScore,
        campaign: campaign && campaign !== "all" ? campaign : "All campaigns",
        target,
        attainment,
        status: statusFor(attainment),
        weeklySales,
        wow: prev ? Number((((cur - prev) / prev) * 100).toFixed(1)) : 0,
        weeksBelow: weeksBelowTarget(
          r.employeeId,
          campaign && campaign !== "all" ? campaign : undefined,
        ),
        rank: 0,
      } satisfies LeaderboardRow;
    })
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return sorted;
}

/* ------------------------------------------------------------- campaigns */

export async function listCampaigns(): Promise<string[]> {
  return delay(getDb().campaigns.map((c) => c.name));
}

export async function listCampaignRecords(): Promise<Campaign[]> {
  return delay(getDb().campaigns.map((c) => ({ ...c, agentIds: [...c.agentIds] })));
}

export interface CampaignInput {
  name: string;
  client: string;
  country: string;
  startDate: string;
  endDate?: string | null;
  agentIds: string[];
  weeklySalesTarget?: number;
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error("Campaign name is required");
  if (db.campaigns.some((c) => c.name.toLowerCase() === name.toLowerCase()))
    throw new Error("A campaign with that name already exists");
  if (!input.client.trim()) throw new Error("Client name is required");
  if (!input.country.trim()) throw new Error("Country is required");
  if (!input.startDate) throw new Error("Start date is required");
  if (input.endDate && input.endDate < input.startDate)
    throw new Error("End date must be after the start date");

  const campaign: Campaign = {
    id: `camp-${Date.now()}`,
    name,
    client: input.client.trim(),
    country: input.country.trim(),
    startDate: input.startDate,
    endDate: input.endDate || null,
    agentIds: [...new Set(input.agentIds)],
    weeklySalesTarget: input.weeklySalesTarget ?? 40,
    createdAt: today(),
  };
  db.campaigns.push(campaign);
  db.settings.campaignWeeklySalesTarget[name] = campaign.weeklySalesTarget;
  return delay(campaign);
}

export async function deleteCampaign(name: string): Promise<{ deleted: boolean }> {
  const db = getDb();
  const idx = db.campaigns.findIndex((c) => c.name === name);
  if (idx === -1) throw new Error("Campaign not found");
  db.campaigns.splice(idx, 1);
  delete db.settings.campaignWeeklySalesTarget[name];
  return delay({ deleted: true });
}

export async function campaignOverview(params: {
  from: string;
  to: string;
}): Promise<CampaignSummary[]> {
  return delay(campaignOverviewSync(params.from, params.to));
}

export interface CampaignAgentRow extends PerformanceRow {
  target: number;
  attainment: number;
  status: "on-target" | "borderline" | "below";
  weeksBelow: number;
  weeklySales: number[];
}

export async function campaignAgents(params: {
  campaign: string;
  from: string;
  to: string;
  team?: string;
}): Promise<CampaignAgentRow[]> {
  const rows = await listPerformance(params);
  const days = Math.max(
    1,
    Math.round(
      (new Date(`${params.to}T00:00:00`).getTime() -
        new Date(`${params.from}T00:00:00`).getTime()) /
        864e5,
    ) + 1,
  );
  const scoped = params.campaign !== "all" ? params.campaign : undefined;
  const target = Math.round((agentWeeklyTarget(scoped) / 7) * days);
  return delay(
    rows.map((r) => {
      const attainment = target ? Number(((r.sales / target) * 100).toFixed(1)) : 0;
      return {
        ...r,
        target,
        attainment,
        status: statusFor(attainment),
        weeksBelow: weeksBelowTarget(r.employeeId, scoped),
        weeklySales: weeklySeriesSync({
          employeeId: r.employeeId,
          ...(scoped ? { campaign: scoped } : {}),
          weeks: 6,
        }).map((w) => w.sales),
      };
    }),
  );
}

export async function weeklySeries(params: {
  campaign?: string;
  employeeId?: string;
  team?: string;
  weeks?: number;
}): Promise<WeekPoint[]> {
  return delay(weeklySeriesSync(params));
}

export async function consistencyFlags(campaign?: string): Promise<ConsistencyFlag[]> {
  return delay(consistencyFlagsSync(campaign && campaign !== "all" ? campaign : undefined));
}

export async function diallerAnalysis(
  campaign?: string,
  days = 14,
): Promise<DiallerAnalysis> {
  return delay(diallerAnalysisSync(campaign && campaign !== "all" ? campaign : undefined, days));
}

/* -------------------------------------------------------------------- qa */

export interface QaRow extends QaScorecard {
  employeeName: string;
  reviewerName: string;
  team: string;
}

export async function listQa(params: { employeeId?: string; team?: string } = {}): Promise<QaRow[]> {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  let rows = [...db.qa];
  if (params.employeeId) rows = rows.filter((q) => q.employeeId === params.employeeId);
  if (params.team && params.team !== "all")
    rows = rows.filter((q) => empById.get(q.employeeId)?.team === params.team);
  return delay(
    rows
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((q) => ({
        ...q,
        employeeName: empById.get(q.employeeId)?.name ?? "—",
        reviewerName: empById.get(q.reviewerId)?.name ?? "—",
        team: empById.get(q.employeeId)?.team ?? "—",
      })),
  );
}

export async function createQa(input: Omit<QaScorecard, "id" | "overall">): Promise<QaScorecard> {
  const db = getDb();
  const overall = Math.round(
    (Object.values(input.scores).reduce((s, v) => s + v, 0) / 60) * 100,
  );
  const row: QaScorecard = { ...input, id: uid("qa"), overall };
  db.qa.unshift(row);
  return delay(row);
}

/* ----------------------------------------------------------------- leave */

export interface LeaveRow extends LeaveRequest {
  employeeName: string;
  team: string;
}

export async function listLeave(params: { employeeId?: string; status?: string; team?: string } = {}) {
  const db = getDb();
  const empById = new Map(db.employees.map((e) => [e.id, e]));
  let rows = [...db.leave];
  if (params.employeeId) rows = rows.filter((l) => l.employeeId === params.employeeId);
  if (params.status && params.status !== "all") rows = rows.filter((l) => l.status === params.status);
  if (params.team && params.team !== "all")
    rows = rows.filter((l) => empById.get(l.employeeId)?.team === params.team);
  return delay(
    rows
      .sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1))
      .map((l) => ({
        ...l,
        employeeName: empById.get(l.employeeId)?.name ?? "—",
        team: empById.get(l.employeeId)?.team ?? "—",
      })) as LeaveRow[],
  );
}

export async function applyLeave(input: Omit<LeaveRequest, "id" | "status" | "appliedAt" | "days">) {
  const db = getDb();
  if (input.to < input.from) throw new ApiError("End date cannot be before the start date.");
  const days =
    Math.round(
      (new Date(input.to).getTime() - new Date(input.from).getTime()) / 86400000,
    ) + 1;
  const emp = db.employees.find((e) => e.id === input.employeeId);
  if (emp && input.type !== "Unpaid" && days > emp.leaveBalance)
    throw new ApiError(`Insufficient balance. You have ${emp.leaveBalance} day(s) left.`);
  const row: LeaveRequest = {
    ...input,
    id: uid("lv"),
    days,
    status: "Pending",
    appliedAt: today(),
  };
  db.leave.unshift(row);
  return delay(row);
}

export async function decideLeave(id: string, status: LeaveStatus, decidedBy: string) {
  const db = getDb();
  const row = db.leave.find((l) => l.id === id);
  if (!row) throw new ApiError("Leave request not found", 404);
  if (row.status !== "Pending") throw new ApiError("This request has already been processed.", 409);
  row.status = status;
  row.decidedBy = decidedBy;
  if (status === "Approved") {
    const emp = db.employees.find((e) => e.id === row.employeeId);
    if (emp && row.type !== "Unpaid") emp.leaveBalance = Math.max(0, emp.leaveBalance - row.days);
  }
  return delay(row);
}

export async function listHolidays() {
  return delay(getDb().holidays);
}

/* ------------------------------------------------------------ incentives */

export async function incentives(period: "weekly" | "monthly" = "monthly", team?: string) {
  const db = getDb();
  const days = period === "weekly" ? 7 : 30;
  const perf = await listPerformance({ from: dayOffset(-days + 1), to: today(), team });
  const rows: IncentiveRow[] = perf.map((p) => {
    const slab = [...db.slabs].reverse().find((s) => p.sales >= s.minSales);
    const emp = db.employees.find((e) => e.id === p.employeeId);
    const commission = Math.round((p.revenue * (emp?.commissionRate ?? 0)) / 100);
    const slabAmount = slab?.amount ?? 0;
    return {
      employeeId: p.employeeId,
      sales: p.sales,
      revenue: p.revenue,
      slabAmount,
      commission,
      total: slabAmount + commission,
    };
  });
  return delay({
    slabs: db.slabs,
    rows: rows
      .map((r) => ({
        ...r,
        name: db.employees.find((e) => e.id === r.employeeId)?.name ?? "—",
        team: db.employees.find((e) => e.id === r.employeeId)?.team ?? "—",
      }))
      .sort((a, b) => b.total - a.total),
  });
}

/* --------------------------------------------------------- notifications */

export async function listNotifications(): Promise<AppNotification[]> {
  return delay(getDb().notifications);
}

export async function markNotificationRead(id: string) {
  const db = getDb();
  const n = db.notifications.find((x) => x.id === id);
  if (n) n.read = true;
  return delay({ ok: true });
}

export async function markAllNotificationsRead() {
  const db = getDb();
  db.notifications.forEach((n) => (n.read = true));
  return delay({ ok: true });
}

/* --------------------------------------------------------------- reports */

export type ReportType =
  | "daily"
  | "weekly"
  | "monthly"
  | "team"
  | "attendance"
  | "sales"
  | "revenue"
  | "conversion"
  | "agent"
  | "campaign"
  | "campaign_agent"
  | "dialler";

export interface ReportResult {
  title: string;
  generatedAt: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  summary: Array<{ label: string; value: string }>;
}

export async function generateReport(
  type: ReportType,
  params: { from: string; to: string; team?: string; campaign?: string },
): Promise<ReportResult> {
  const db = getDb();
  const perf = await listPerformance(params);
  const generatedAt = new Date().toISOString();
  const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  if (type === "attendance") {
    const rows = db.attendance.filter((a) => a.date >= params.from && a.date <= params.to);
    const byEmp = new Map<string, { p: number; l: number; a: number; hrs: number }>();
    for (const r of rows) {
      const b = byEmp.get(r.employeeId) ?? { p: 0, l: 0, a: 0, hrs: 0 };
      if (r.status === "Present") b.p++;
      else if (r.status === "Late") b.l++;
      else if (r.status === "Absent") b.a++;
      b.hrs += r.workingHours;
      byEmp.set(r.employeeId, b);
    }
    return delay({
      title: "Attendance Report",
      generatedAt,
      columns: ["Employee", "Team", "Present", "Late", "Absent", "Total Hours"],
      rows: [...byEmp.entries()].map(([id, v]) => {
        const e = db.employees.find((x) => x.id === id);
        return [e?.name ?? "—", e?.team ?? "—", v.p, v.l, v.a, v.hrs.toFixed(1)];
      }),
      summary: [
        { label: "Records", value: String(rows.length) },
        {
          label: "Attendance rate",
          value: `${((rows.filter((r) => r.status !== "Absent").length / (rows.length || 1)) * 100).toFixed(1)}%`,
        },
      ],
    });
  }

  if (type === "campaign") {
    const rollup = campaignOverviewSync(params.from, params.to).filter(
      (c) => !params.campaign || params.campaign === "all" || c.campaign === params.campaign,
    );
    return delay({
      title: "Campaign Rollup Report",
      generatedAt,
      columns: [
        "Campaign",
        "Agents",
        "Calls",
        "Connect %",
        "Leads",
        "Sales",
        "Target",
        "Attainment",
        "Revenue",
        "Flags",
      ],
      rows: rollup.map((c) => [
        c.campaign,
        c.agents,
        c.calls,
        `${c.connectRate}%`,
        c.leads,
        c.sales,
        c.salesTarget,
        `${c.attainment}%`,
        money(c.revenue),
        c.flags,
      ]),
      summary: [
        { label: "Campaigns", value: String(rollup.length) },
        { label: "Sales", value: String(rollup.reduce((s2, c) => s2 + c.sales, 0)) },
        { label: "Revenue", value: money(rollup.reduce((s2, c) => s2 + c.revenue, 0)) },
        {
          label: "Below target",
          value: String(rollup.filter((c) => c.status === "below").length),
        },
      ],
    });
  }

  if (type === "campaign_agent") {
    const db2 = getDb();
    const empById = new Map(db2.employees.map((e) => [e.id, e]));
    const key = (c: string, id: string) => `${c}||${id}`;
    const agg = new Map<
      string,
      { campaign: string; id: string; calls: number; connects: number; leads: number; sales: number; revenue: number }
    >();
    for (const p of db2.performance) {
      if (p.date < params.from || p.date > params.to) continue;
      if (params.campaign && params.campaign !== "all" && p.campaign !== params.campaign) continue;
      if (params.team && params.team !== "all" && empById.get(p.employeeId)?.team !== params.team)
        continue;
      const k = key(p.campaign, p.employeeId);
      const cur =
        agg.get(k) ??
        { campaign: p.campaign, id: p.employeeId, calls: 0, connects: 0, leads: 0, sales: 0, revenue: 0 };
      cur.calls += p.callsMade;
      cur.connects += p.callsConnected;
      cur.leads += p.leadsGenerated;
      cur.sales += p.sales;
      cur.revenue += p.revenue;
      agg.set(k, cur);
    }
    const rows = [...agg.values()]
      .sort((a, b) => a.campaign.localeCompare(b.campaign) || b.sales - a.sales)
      .map((v) => [
        v.campaign,
        empById.get(v.id)?.name ?? "—",
        empById.get(v.id)?.team ?? "—",
        v.calls,
        v.connects,
        v.leads,
        v.sales,
        money(v.revenue),
        `${v.leads ? ((v.sales / v.leads) * 100).toFixed(1) : 0}%`,
      ]);
    return delay({
      title: "Campaign → Agent Report",
      generatedAt,
      columns: [
        "Campaign",
        "Agent",
        "Team",
        "Calls",
        "Connected",
        "Leads",
        "Sales",
        "Revenue",
        "Conversion",
      ],
      rows,
      summary: [
        { label: "Rows", value: String(rows.length) },
        { label: "Campaigns", value: String(new Set([...agg.values()].map((v) => v.campaign)).size) },
        { label: "Sales", value: String([...agg.values()].reduce((s2, v) => s2 + v.sales, 0)) },
        { label: "Revenue", value: money([...agg.values()].reduce((s2, v) => s2 + v.revenue, 0)) },
      ],
    });
  }

  if (type === "dialler") {
    const days = Math.max(
      1,
      Math.round(
        (new Date(`${params.to}T00:00:00`).getTime() -
          new Date(`${params.from}T00:00:00`).getTime()) /
          864e5,
      ) + 1,
    );
    const d = diallerAnalysisSync(
      params.campaign && params.campaign !== "all" ? params.campaign : undefined,
      days,
    );
    return delay({
      title: "Dialler Outcome Report",
      generatedAt,
      columns: ["Hour", "Dials", "Connects", "Connect %", "No answer", "No answer %"],
      rows: d.hourly.map((h) => [h.hour, h.dials, h.connects, `${h.connectRate}%`, h.noAnswer, `${h.noAnswerRate}%`]),
      summary: [
        { label: "Dial attempts", value: d.dialAttempts.toLocaleString("en-GB") },
        { label: "Connect rate", value: `${d.connectRate}%` },
        { label: "No answer", value: `${d.noAnswerRate}%` },
        { label: "Best hour", value: d.bestHour },
      ],
    });
  }

  if (type === "team") {
    const byTeam = new Map<string, { calls: number; leads: number; sales: number; revenue: number }>();
    for (const p of perf) {
      const b = byTeam.get(p.team) ?? { calls: 0, leads: 0, sales: 0, revenue: 0 };
      b.calls += p.callsMade;
      b.leads += p.leadsGenerated;
      b.sales += p.sales;
      b.revenue += p.revenue;
      byTeam.set(p.team, b);
    }
    return delay({
      title: "Team Report",
      generatedAt,
      columns: ["Team", "Calls", "Leads", "Sales", "Revenue", "Conversion"],
      rows: [...byTeam.entries()].map(([t, v]) => [
        t,
        v.calls,
        v.leads,
        v.sales,
        money(v.revenue),
        `${v.leads ? ((v.sales / v.leads) * 100).toFixed(1) : 0}%`,
      ]),
      summary: [
        { label: "Teams", value: String(byTeam.size) },
        {
          label: "Total revenue",
          value: money([...byTeam.values()].reduce((s, v) => s + v.revenue, 0)),
        },
      ],
    });
  }

  const titles: Record<string, string> = {
    daily: "Daily Report",
    weekly: "Weekly Report",
    monthly: "Monthly Report",
    sales: "Sales Report",
    revenue: "Revenue Report",
    conversion: "Conversion Report",
    agent: "Agent Performance Report",
  };

  return delay({
    title: titles[type] ?? "Report",
    generatedAt,
    columns: ["Agent", "Team", "Calls", "Connected", "Leads", "Sales", "Revenue", "Conversion", "QA"],
    rows: perf.map((p) => [
      p.employeeName,
      p.team,
      p.callsMade,
      p.callsConnected,
      p.leadsGenerated,
      p.sales,
      money(p.revenue),
      `${p.conversion}%`,
      p.qualityScore,
    ]),
    summary: [
      { label: "Agents", value: String(perf.length) },
      { label: "Calls", value: perf.reduce((s, p) => s + p.callsMade, 0).toLocaleString("en-IN") },
      { label: "Sales", value: String(perf.reduce((s, p) => s + p.sales, 0)) },
      { label: "Revenue", value: money(perf.reduce((s, p) => s + p.revenue, 0)) },
    ],
  });
}

/* -------------------------------------------------------------- settings */

export async function getSettings() {
  return delay(getDb().settings);
}

export async function updateSettings(patch: Partial<Database["settings"]>) {
  const db = getDb();
  Object.assign(db.settings, patch);
  return delay(db.settings);
}

type Database = ReturnType<typeof getDb>;

/* --------------------------------------------------------------- ai */

export interface AiSummary {
  headline: string;
  rating: number;
  bullets: string[];
  strengths: string[];
  improvements: string[];
  predictions: string[];
}

export async function aiDailySummary(team?: string): Promise<AiSummary> {
  const stats = await dashboardStats(team);
  const board = await leaderboard("daily", "sales", team);
  const top = board[0];
  const worst = [...board].reverse()[0];
  const dir = (n: number) => (n >= 0 ? `an increase of ${n}%` : `a decrease of ${Math.abs(n)}%`);
  const rating = Math.max(
    1,
    Math.min(10, Number((stats.conversionRate / 4 + stats.attendanceRate / 20).toFixed(1))),
  );
  return delay({
    headline:
      rating >= 8
        ? "Today's performance was above average."
        : rating >= 6
          ? "Today's performance was in line with expectations."
          : "Today's performance was below target.",
    rating,
    bullets: [
      `${stats.present} of ${stats.totalAgents} agents were present (${stats.attendanceRate}% attendance).`,
      `The team made ${stats.callsToday.toLocaleString("en-IN")} outbound calls, ${dir(stats.deltas.calls)} compared to yesterday.`,
      `${stats.leadsGenerated} qualified leads were generated.`,
      `${stats.salesClosed} sales were closed at a conversion rate of ${stats.conversionRate}%.`,
      `Revenue booked today: ₹${stats.revenue.toLocaleString("en-IN")} (${dir(stats.deltas.revenue)}).`,
    ],
    strengths: [
      `${top?.name ?? "The top performer"} led the floor with ${top?.sales ?? 0} sales and ${top?.conversion ?? 0}% conversion.`,
      "Follow-up leads converted better than brand new leads.",
      "Morning shift achieved the highest conversion rate.",
    ],
    improvements: [
      `${stats.absent} agent(s) were marked absent today.`,
      `${worst?.name ?? "Some agents"} closed ${worst?.sales ?? 0} sale(s) — coaching recommended.`,
      "No-answer calls trended upward after 3 PM.",
    ],
    predictions: [
      `At the current pace the team is projected to reach ${Math.round(80 + stats.conversionRate * 1.4)}% of the monthly target.`,
      stats.deltas.sales < 0
        ? "Conversion may decline tomorrow due to reduced follow-up inventory."
        : "Momentum suggests conversion will hold or improve tomorrow.",
      "Attendance is the single biggest lever on next week's revenue.",
    ],
  });
}

export interface AiAgentAnalysis {
  employeeId: string;
  name: string;
  verdict: "Excellent" | "Good" | "Needs Improvement";
  stars: number;
  facts: string[];
  recommendation: string;
}

export async function aiAgentAnalysis(employeeId: string): Promise<AiAgentAnalysis> {
  const db = getDb();
  const emp = db.employees.find((e) => e.id === employeeId);
  if (!emp) throw new ApiError("Employee not found", 404);
  const perf = (await listPerformance({ from: dayOffset(-6), to: today(), employeeId }))[0];
  const att = db.attendance.filter((a) => a.employeeId === employeeId && a.date >= dayOffset(-6));
  const late = att.reduce((s, a) => s + a.lateMinutes, 0);
  const conv = perf?.conversion ?? 0;
  const verdict = conv >= 25 ? "Excellent" : conv >= 15 ? "Good" : "Needs Improvement";
  return delay({
    employeeId,
    name: emp.name,
    verdict,
    stars: verdict === "Excellent" ? 5 : verdict === "Good" ? 4 : 2,
    facts: [
      `${perf?.callsMade ?? 0} calls completed in the last 7 days`,
      `${perf?.leadsGenerated ?? 0} qualified leads generated`,
      `${perf?.sales ?? 0} sales closed`,
      `Conversion rate: ${conv}%`,
      `Total login delay: ${late} minutes`,
      `Average QA score: ${perf?.qualityScore ?? 0}`,
    ],
    recommendation:
      verdict === "Excellent"
        ? `${emp.name} converts follow-up leads effectively. Consider assigning higher-value leads and using recent calls as coaching examples.`
        : verdict === "Good"
          ? `${emp.name} is consistent but plateauing. Focus on closing technique and increasing connected-call volume.`
          : `Focus coaching on call openings and objection handling. Review idle time and ensure follow-up tasks are completed.`,
  });
}

export async function aiAlerts(): Promise<AppNotification[]> {
  const notifications = await listNotifications();
  return notifications.filter((n) => n.severity !== "info");
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function aiChat(question: string): Promise<ChatMessage> {
  const q = question.toLowerCase();
  const stats = await dashboardStats();
  const board = await leaderboard("weekly", "conversion");
  const top3 = board.slice(0, 3).map((b) => b.name).join(", ");
  const bottom3 = [...board].reverse().slice(0, 3).map((b) => b.name).join(", ");

  let content: string;
  if (q.includes("why") && (q.includes("down") || q.includes("poor") || q.includes("low"))) {
    content = `Sales are tracking ${stats.deltas.sales}% versus yesterday. The main contributors are attendance at ${stats.attendanceRate}% (${stats.absent} absent), a conversion rate of ${stats.conversionRate}%, and a rise in no-answer calls during the afternoon block. Team B accounted for the largest share of the decline.`;
  } else if (q.includes("coach") || q.includes("improve") || q.includes("training")) {
    content = `Based on the last seven days, ${bottom3} have conversion rates below the team average. Recommended focus: call openings, objection handling and follow-up completion. Two of them also show repeated login delays.`;
  } else if (q.includes("incentive") || q.includes("bonus") || q.includes("reward")) {
    content = `${top3} exceeded their targets this week, maintained strong attendance and rank in the top three for conversion. They qualify for the current incentive slab.`;
  } else if (q.includes("attendance")) {
    content = `Attendance today is ${stats.attendanceRate}% — ${stats.present} present, ${stats.absent} absent, ${stats.loggedIn} currently logged in. Morning shift is fully staffed; the afternoon shift is running two agents short.`;
  } else if (q.includes("revenue") || q.includes("target")) {
    content = `Revenue booked today is ₹${stats.revenue.toLocaleString("en-IN")} (${stats.deltas.revenue}% vs yesterday). At the current pace the floor is projected to reach roughly ${Math.round(80 + stats.conversionRate * 1.4)}% of the monthly target.`;
  } else if (q.includes("best") || q.includes("top")) {
    content = `Top performers this week by conversion: ${top3}. ${board[0]?.name} leads with ${board[0]?.conversion}% conversion across ${board[0]?.calls} calls.`;
  } else {
    content = `Here is the current picture: ${stats.callsToday.toLocaleString("en-IN")} calls, ${stats.leadsGenerated} leads and ${stats.salesClosed} sales today at ${stats.conversionRate}% conversion, with ${stats.attendanceRate}% attendance. Ask me why performance moved, who needs coaching, or who deserves an incentive.`;
  }
  return delay({ id: uid("msg"), role: "assistant", content, createdAt: new Date().toISOString() });
}

export const api = {
  login,
  listDemoAccounts,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listTeams,
  listAttendance,
  checkIn,
  checkOut,
  getMyAttendanceToday,
  attendanceSummary,
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  addLeadNote,
  bulkAssignLeads,
  leadMeta,
  leadPipeline,
  followUpsDue,
  listPerformance,
  trend,
  dashboardStats,
  leaderboard,
  listCampaigns,
  listCampaignRecords,
  createCampaign,
  deleteCampaign,
  campaignOverview,
  campaignAgents,
  weeklySeries,
  consistencyFlags,
  diallerAnalysis,
  listQa,
  createQa,
  listLeave,
  applyLeave,
  decideLeave,
  listHolidays,
  incentives,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  generateReport,
  getSettings,
  updateSettings,
  aiDailySummary,
  aiAgentAnalysis,
  aiAlerts,
  aiChat,
};

export { addDays, iso, scopeEmployees };
