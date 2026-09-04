import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full max-w-32" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-28 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}
