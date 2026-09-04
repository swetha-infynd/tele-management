import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Simulated export. Builds a real CSV client-side for CSV/Excel and
 * simulates a rendering job for PDF, so the flow behaves like production.
 */
export function ExportMenu({
  filename,
  columns,
  rows,
  disabled,
}: {
  filename: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  disabled?: boolean;
}) {
  const download = (content: string, ext: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toCsv = () =>
    [columns, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

  const run = (kind: "csv" | "excel" | "pdf") => {
    if (!rows.length) {
      toast.error("Nothing to export", { description: "Adjust your filters and try again." });
      return;
    }
    const job = new Promise<void>((resolve) =>
      setTimeout(() => {
        if (kind === "csv") download(toCsv(), "csv", "text/csv");
        if (kind === "excel") download(toCsv(), "xls", "application/vnd.ms-excel");
        if (kind === "pdf")
          download(
            `${filename}\n\n${[columns, ...rows].map((r) => r.join(" | ")).join("\n")}`,
            "pdf.txt",
            "text/plain",
          );
        resolve();
      }, 900),
    );
    toast.promise(job, {
      loading: `Generating ${kind.toUpperCase()} export…`,
      success: `${rows.length} rows exported`,
      error: "Export failed",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="mr-2 size-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export {rows.length} rows</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run("excel")}>
          <FileSpreadsheet className="mr-2 size-4" /> Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("csv")}>
          <Table2 className="mr-2 size-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("pdf")}>
          <FileText className="mr-2 size-4" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
