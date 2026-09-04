import type {
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  Holiday,
  IncentiveSlab,
  Lead,
  LeadStatus,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  AppNotification,
  PerformanceRecord,
  QaScorecard,
  Role,
} from "./types";
import { LEAD_STATUSES } from "./types";

/** Deterministic PRNG so SSR and client render identical mock data. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260731);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)] as T;
const at = <T,>(arr: readonly T[], i: number) => arr[i] as T;
const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

export const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export const TEAMS = ["Team A", "Team B", "Team C", "Team D"] as const;
export const CAMPAIGNS = [
  "Solar UK",
  "Medicare US",
  "Web Design AU",
  "Insurance CA",
  "SEO Retainer",
] as const;
export const SOURCES = ["Cold Call", "Website", "Referral", "Facebook Ads", "Google Ads", "Email"] as const;

const FIRST = [
  "Oliver", "Amelia", "Harry", "Isla", "George", "Ava", "Jack", "Freya", "Charlie", "Poppy",
  "Thomas", "Emily", "Alfie", "Sophie", "Henry", "Grace", "Oscar", "Ella", "Archie", "Chloe",
  "Freddie", "Daisy", "Leo", "Millie", "Arthur",
];
const LAST = [
  "Smith", "Jones", "Taylor", "Brown", "Wilson", "Davies", "Evans", "Thomas", "Roberts", "Walker",
];
const BIZ = [
  "Bright Solar Ltd", "Nova Health UK", "PixelForge Studio", "SafeGuard Insurance", "UrbanEats",
  "GreenLeaf Farms", "Titan Logistics", "BlueWave Media", "Corex Dental", "Lumen Realty",
  "Peak Fitness", "Nimbus Cloud", "Vertex Legal", "Harbour Cafe", "Stellar Autos",
];
const AVATAR_COLORS = ["#0f172a", "#334155", "#475569", "#1e293b", "#64748b"];

export const MANAGERS = ["Charlotte Hughes", "James Whitfield"];

export function seedEmployees(): Employee[] {
  const employees: Employee[] = [];

  const staff: Array<{ name: string; role: Role; team: string }> = [
    { name: "Charlotte Hughes", role: "admin", team: "Management" },
    { name: "James Whitfield", role: "manager", team: "Management" },
    { name: "Daniel Carter", role: "team_leader", team: "Team A" },
    { name: "Sophie Bennett", role: "team_leader", team: "Team B" },
    { name: "Liam Fletcher", role: "team_leader", team: "Team C" },
    { name: "Hannah Price", role: "team_leader", team: "Team D" },
  ];

  staff.forEach((s, i) => {
    employees.push({
      id: `emp-${String(i + 1).padStart(3, "0")}`,
      employeeId: `BPO-${1000 + i + 1}`,
      name: s.name,
      email: `${(s.name.split(" ")[0] as string).toLowerCase()}@apexbpo.co.uk`,
      mobile: `+44 7${int(100000000, 899999999)}`,
      team: s.team,
      manager: s.role === "admin" ? "—" : "Charlotte Hughes",
      role: s.role,
      joiningDate: iso(addDays(TODAY, -int(400, 1200))),
      shift: "Morning",
      status: "Active",
      leaveBalance: int(8, 18),
      commissionRate: 0,
      avatarColor: at(AVATAR_COLORS, i % AVATAR_COLORS.length),
    });
  });

  for (let i = 0; i < 25; i++) {
    const first = at(FIRST, i % FIRST.length);
    const last = pick(LAST);
    const team = at(TEAMS, i % TEAMS.length);
    const leader = staff.find((s) => s.team === team)!.name;
    employees.push({
      id: `emp-${String(employees.length + 1).padStart(3, "0")}`,
      employeeId: `BPO-${2000 + i}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@apexbpo.co.uk`,
      mobile: `+44 7${int(100000000, 899999999)}`,
      team,
      manager: leader,
      role: "agent",
      joiningDate: iso(addDays(TODAY, -int(30, 900))),
      shift: i % 5 === 0 ? "Night" : i % 3 === 0 ? "Afternoon" : "Morning",
      status: i === 23 ? "Inactive" : "Active",
      leaveBalance: int(2, 16),
      commissionRate: 2.5,
      avatarColor: at(AVATAR_COLORS, i % AVATAR_COLORS.length),
    });
  }

  return employees;
}

const DAYS_BACK = 60;

export function seedAttendance(employees: Employee[]): AttendanceRecord[] {
  const rows: AttendanceRecord[] = [];
  for (let d = DAYS_BACK; d >= 0; d--) {
    const date = addDays(TODAY, -d);
    const isWeekend = date.getDay() === 0;
    for (const e of employees) {
      if (e.status === "Inactive") continue;
      let status: AttendanceStatus = "Present";
      const roll = rng();
      if (isWeekend) status = "Leave";
      else if (roll > 0.94) status = "Absent";
      else if (roll > 0.87) status = "Leave";
      else if (roll > 0.72) status = "Late";

      const base = e.shift === "Morning" ? 9 : e.shift === "Afternoon" ? 14 : 21;
      const lateMinutes = status === "Late" ? int(6, 45) : 0;
      const present = status === "Present" || status === "Late";
      const checkInDate = new Date(date);
      checkInDate.setHours(base, lateMinutes, 0, 0);
      const workingHours = present ? 8 + rng() * 1.5 - 0.4 : 0;
      const checkOut = new Date(checkInDate.getTime() + workingHours * 3600 * 1000);

      rows.push({
        id: `att-${e.id}-${iso(date)}`,
        employeeId: e.id,
        date: iso(date),
        checkIn: present ? hhmm(checkInDate) : null,
        checkOut: present && d > 0 ? hhmm(checkOut) : null,
        workingHours: present ? Number(workingHours.toFixed(2)) : 0,
        breakMinutes: present ? int(30, 75) : 0,
        overtimeHours: present ? Number(Math.max(0, workingHours - 8.5).toFixed(2)) : 0,
        lateMinutes,
        status,
      });
    }
  }
  return rows;
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Campaign a given agent primarily dials on, plus an occasional secondary. */
export function campaignsForAgent(index: number): string[] {
  const primary = at(CAMPAIGNS, index % CAMPAIGNS.length);
  const secondary = at(CAMPAIGNS, (index + 2) % CAMPAIGNS.length);
  return index % 3 === 0 ? [primary, secondary] : [primary];
}

/** Relative health of each campaign, so comparisons are meaningful. */
const CAMPAIGN_FACTOR: Record<string, number> = {
  "Solar UK": 1.15,
  "Medicare US": 1.0,
  "Web Design AU": 0.82,
  "Insurance CA": 0.93,
  "SEO Retainer": 0.72,
};

function hourlyDials(total: number, connectBase: number, shiftStart: number) {
  const out = [];
  const hours = 9;
  let left = total;
  for (let h = 0; h < hours; h++) {
    const hour = shiftStart + h;
    const share = h === hours - 1 ? 1 : (0.16 - h * 0.006) * (0.85 + rng() * 0.3);
    const dials = h === hours - 1 ? Math.max(0, left) : Math.min(left, Math.round(total * share));
    left -= dials;
    // connect rates decay through the afternoon, no-answer climbs after 15:00
    const afternoonPenalty = hour >= 15 ? (hour - 14) * 0.05 : 0;
    const cr = Math.max(0.15, connectBase - afternoonPenalty + (rng() - 0.5) * 0.05);
    const connects = Math.round(dials * cr);
    out.push({
      hour,
      dials,
      connects,
      noAnswer: Math.max(0, Math.round((dials - connects) * (0.55 + afternoonPenalty))),
    });
  }
  return out;
}

export function seedPerformance(employees: Employee[], attendance: AttendanceRecord[]): PerformanceRecord[] {
  const byKey = new Map(attendance.map((a) => [`${a.employeeId}|${a.date}`, a]));
  const rows: PerformanceRecord[] = [];
  const agents = employees.filter((e) => e.role === "agent" && e.status === "Active");

  for (let d = DAYS_BACK; d >= 0; d--) {
    const date = iso(addDays(TODAY, -d));
    const weeksAgo = Math.floor(d / 7);
    agents.forEach((a, ai) => {
      const att = byKey.get(`${a.id}|${date}`);
      if (!att || att.workingHours === 0) return;
      const skill = 0.6 + (Number(a.employeeId.slice(-2)) % 10) / 20;
      // a few agents are on a sustained multi-week slide, others are recovering
      const declining = ai % 7 === 3;
      const recovering = ai % 7 === 5;
      const streak = declining
        ? 1 - Math.max(0, 4 - weeksAgo) * 0.12
        : recovering
          ? 0.72 + Math.max(0, 4 - weeksAgo) * 0.08
          : 1 + (rng() - 0.5) * 0.08;

      const camps = campaignsForAgent(ai);
      camps.forEach((campaign, ci) => {
        const cf = CAMPAIGN_FACTOR[campaign] ?? 1;
        const split = camps.length > 1 ? (ci === 0 ? 0.65 : 0.35) : 1;
        const callsMade = Math.max(1, Math.round((180 + rng() * 160) * skill * streak * split));
        const connectBase = 0.45 + rng() * 0.2;
        const shiftStart = a.shift === "Morning" ? 9 : a.shift === "Afternoon" ? 14 : 21;
        const hourly = hourlyDials(callsMade, connectBase, shiftStart);
        const callsConnected = hourly.reduce((s, h) => s + h.connects, 0);
        const noAnswer = hourly.reduce((s, h) => s + h.noAnswer, 0);
        const unanswered = Math.max(0, callsMade - callsConnected - noAnswer);
        const busy = Math.round(unanswered * 0.5);
        const voicemail = Math.round(unanswered * 0.35);
        const dnc = Math.max(0, unanswered - busy - voicemail);
        const leadsGenerated = Math.round(callsConnected * (0.06 + rng() * 0.08) * cf);
        const sales = Math.max(0, Math.round(leadsGenerated * (0.15 + rng() * 0.3) * cf * streak));
        const avgTalkTimeSec = int(120, 260);
        rows.push({
          id: `perf-${a.id}-${date}-${ci}`,
          employeeId: a.id,
          date,
          campaign,
          callsMade,
          callsConnected,
          leadsGenerated,
          sales,
          revenue: sales * int(8000, 16000),
          avgTalkTimeSec,
          loginHours: Number((att.workingHours * split).toFixed(2)),
          qualityScore: Math.round((70 + rng() * 28) * 10) / 10,
          dialAttempts: callsMade,
          noAnswer,
          busy,
          voicemail,
          dnc,
          talkTimeSec: callsConnected * avgTalkTimeSec,
          hourly,
        });
      });
    });
  }
  return rows;
}

export function seedLeads(employees: Employee[]): Lead[] {
  const agents = employees.filter((e) => e.role === "agent");
  const leads: Lead[] = [];
  for (let i = 0; i < 320; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const agent = pick(agents);
    const status = pick(LEAD_STATUSES) as LeadStatus;
    const created = addDays(TODAY, -int(0, 45));
    const converted = status === "Converted";
    leads.push({
      id: `lead-${String(i + 1).padStart(4, "0")}`,
      customerName: `${first} ${last}`,
      phone: `+44 7${int(100000000, 899999999)}`,
      email: `${first.toLowerCase()}${int(10, 99)}@mail.com`,
      businessName: pick(BIZ),
      campaign: pick(CAMPAIGNS),
      source: pick(SOURCES),
      assignedAgentId: agent.id,
      status,
      notes:
        rng() > 0.5
          ? [
              {
                id: `note-${i}-1`,
                author: agent.name,
                body: pick([
                  "Customer asked to call back after 6 PM.",
                  "Sent pricing over email, awaiting confirmation.",
                  "Decision maker not available, gatekeeper blocked.",
                  "Very interested, wants a demo this week.",
                ]),
                createdAt: iso(created),
              },
            ]
          : [],
      followUpDate:
        status === "Follow-up" || status === "Interested" || status === "Quote Sent"
          ? iso(addDays(TODAY, int(-2, 7)))
          : null,
      saleAmount: converted ? int(8000, 45000) : 0,
      createdAt: iso(created),
      updatedAt: iso(addDays(created, int(0, 3))),
    });
  }
  return leads;
}

export function seedQa(employees: Employee[]): QaScorecard[] {
  const agents = employees.filter((e) => e.role === "agent" && e.status === "Active");
  const reviewers = employees.filter((e) => e.role === "team_leader" || e.role === "manager");
  const rows: QaScorecard[] = [];
  for (let i = 0; i < 90; i++) {
    const a = pick(agents);
    const scores = {
      opening: int(6, 10),
      verification: int(5, 10),
      pitch: int(5, 10),
      objectionHandling: int(4, 10),
      compliance: int(7, 10),
      closing: int(4, 10),
    };
    const overall = Math.round(
      (Object.values(scores).reduce((s, v) => s + v, 0) / 60) * 100,
    );
    rows.push({
      id: `qa-${String(i + 1).padStart(3, "0")}`,
      employeeId: a.id,
      reviewerId: pick(reviewers).id,
      callId: `CALL-${int(100000, 999999)}`,
      date: iso(addDays(TODAY, -int(0, 25))),
      scores,
      overall,
      comments: pick([
        "Good rapport, needs stronger closing.",
        "Compliance statement missed at the start.",
        "Excellent objection handling.",
        "Rushed the pitch, slow down the delivery.",
      ]),
    });
  }
  return rows;
}

export function seedLeave(employees: Employee[]): LeaveRequest[] {
  const agents = employees.filter((e) => e.role !== "admin");
  const rows: LeaveRequest[] = [];
  for (let i = 0; i < 24; i++) {
    const e = pick(agents);
    const from = addDays(TODAY, int(-20, 20));
    const days = int(1, 4);
    rows.push({
      id: `lv-${String(i + 1).padStart(3, "0")}`,
      employeeId: e.id,
      type: pick(["Casual", "Sick", "Earned", "Unpaid"] as LeaveType[]),
      from: iso(from),
      to: iso(addDays(from, days - 1)),
      days,
      reason: pick([
        "Family function",
        "Medical appointment",
        "Personal work",
        "Travel out of city",
      ]),
      status: i < 7 ? "Pending" : pick(["Approved", "Rejected", "Approved"] as LeaveStatus[]),
      appliedAt: iso(addDays(from, -int(2, 8))),
    });
  }
  return rows;
}

export function seedHolidays(): Holiday[] {
  return [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-05-04", name: "Early May bank holiday" },
    { date: "2026-05-25", name: "Spring bank holiday" },
    { date: "2026-08-31", name: "Summer bank holiday" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day (substitute day)" },
  ];
}

export function seedNotifications(): AppNotification[] {
  const now = new Date();
  const mk = (
    id: number,
    kind: AppNotification["kind"],
    title: string,
    body: string,
    severity: AppNotification["severity"],
    minsAgo: number,
  ): AppNotification => ({
    id: `ntf-${id}`,
    kind,
    title,
    body,
    createdAt: new Date(now.getTime() - minsAgo * 60000).toISOString(),
    read: minsAgo > 600,
    severity,
  });
  return [
    mk(1, "alert", "Sales dropped 20% vs yesterday", "Team B accounted for most of the decline.", "critical", 25),
    mk(2, "attendance", "Attendance below 85%", "4 agents have not checked in for the morning shift.", "warning", 60),
    mk(3, "followup", "12 follow-ups due today", "Assigned across Team A and Team C.", "info", 95),
    mk(4, "performance", "Oliver achieved highest conversion", "31.5% conversion rate today.", "success", 150),
    mk(5, "target", "Monthly target at 78%", "Projected to close at 112% at the current pace.", "info", 320),
    mk(6, "birthday", "Birthday reminder", "Amelia Roberts' birthday is tomorrow.", "info", 700),
    mk(7, "performance", "Harry below target 3 days in a row", "Coaching recommended on objection handling.", "warning", 900),
  ];
}

export const INCENTIVE_SLABS: IncentiveSlab[] = [
  { minSales: 5, amount: 1000 },
  { minSales: 10, amount: 3000 },
  { minSales: 15, amount: 5000 },
  { minSales: 20, amount: 7500 },
  { minSales: 30, amount: 12000 },
];
