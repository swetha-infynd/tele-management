import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AttendanceStatusBadge } from "@/components/status-badges";
import { api, ApiError } from "@/lib/mock/api";
import { useSession } from "@/lib/session";

export function CheckInWidget() {
  const { session } = useSession();
  const qc = useQueryClient();

  const { data: record } = useQuery({
    queryKey: ["my-attendance", session.employeeId],
    queryFn: () => api.getMyAttendanceToday(session.employeeId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-attendance"] });
    qc.invalidateQueries({ queryKey: ["attendance-today"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : "Something went wrong");

  const checkIn = useMutation({
    mutationFn: () => api.checkIn(session.employeeId),
    onSuccess: (r) => {
      toast.success(`Checked in at ${r.checkIn}`, {
        description: r.status === "Late" ? "Marked as late login." : "Have a great shift.",
      });
      invalidate();
    },
    onError,
  });

  const checkOut = useMutation({
    mutationFn: () => api.checkOut(session.employeeId),
    onSuccess: (r) => {
      toast.success(`Checked out at ${r.checkOut}`, {
        description: `Total working hours: ${r.workingHours}h`,
      });
      invalidate();
    },
    onError,
  });

  return (
    <Card className="group relative overflow-hidden bg-gradient-to-r from-primary/5 via-card to-card border border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 hover:shadow-md">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-gray-700 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
          <Timer className="size-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Shift attendance</p>
            
          </div>
          <p className="text-xs text-muted-foreground">
            {record?.checkIn
              ? `Checked in at ${record.checkIn}${record.checkOut ? ` • Checked out at ${record.checkOut}` : " • Currently on shift"}`
              : "You have not checked in today."}
          </p>
        </div>
        {record?.status && <AttendanceStatusBadge status={record.status} />}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-500 hover:text-gray-600 hover:bg-transparent"
            disabled={!!record?.checkIn || checkIn.isPending}
            onClick={() => checkIn.mutate()}
          >
            <LogIn className="mr-2 size-4" />
            {checkIn.isPending ? "Checking in…" : "Check in"}
          </Button>
          <Button
            size="sm"
            className="bg-red-500 text-white hover:bg-red-600"
            disabled={!record?.checkIn || !!record?.checkOut || checkOut.isPending}
            onClick={() => checkOut.mutate()}
          >
            <LogOut className="mr-2 size-4" />
            {checkOut.isPending ? "Checking out…" : "Check out"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
