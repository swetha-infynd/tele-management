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
  return <Badge variant={ATT_VARIANTS[status]}>{status}</Badge>;
}

const LEAVE_VARIANTS: Record<LeaveStatus, Variant> = {
  Pending: "secondary",
  Approved: "default",
  Rejected: "destructive",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge variant={LEAVE_VARIANTS[status]}>{status}</Badge>;
}
