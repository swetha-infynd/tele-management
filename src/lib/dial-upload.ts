/** Frontend-only dial-data upload: parse Infynd-style call CSVs, persist to localStorage. */

export interface DialUploadSummary {
  dialAttempts: number;
  connects: number;
  noAnswer: number;
  busy: number;
  voicemail: number;
  dnc: number;
  talkTimeSec: number;
}

export interface DialUploadHour {
  hour: string;
  dials: number;
  connects: number;
  noAnswer: number;
}

/** Per-agent rollup extracted from the CSV Agent column. */
export interface DialUploadAgent {
  /** Display name (whitespace collapsed). */
  name: string;
  /** Normalised key for matching to employees (lowercase, collapsed). */
  key: string;
  rowCount: number;
  summary: DialUploadSummary;
  hourly: DialUploadHour[];
  /** yyyy-mm-dd → summary for that day (filters against performance date ranges). */
  dates: Record<string, DialUploadSummary>;
  /** Campaign names this agent appeared on in the batch (for context). */
  campaigns: string[];
  /**
   * Indices into the batch `customers` array for every client name this agent
   * dialled. Stored as refs (not names) so per-agent lists stay compact.
   */
  customerRefs?: number[];
  /** Legacy capped name list (only present on batches stored before refs). */
  customers?: string[];
  /** True count of distinct customers this agent reached in the batch. */
  customerCount?: number;
}

export interface DialUploadBatch {
  id: string;
  campaign: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
  summary: DialUploadSummary;
  hourly: DialUploadHour[];
  /** Present on batches parsed with Agent support; older batches may omit it. */
  agents?: DialUploadAgent[];
  /**
   * Raw "Campaign Name" column values found in the CSV (before mapping).
   * Shown as badges under the selected campaign name; older batches may omit it.
   */
  rawCampaignNames?: string[];
  /**
   * Distinct values from the CSV Customer / Customer Name column, with the
   * structured Customer Title / FirstName / Surname columns composed in.
   * This is the "Client" for the batch — the consumers reached, one per call
   * row. Stored in full so the UI can list every name; customerCount always
   * holds the true total.
   */
  customers?: string[];
  /** True count of distinct Customer values in the source CSV. */
  customerCount?: number;
  /**
   * yyyy-mm-dd of upload day. Used when a CSV has no parseable Start Time dates
   * so agent stats still apply within a Performance date window.
   */
  uploadDate?: string;
}

const STORAGE_KEY = "apex-dial-uploads";
const AGENT_REG_KEY = "apex-dial-upload-agents";

/* ------------------------------------------------------------------ CSV */

/** RFC4180-ish line splitter that respects quoted fields (incl. newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else if (c === "\r") {
      /* skip */
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

function headerIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function parseTalkSeconds(raw: string): number {
  const s = (raw ?? "").trim();
  if (!s) return 0;
  const parts = s.split(":").map((p) => Number(p) || 0);
  const [a = 0, b = 0, c = 0] = parts;
  if (parts.length === 3) return a * 3600 + b * 60 + c;
  if (parts.length === 2) return a * 60 + b;
  return Number(s) || 0;
}

/** Start Time like "22/10/2026 11:27" or "19/10/2026 09:26:35" → hour 0–23, or null. */
function parseHour(raw: string): number | null {
  const m = (raw ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

/** "22/10/2026 …", "2026-10-22 …", "22-10-2026 …" or "22.10.2026 …" → yyyy-mm-dd, or null. */
function parseDate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

const SKIP_AGENTS = new Set(["system", "qa", "admin", "zara qa", "test"]);

/**
 * Upper safety bound for distinct client names kept per file. Real exports carry
 * 5k–14k distinct names; this only guards against pathological files. When the
 * bound is hit the true count is still reported via customerCount.
 */
const MAX_CLIENT_NAMES_PER_FILE = 50000;

/** Collapse whitespace + lowercase for customer name matching. */
function normalizeCustomer(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/** CSV/Excel placeholder values that are not real client names. */
const PLACEHOLDER_CLIENTS = new Set([
  "#name?",
  "#value!",
  "#ref!",
  "#n/a",
  "n/a",
  "na",
  "unknown",
  "not available",
  "no name",
  "test",
  "****",
  "-",
  "—",
]);

/**
 * Tidy a raw customer value into a usable client name. Exports sometimes carry
 * spreadsheet artefacts ("#NAME?", "****") or dialler prefixes ("(Opt 2 )",
 * "////") — strip the noise and drop values that contain no letters at all.
 */
function cleanClientName(raw: string): string {
  const name = normalizeCustomer(raw);
  if (!name) return "";
  if (PLACEHOLDER_CLIENTS.has(name.toLowerCase())) return "";
  const cleaned = name
    .replace(/^\(opt\s*\d+\)\s*/i, "")
    .replace(/^[^A-Za-z]+(?=[A-Za-z])/, "")
    .trim();
  if (!/[A-Za-z]/.test(cleaned)) return "";
  return cleaned;
}

/**
 * Build the client (consumer) name for a row. Prefers the structured
 * Customer Title + FirstName + Surname columns (cleaner than the single
 * "Customer" field, which is often just a first name or "Mr/Mrs"), and
 * falls back to the raw Customer / Customer Name value when the split
 * columns are empty or absent.
 */
function composeCustomer(
  row: string[],
  idxTitle: number,
  idxFirst: number,
  idxSurname: number,
  idxCustomer: number,
): string {
  const part = (i: number) => (i >= 0 ? normalizeCustomer(row[i] ?? "") : "");
  const title = part(idxTitle);
  const first = part(idxFirst);
  const surname = part(idxSurname);
  const composed = [title, first, surname].filter(Boolean).join(" ").trim();
  // Only trust the split columns when we actually got a first or surname.
  if (first || surname) return cleanClientName(composed);
  return cleanClientName(part(idxCustomer));
}

/** Collapse whitespace + lowercase for agent name matching. */
export function normalizeAgentName(name: string): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function displayAgentName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

function isRealAgent(raw: string): boolean {
  const n = normalizeAgentName(raw);
  return n.length > 0 && n.length < 80 && !SKIP_AGENTS.has(n);
}

function classifyDisposition(d: string): keyof DialUploadSummary | null {
  const s = d.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("no answer") || s.includes("no-answer")) return "noAnswer";
  if (s.includes("answer phone") || s.includes("voicemail") || s.includes("voice mail"))
    return "voicemail";
  if (s.includes("busy") || s.includes("engaged")) return "busy";
  if (s.includes("do not call") || s.includes("dnc") || s.includes("invalid number")) return "dnc";
  if (s.includes("hungup") || s.includes("hung up") || s.includes("gatekeeper")) return "busy";
  return null;
}

export interface ParsedDialFile {
  rowCount: number;
  summary: DialUploadSummary;
  hourly: DialUploadHour[];
  agents: DialUploadAgent[];
  /** CRM campaign name auto-detected from the CSV Campaign Name column, if matched. */
  detectedCampaign: string | undefined;
  /** Raw CSV campaign name values found in the file (before mapping). */
  rawCampaignNames: string[];
  /** Whether this is a "Successful Call List" file (as opposed to a "Call Details" file). */
  isSuccessList: boolean;
  /** Distinct client (customer) names composed from the CSV customer columns. */
  customers: string[];
  /** True count of distinct Customer values in the file. */
  customerCount: number;
}

/**
 * Mapping from raw CSV `Campaign Name` values (lowercase) → canonical CRM campaign names.
 * Add new entries here whenever a new campaign is onboarded.
 *
 * Each key is a lowercase substring match — if the raw campaign name contains the key
 * the corresponding CRM campaign is selected. More specific patterns should come first.
 */
export const CSV_CAMPAIGN_MAP: Array<{ pattern: RegExp; campaign: string }> = [
  // BEC
  { pattern: /\bbec\b/i, campaign: "BEC" },
  // Cream Life Insurance / CREAM PMI
  { pattern: /cream/i, campaign: "Cream Life Insurance" },
  // EDF / My Utility
  { pattern: /edf/i, campaign: "EDF" },
  { pattern: /my utility/i, campaign: "EDF" },
  // Scottish Power / Bill Compare
  { pattern: /scottish power/i, campaign: "Scottish Power" },
  { pattern: /bill compare/i, campaign: "Scottish Power" },
  // Staycovered / National Friendly
  { pattern: /staycovered/i, campaign: "Staycovered Over 50s" },
  { pattern: /national friendly/i, campaign: "Staycovered Over 50s" },
];

/**
 * Given a set of raw CSV Campaign Name values found in a file, return the best-matching
 * CRM campaign name, or undefined if no pattern matches.
 */
export function detectCampaignFromRawNames(rawNames: Iterable<string>): string | undefined {
  for (const raw of rawNames) {
    for (const { pattern, campaign } of CSV_CAMPAIGN_MAP) {
      if (pattern.test(raw)) return campaign;
    }
  }
  return undefined;
}

/**
 * Parses Infynd "Call Details" CSVs (and Successful Call List variants).
 * Detects columns from the header row.
 */
export function parseDialCsv(text: string): ParsedDialFile {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("File is empty or missing a header row.");

  const headers = rows[0] ?? [];
  const idxStart = headerIndex(headers, "Start Time", "start time", "date");
  const idxTalk = headerIndex(headers, "Talk Time", "talk time");
  const idxDisp = headerIndex(headers, "Call Disposition", "Call Result", "disposition", "result");
  const idxDuration = headerIndex(headers, "Duration", "duration");
  const idxAgent = headerIndex(headers, "Agent", "Agent First Name", "agent name", "user");
  const idxCampaign = headerIndex(headers, "Campaign Name", "Campaign", "campaign");
  // "Client" source of truth: the consumer named on each call row.
  // Prefer the structured Title/FirstName/Surname columns; fall back to the
  // single "Customer"/"Customer Name" column when the split fields are absent.
  const idxCustomer = headerIndex(
    headers,
    "Customer",
    "Customer Name",
    "customer name",
    "customer",
  );
  const idxTitle = headerIndex(headers, "Customer Title", "customer title", "title");
  const idxFirst = headerIndex(
    headers,
    "Customer FirstName",
    "Customer First Name",
    "customer firstname",
    "customer first name",
    "firstname",
    "first name",
  );
  const idxSurname = headerIndex(
    headers,
    "Customer Surname",
    "Customer Last Name",
    "customer surname",
    "customer last name",
    "surname",
    "last name",
  );

  if (idxStart < 0 && idxDisp < 0 && idxTalk < 0) {
    throw new Error(
      'Unrecognised CSV. Expected columns like "Start Time", "Talk Time" or "Call Disposition".',
    );
  }

  const summary: DialUploadSummary = {
    dialAttempts: 0,
    connects: 0,
    noAnswer: 0,
    busy: 0,
    voicemail: 0,
    dnc: 0,
    talkTimeSec: 0,
  };
  const hourMap = new Map<number, { dials: number; connects: number; noAnswer: number }>();
  const agentMap = new Map<
    string,
    {
      name: string;
      rowCount: number;
      summary: DialUploadSummary;
      hourly: Map<number, { dials: number; connects: number; noAnswer: number }>;
      dates: Map<string, DialUploadSummary>;
      campaigns: Set<string>;
      /** Indices into the file-level `customerNames` list. */
      customerRefs: Set<number>;
    }
  >();
  const rawCampaignSet = new Set<string>();
  /**
   * Distinct consumers reached in this file — the "Client" for each row.
   * Names are de-duplicated and kept in first-seen order; agents reference
   * them by index so the stored payload stays small.
   */
  const customerNames: string[] = [];
  const customerIndex = new Map<string, number>();
  const overflowNames = new Set<string>();
  let dataRows = 0;
  // Detect file type once from the header row.
  const fileIsSuccessList =
    idxDisp >= 0 && (headers[idxDisp] ?? "").toLowerCase().includes("call result");

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !c.trim())) continue;
    dataRows++;

    const disp = idxDisp >= 0 ? (row[idxDisp] ?? "") : "";
    const talk = idxTalk >= 0 ? parseTalkSeconds(row[idxTalk] ?? "") : 0;
    const duration = idxDuration >= 0 ? Number(row[idxDuration]) || 0 : 0;
    const rawStart = idxStart >= 0 ? (row[idxStart] ?? "") : "";
    const hour = parseHour(rawStart);
    const day = parseDate(rawStart);
    const rawAgent = idxAgent >= 0 ? (row[idxAgent] ?? "") : "";
    // Consumer this call was dialled to — the "Client" for the record.
    const customer = composeCustomer(row, idxTitle, idxFirst, idxSurname, idxCustomer);

    // Register the client name once per file; agents reference it by index.
    let customerRef = -1;
    if (customer) {
      const existing = customerIndex.get(customer);
      if (existing !== undefined) {
        customerRef = existing;
      } else if (customerNames.length < MAX_CLIENT_NAMES_PER_FILE) {
        customerRef = customerNames.length;
        customerNames.push(customer);
        customerIndex.set(customer, customerRef);
      } else if (!overflowNames.has(customer)) {
        // Pathological file beyond the safety bound — still count the name.
        overflowNames.add(customer);
      }
    }

    // Connected if there was talk time, a positive duration with a human disposition,
    // or the disposition is not a known non-connect outcome.
    const bucket = classifyDisposition(disp);
    const hasTalk = talk > 0;
    const isSuccessList = fileIsSuccessList;
    const connected = isSuccessList || hasTalk || (duration > 0 && !bucket && disp.trim() !== "");

    summary.dialAttempts++;
    summary.talkTimeSec += talk;

    let outcome: "connect" | "noAnswer" | "voicemail" | "busy" | "dnc";
    if (connected) {
      summary.connects++;
      outcome = "connect";
    } else if (bucket === "noAnswer") {
      summary.noAnswer++;
      outcome = "noAnswer";
    } else if (bucket === "voicemail") {
      summary.voicemail++;
      outcome = "voicemail";
    } else if (bucket === "busy") {
      summary.busy++;
      outcome = "busy";
    } else if (bucket === "dnc") {
      summary.dnc++;
      outcome = "dnc";
    } else {
      summary.noAnswer++; // blank disposition without talk → treat as no-answer
      outcome = "noAnswer";
    }

    if (hour !== null) {
      const cur = hourMap.get(hour) ?? { dials: 0, connects: 0, noAnswer: 0 };
      cur.dials++;
      if (connected) cur.connects++;
      else if (!bucket || bucket === "noAnswer") cur.noAnswer++;
      hourMap.set(hour, cur);
    }

    // Per-agent rollup (skip System/QA service accounts).
    if (isRealAgent(rawAgent)) {
      const key = normalizeAgentName(rawAgent);
      let ag = agentMap.get(key);
      if (!ag) {
        ag = {
          name: displayAgentName(rawAgent),
          rowCount: 0,
          summary: {
            dialAttempts: 0,
            connects: 0,
            noAnswer: 0,
            busy: 0,
            voicemail: 0,
            dnc: 0,
            talkTimeSec: 0,
          },
          hourly: new Map(),
          dates: new Map(),
          campaigns: new Set(),
          customerRefs: new Set(),
        };
        agentMap.set(key, ag);
      }
      ag.rowCount++;
      ag.summary.dialAttempts++;
      ag.summary.talkTimeSec += talk;
      if (customerRef >= 0) ag.customerRefs.add(customerRef);
      if (outcome === "connect") ag.summary.connects++;
      else if (outcome === "noAnswer") ag.summary.noAnswer++;
      else if (outcome === "voicemail") ag.summary.voicemail++;
      else if (outcome === "busy") ag.summary.busy++;
      else if (outcome === "dnc") ag.summary.dnc++;

      if (hour !== null) {
        const hcur = ag.hourly.get(hour) ?? { dials: 0, connects: 0, noAnswer: 0 };
        hcur.dials++;
        if (connected) hcur.connects++;
        else if (!bucket || bucket === "noAnswer") hcur.noAnswer++;
        ag.hourly.set(hour, hcur);
      }
      if (day) {
        const dcur =
          ag.dates.get(day) ??
          ({
            dialAttempts: 0,
            connects: 0,
            noAnswer: 0,
            busy: 0,
            voicemail: 0,
            dnc: 0,
            talkTimeSec: 0,
          } satisfies DialUploadSummary);
        dcur.dialAttempts++;
        dcur.talkTimeSec += talk;
        if (outcome === "connect") dcur.connects++;
        else if (outcome === "noAnswer") dcur.noAnswer++;
        else if (outcome === "voicemail") dcur.voicemail++;
        else if (outcome === "busy") dcur.busy++;
        else if (outcome === "dnc") dcur.dnc++;
        ag.dates.set(day, dcur);
      }
      const camp = idxCampaign >= 0 ? displayAgentName(row[idxCampaign] ?? "") : "";
      if (camp) ag.campaigns.add(camp);
    }

    // Collect raw campaign names for auto-detection (regardless of agent filtering).
    if (idxCampaign >= 0) {
      const rawCamp = (row[idxCampaign] ?? "").trim();
      if (rawCamp) rawCampaignSet.add(rawCamp);
    }
  }

  if (dataRows === 0) throw new Error("No data rows found in the CSV.");

  const hourly = [...hourMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      dials: v.dials,
      connects: v.connects,
      noAnswer: v.noAnswer,
    }))
    .filter((h) => h.dials > 0);

  const agents: DialUploadAgent[] = [...agentMap.entries()]
    .sort((a, b) => b[1].summary.dialAttempts - a[1].summary.dialAttempts)
    .map(([key, a]) => ({
      name: a.name,
      key,
      rowCount: a.rowCount,
      summary: a.summary,
      hourly: [...a.hourly.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([h, v]) => ({
          hour: `${String(h).padStart(2, "0")}:00`,
          dials: v.dials,
          connects: v.connects,
          noAnswer: v.noAnswer,
        })),
      dates: Object.fromEntries(a.dates),
      campaigns: [...a.campaigns],
      customerRefs: [...a.customerRefs].sort((x, y) => x - y),
      customerCount: a.customerRefs.size,
    }));

  const rawCampaignNames = [...rawCampaignSet];
  const detectedCampaign = detectCampaignFromRawNames(rawCampaignNames);

  return {
    rowCount: dataRows,
    summary,
    hourly,
    agents,
    detectedCampaign,
    rawCampaignNames,
    isSuccessList: fileIsSuccessList,
    customers: customerNames,
    customerCount: customerNames.length + overflowNames.size,
  };
}

/* --------------------------------------------------------- persistence */

export function loadDialUploads(): DialUploadBatch[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DialUploadBatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDialUploads(batches: DialUploadBatch[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
    return;
  } catch {
    /* Quota exceeded — client name lists are by far the largest payload. */
  }
  // Keep the newest two batches intact, trim names on older ones so the rest of
  // the stats survive a full storage quota.
  const slim = batches.map((b, i) => {
    if (i < 2) return b;
    return {
      ...b,
      customers: b.customers?.slice(0, 100),
      agents: b.agents?.map((a) => ({
        ...a,
        customerRefs: a.customerRefs?.filter((r) => r < 100),
        customers: a.customers?.slice(0, 50),
      })),
    };
  });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    /* Give up on persistence rather than crash the upload flow. */
  }
}

export function addDialUpload(batch: DialUploadBatch): DialUploadBatch[] {
  const next = [batch, ...loadDialUploads()].slice(0, 50);
  saveDialUploads(next);
  registerUploadAgents(batch.agents, batch.campaign);
  return next;
}

export function removeDialUpload(id: string): DialUploadBatch[] {
  const next = loadDialUploads().filter((b) => b.id !== id);
  saveDialUploads(next);
  return next;
}

export function clearDialUploads(): DialUploadBatch[] {
  saveDialUploads([]);
  return [];
}

export function newUploadId(): string {
  return `dial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ----------------------------------------------------- client name lists */

/**
 * A resolved set of client (customer) names, extracted from the customer columns
 * of uploaded dial data: Customer / Customer Name, or the structured
 * Customer Title + Customer FirstName + Customer Surname columns.
 */
export interface ClientNameList {
  /** Distinct names, alphabetically sorted. */
  names: string[];
  /**
   * True distinct total reported by the upload. Can exceed names.length for
   * batches stored before full names were captured.
   */
  total: number;
}

export const EMPTY_CLIENT_NAMES: ClientNameList = { names: [], total: 0 };

/** Resolve every client name an agent dialled in one stored batch. */
function namesForAgentInBatch(batch: DialUploadBatch, agent: DialUploadAgent): string[] {
  if (agent.customerRefs?.length) {
    return agent.customerRefs
      .map((i) => batch.customers?.[i])
      .filter((n): n is string => typeof n === "string" && n.length > 0);
  }
  // Legacy batches stored a capped name list directly on the agent.
  return agent.customers ?? [];
}

/** Lookups for the client names found in the uploaded dial data. */
export interface ClientNameIndex {
  /** Client names for a campaign (all uploads for that campaign). */
  campaign(campaign: string): ClientNameList;
  /** Client names an agent dialled, optionally narrowed to one campaign. */
  agent(agentName: string, campaign?: string): ClientNameList;
}

/**
 * Build an index of client names from stored upload batches. Both campaign and
 * per-agent lists are de-duplicated across batches and sorted once, lazily.
 */
export function buildClientNameIndex(batches: DialUploadBatch[]): ClientNameIndex {
  const campaignSets = new Map<string, Set<string>>();
  const campaignHints = new Map<string, number>();
  const agentSets = new Map<string, Set<string>>();
  const agentHints = new Map<string, number>();
  const agentCampaignSets = new Map<string, Set<string>>();
  const agentCampaignHints = new Map<string, number>();
  const listCache = new Map<string, ClientNameList>();

  const addTo = (map: Map<string, Set<string>>, key: string, names: string[]) => {
    let set = map.get(key);
    if (!set) {
      set = new Set<string>();
      map.set(key, set);
    }
    for (const n of names) if (n) set.add(n);
  };
  const hintFor = (map: Map<string, number>, key: string, hint: number) => {
    if (hint > (map.get(key) ?? 0)) map.set(key, hint);
  };

  for (const b of batches) {
    const batchNames = b.customers ?? [];
    addTo(campaignSets, b.campaign, batchNames);
    hintFor(campaignHints, b.campaign, b.customerCount ?? batchNames.length);

    for (const a of b.agents ?? []) {
      const names = namesForAgentInBatch(b, a);
      if (names.length === 0) continue;
      const hint = a.customerCount ?? names.length;
      addTo(agentSets, a.key, names);
      hintFor(agentHints, a.key, hint);
      const campKey = `${b.campaign}\u0000${a.key}`;
      addTo(agentCampaignSets, campKey, names);
      hintFor(agentCampaignHints, campKey, hint);
    }
  }

  const toList = (cacheKey: string, set: Set<string> | undefined, hint: number): ClientNameList => {
    const cached = listCache.get(cacheKey);
    if (cached) return cached;
    const names = [...(set ?? [])].sort((x, y) => x.localeCompare(y));
    const list: ClientNameList = { names, total: Math.max(names.length, hint) };
    listCache.set(cacheKey, list);
    return list;
  };

  return {
    campaign(campaign) {
      return toList(`c:${campaign}`, campaignSets.get(campaign), campaignHints.get(campaign) ?? 0);
    },
    agent(agentName, campaign) {
      const key = normalizeAgentName(agentName);
      if (!key) return EMPTY_CLIENT_NAMES;
      if (campaign) {
        const campKey = `${campaign}\u0000${key}`;
        return toList(
          `ac:${campKey}`,
          agentCampaignSets.get(campKey),
          agentCampaignHints.get(campKey) ?? 0,
        );
      }
      return toList(`a:${key}`, agentSets.get(key), agentHints.get(key) ?? 0);
    },
  };
}

/** Client names from all currently stored uploads (convenience for non-React code). */
export function loadClientNameIndex(): ClientNameIndex {
  return buildClientNameIndex(loadDialUploads());
}

/** Compact one-line rendering of a client list for exports and tooltips. */
export function clientNamesText(list: ClientNameList, limit = 3): string {
  if (list.total <= 0) return "—";
  const shown = list.names.slice(0, limit);
  if (shown.length === 0) return `${list.total} clients (names not stored)`;
  const extra = list.total - shown.length;
  return extra > 0 ? `${shown.join("; ")}; +${extra} more` : shown.join("; ");
}

/* --------------------------------------------------- agent auto-register */

/** Agent seen in an upload CSV (not yet necessarily an Employee). */
export interface DiscoveredAgent {
  key: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  campaigns: string[];
}

export function loadDiscoveredAgents(): DiscoveredAgent[] {
  try {
    const raw = window.localStorage.getItem(AGENT_REG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiscoveredAgent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDiscoveredAgents(list: DiscoveredAgent[]): void {
  window.localStorage.setItem(AGENT_REG_KEY, JSON.stringify(list.slice(0, 500)));
}

/**
 * Record every real agent name from a parsed file so the mock DB can
 * auto-create missing Employees the next time it is read.
 * Safe to call repeatedly — merges by normalised name.
 */
export function registerUploadAgents(
  agents: DialUploadAgent[] | undefined,
  campaign?: string,
): DiscoveredAgent[] {
  const list = loadDiscoveredAgents();
  if (!agents?.length) return list;
  const map = new Map(list.map((a) => [a.key, a]));
  const now = new Date().toISOString();
  for (const a of agents) {
    const cur = map.get(a.key);
    if (cur) {
      cur.lastSeen = now;
      cur.name = a.name;
      if (campaign && !cur.campaigns.includes(campaign)) cur.campaigns.push(campaign);
    } else {
      map.set(a.key, {
        key: a.key,
        name: a.name,
        firstSeen: now,
        lastSeen: now,
        campaigns: campaign ? [campaign] : [...a.campaigns],
      });
    }
  }
  const next = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  saveDiscoveredAgents(next);
  return next;
}

/** Backfill the agent registry from batches uploaded before auto-register existed. */
export function hydrateDiscoveredAgentsFromUploads(): void {
  for (const b of loadDialUploads()) {
    if (b.agents?.length) registerUploadAgents(b.agents, b.campaign);
  }
}

/** Merge stored upload batches into a per-campaign map of aggregated stats. */
export function aggregateUploadsByCampaign(batches: DialUploadBatch[]): Map<
  string,
  {
    summary: DialUploadSummary;
    hourly: Map<string, DialUploadHour>;
    batchCount: number;
    rowCount: number;
  }
> {
  const map = new Map<
    string,
    {
      summary: DialUploadSummary;
      hourly: Map<string, DialUploadHour>;
      batchCount: number;
      rowCount: number;
    }
  >();

  for (const b of batches) {
    let entry = map.get(b.campaign);
    if (!entry) {
      entry = {
        summary: {
          dialAttempts: 0,
          connects: 0,
          noAnswer: 0,
          busy: 0,
          voicemail: 0,
          dnc: 0,
          talkTimeSec: 0,
        },
        hourly: new Map(),
        batchCount: 0,
        rowCount: 0,
      };
      map.set(b.campaign, entry);
    }
    entry.batchCount++;
    entry.rowCount += b.rowCount;
    const s = entry.summary;
    s.dialAttempts += b.summary.dialAttempts;
    s.connects += b.summary.connects;
    s.noAnswer += b.summary.noAnswer;
    s.busy += b.summary.busy;
    s.voicemail += b.summary.voicemail;
    s.dnc += b.summary.dnc;
    s.talkTimeSec += b.summary.talkTimeSec;

    for (const h of b.hourly) {
      const cur = entry.hourly.get(h.hour) ?? {
        hour: h.hour,
        dials: 0,
        connects: 0,
        noAnswer: 0,
      };
      cur.dials += h.dials;
      cur.connects += h.connects;
      cur.noAnswer += h.noAnswer;
      entry.hourly.set(h.hour, cur);
    }
  }
  return map;
}

const emptySummary = (): DialUploadSummary => ({
  dialAttempts: 0,
  connects: 0,
  noAnswer: 0,
  busy: 0,
  voicemail: 0,
  dnc: 0,
  talkTimeSec: 0,
});

/** Aggregate stored batches for one campaign (or all when campaign is omitted). */
export function uploadTotalsForCampaign(campaign?: string): {
  summary: DialUploadSummary;
  hourly: DialUploadHour[];
  batchCount: number;
  rowCount: number;
  /** Distinct consumers reached (summed across batches — the "Client" per record). */
  customerCount: number;
} {
  const batches = loadDialUploads().filter((b) => !campaign || b.campaign === campaign);
  const summary = emptySummary();
  const hourMap = new Map<string, DialUploadHour>();
  let batchCount = 0;
  let rowCount = 0;
  let customerCount = 0;
  for (const b of batches) {
    batchCount++;
    rowCount += b.rowCount;
    customerCount += b.customerCount ?? b.customers?.length ?? 0;
    summary.dialAttempts += b.summary.dialAttempts;
    summary.connects += b.summary.connects;
    summary.noAnswer += b.summary.noAnswer;
    summary.busy += b.summary.busy;
    summary.voicemail += b.summary.voicemail;
    summary.dnc += b.summary.dnc;
    summary.talkTimeSec += b.summary.talkTimeSec;
    for (const h of b.hourly) {
      const cur = hourMap.get(h.hour) ?? { hour: h.hour, dials: 0, connects: 0, noAnswer: 0 };
      cur.dials += h.dials;
      cur.connects += h.connects;
      cur.noAnswer += h.noAnswer;
      hourMap.set(h.hour, cur);
    }
  }
  return {
    summary,
    hourly: [...hourMap.values()].sort((a, b) => a.hour.localeCompare(b.hour)),
    batchCount,
    rowCount,
    customerCount,
  };
}

export interface UploadAgentStat {
  key: string;
  name: string;
  summary: DialUploadSummary;
  /** Campaign names (upload batch target + raw CSV campaign column). */
  campaigns: string[];
  batchCount: number;
}

/**
 * Per-agent dial stats from stored uploads, filtered by campaign and/or date range.
 * Keys are `normalizeAgentName` results so they can match Employee names.
 */
export function uploadAgentStats(
  params: {
    campaign?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  } = {},
): Map<string, UploadAgentStat> {
  const batches = loadDialUploads().filter(
    (b) => !params.campaign || params.campaign === "all" || b.campaign === params.campaign,
  );
  const map = new Map<string, UploadAgentStat>();

  for (const b of batches) {
    // Fallback day when the CSV has no Start Time dates (still show on Performance).
    const fallbackDay = b.uploadDate ?? (b.uploadedAt ? b.uploadedAt.slice(0, 10) : undefined);

    for (const a of b.agents ?? []) {
      let cur = map.get(a.key);
      if (!cur) {
        cur = {
          key: a.key,
          name: a.name,
          summary: emptySummary(),
          campaigns: [],
          batchCount: 0,
        };
        map.set(a.key, cur);
      }
      cur.batchCount++;

      const dates = Object.keys(a.dates).sort();
      const inRange = (d: string) =>
        (!params.from || d >= params.from) && (!params.to || d <= params.to);

      if (dates.length > 0) {
        for (const [d, ds] of Object.entries(a.dates)) {
          if (!inRange(d)) continue;
          cur.summary.dialAttempts += ds.dialAttempts;
          cur.summary.connects += ds.connects;
          cur.summary.noAnswer += ds.noAnswer;
          cur.summary.busy += ds.busy;
          cur.summary.voicemail += ds.voicemail;
          cur.summary.dnc += ds.dnc;
          cur.summary.talkTimeSec += ds.talkTimeSec;
        }
      } else if (!fallbackDay || inRange(fallbackDay)) {
        // No per-day rows in the file — apply whole-file agent totals for the window.
        cur.summary.dialAttempts += a.summary.dialAttempts;
        cur.summary.connects += a.summary.connects;
        cur.summary.noAnswer += a.summary.noAnswer;
        cur.summary.busy += a.summary.busy;
        cur.summary.voicemail += a.summary.voicemail;
        cur.summary.dnc += a.summary.dnc;
        cur.summary.talkTimeSec += a.summary.talkTimeSec;
      }

      for (const c of [b.campaign, ...a.campaigns]) {
        if (c && !cur.campaigns.includes(c)) cur.campaigns.push(c);
      }
    }
  }

  for (const s of map.values()) {
    if (s.summary.dialAttempts === 0) map.delete(s.key);
  }
  return map;
}

type DiallerLike = {
  dialAttempts: number;
  connects: number;
  connectRate: number;
  noAnswerRate: number;
  busyRate: number;
  voicemailRate: number;
  dncRate: number;
  avgTalkTimeSec: number;
  hourly: Array<{ hour: string; dials: number; connects: number; noAnswer: number }>;
  bestHour: string;
  worstHour: string;
};

const pctOf = (part: number, whole: number) =>
  whole ? Number(((part / whole) * 100).toFixed(1)) : 0;

/**
 * Merge uploaded call-detail stats into a DiallerAnalysis-shaped result.
 * Pass `campaign` for a single campaign, or undefined for floor-wide totals.
 */
export function mergeUploadsIntoDialler<T extends DiallerLike>(
  base: T,
  campaign?: string,
): T & { fromUpload: boolean; uploadBatches: number } {
  const up = uploadTotalsForCampaign(campaign);

  const baseDials = base.dialAttempts;
  const baseConnects = base.connects;
  const baseNoAnswer = Math.round((base.noAnswerRate / 100) * baseDials);
  const baseBusy = Math.round((base.busyRate / 100) * baseDials);
  const baseVoicemail = Math.round((base.voicemailRate / 100) * baseDials);
  const baseDnc = Math.round((base.dncRate / 100) * baseDials);
  const baseTalk = base.avgTalkTimeSec * baseConnects;

  const s = up.summary;
  const dials = baseDials + s.dialAttempts;
  const connects = baseConnects + s.connects;
  const talkSec = baseTalk + s.talkTimeSec;

  const hourMap = new Map<string, { dials: number; connects: number; noAnswer: number }>();
  for (const h of base.hourly) hourMap.set(h.hour, { ...h });
  for (const h of up.hourly) {
    const cur = hourMap.get(h.hour) ?? { dials: 0, connects: 0, noAnswer: 0 };
    cur.dials += h.dials;
    cur.connects += h.connects;
    cur.noAnswer += h.noAnswer;
    hourMap.set(h.hour, cur);
  }
  const hourly = [...hourMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, v]) => ({
      hour,
      dials: v.dials,
      connects: v.connects,
      noAnswer: v.noAnswer,
      connectRate: pctOf(v.connects, v.dials),
      noAnswerRate: pctOf(v.noAnswer, v.dials),
    }))
    .filter((h) => h.dials > 0);

  const ranked = [...hourly].sort((a, b) => b.connectRate - a.connectRate);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return {
    ...base,
    dialAttempts: dials,
    connects,
    connectRate: pctOf(connects, dials),
    noAnswerRate: pctOf(baseNoAnswer + s.noAnswer, dials),
    busyRate: pctOf(baseBusy + s.busy, dials),
    voicemailRate: pctOf(baseVoicemail + s.voicemail, dials),
    dncRate: pctOf(baseDnc + s.dnc, dials),
    avgTalkTimeSec: connects ? Math.round(talkSec / connects) : 0,
    hourly,
    bestHour: best?.hour ?? base.bestHour,
    worstHour: worst?.hour ?? base.worstHour,
    fromUpload: up.batchCount > 0,
    uploadBatches: up.batchCount,
  };
}

/** Add upload dial/connect totals onto a CampaignSummary-style rollup. */
export function mergeUploadsIntoCampaignRollup<
  T extends {
    campaign: string;
    calls: number;
    connects: number;
    connectRate: number;
    avgTalkTimeSec: number;
  },
>(row: T): T & { fromUpload: boolean } {
  const up = uploadTotalsForCampaign(row.campaign);
  if (up.batchCount === 0) return { ...row, fromUpload: false };
  const s = up.summary;
  const calls = row.calls + s.dialAttempts;
  const connects = row.connects + s.connects;
  const talk = row.avgTalkTimeSec * row.connects + s.talkTimeSec;
  return {
    ...row,
    calls,
    connects,
    connectRate: pctOf(connects, calls),
    avgTalkTimeSec: connects ? Math.round(talk / connects) : 0,
    fromUpload: true,
  };
}

/** Query keys that must refetch after an upload/delete so every page updates. */
export const DIAL_UPLOAD_QUERY_KEYS = [
  "dial-uploads",
  "dialler-analysis-all",
  "dialler-analysis",
  "dialler",
  "campaign-overview",
  "campaigns",
  "campaign-records",
  "campaign-agents",
  "campaign-agents-mine",
  "campaign-perf-mine",
  "dashboard",
  "dashboard-mine",
  "trend",
  "trend-mine",
  "performance",
  "performance-mine",
  "my-daily-perf",
  "leaderboard",
  "leaderboard-mine",
  "leaderboard-floor",
  "employees",
  "employee",
  "reports",
  "hourly-logs",
  "qa",
  "consistency",
  "weekly",
  "incentives",
  "incentives-mine",
  "settings",
  "hourly-campaigns",
  "campaign-day-bars",
] as const;
