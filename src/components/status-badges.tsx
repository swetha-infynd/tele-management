import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus, LeadStatus, LeaveStatus } from "@/lib/mock/types";

type Variant = "default" | "secondary" | "destructive" | "outline";

const LEAD_VARIANTS: Record<LeadStatus, Variant> = {
  New: "secondary",
  Contacted: "secondary",
  Interested: "default",
  "Follow-up": "default",
  "Quote Sent": "default",
  Converted: "default",
  "Not Interested": "destructive",
  "No Answer": "outline",
  "Wrong Number": "outline",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={LEAD_VARIANTS[status]} className="whitespace-nowrap">
      {status}
    </Badge>
  );
}

const ATT_VARIANTS: Record<AttendanceStatus, Variant> = {
  Present: "default",
  Late: "secondary",
  Absent: "destructive",
  Leave: "outline",
  "Half Day": "outline",
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  if (status === "Present") {
    return (
      <Badge className="bg-emerald-600 text-white border-transparent hover:bg-emerald-700 font-semibold shadow-xs whitespace-nowrap">
        Present
      </Badge>
    );
  }
  if (status === "Late") {
    return (
      <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30 font-medium whitespace-nowrap">
        Late
      </Badge>
    );
  }
  if (status === "Absent") {
    return (
      <Badge className="bg-rose-600 text-white border-transparent hover:bg-rose-700 font-medium shadow-xs whitespace-nowrap">
        Absent
      </Badge>
    );
  }
  return (
    <Badge variant={ATT_VARIANTS[status]} className="whitespace-nowrap">
      {status}
    </Badge>
  );
}

const LEAVE_VARIANTS: Record<LeaveStatus, Variant> = {
  Pending: "secondary",
  Approved: "default",
  Rejected: "destructive",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge variant={LEAVE_VARIANTS[status]}>{status}</Badge>;
}
