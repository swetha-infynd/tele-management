export const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export const compactGbp = (n: number) => {
  if (n >= 1000000) return `£${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}K`;
  return `£${Math.round(n)}`;
};

export const num = (n: number) => n.toLocaleString("en-GB");

export const pct = (n: number) => `${n.toFixed(1)}%`;

export const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export const longDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const timeAgo = (isoString: string) => {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export const talkTime = (sec: number) =>
  `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;

export const roleLabel: Record<string, string> = {
  admin: "Admin",
  BDE: "BDE",
  agent: "Agent",
};

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
