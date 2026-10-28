import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClientNameList } from "@/lib/dial-upload";
import { num } from "@/lib/format";

/** How many names are revealed per "Load more" click in the full list. */
const PAGE = 200;

/**
 * Renders the client (customer) names extracted from uploaded dial data.
 *
 * Shows a short preview followed by a "+N more" trigger that opens the complete,
 * searchable list. When no upload covers the row, renders an em dash.
 */
export function ClientNamesCell({
  names,
  total,
  preview = 2,
}: ClientNameList & { preview?: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return names;
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [names, query]);

  if (total <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const shown = names.slice(0, preview);
  const more = total - shown.length;
  const close = () => {
    setOpen(false);
    setQuery("");
    setLimit(PAGE);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 align-middle">
      {shown.length > 0 && (
        <span className="max-w-[240px] truncate" title={shown.join(", ")}>
          {shown.join(", ")}
        </span>
      )}
      {more > 0 && (
        <Dialog
          open={open}
          onOpenChange={(v) => {
            if (v) setOpen(true);
            else close();
          }}
        >
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto shrink-0 p-0 text-xs font-medium text-purple-700 dark:text-purple-300"
            >
              +{num(more)} more
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="size-4 text-purple-600 dark:text-purple-400" />
                Client names
                <Badge variant="secondary">{num(total)}</Badge>
              </DialogTitle>
              <DialogDescription>
                Extracted from the uploaded dial data (Customer / Customer Name / Customer Title,
                First name and Surname).
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Search client names…"
                className="pl-9"
                aria-label="Search client names"
              />
            </div>

            {names.length < total && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                This upload stored {num(names.length)} of {num(total)} names. Re-upload the file to
                capture the full list.
              </p>
            )}

            <ScrollArea className="max-h-[45vh]">
              <ul className="divide-y">
                {filtered.slice(0, limit).map((name) => (
                  <li key={name} className="py-1.5 text-sm">
                    {name}
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">
                    {names.length === 0
                      ? "No names were stored for this upload."
                      : `No names match “${query.trim()}”.`}
                  </li>
                )}
              </ul>
            </ScrollArea>

            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Showing {num(Math.min(limit, filtered.length))} of {num(filtered.length)}
                {query.trim() ? " matching" : ""}
              </span>
              {limit < filtered.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLimit((l) => l + PAGE)}
                >
                  Load more
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </span>
  );
}
