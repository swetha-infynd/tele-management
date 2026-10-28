import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { num } from "@/lib/format";
import { api } from "@/lib/mock/api";
import { cn } from "@/lib/utils";
import {
  DIAL_UPLOAD_QUERY_KEYS,
  addDialUpload,
  loadDialUploads,
  newUploadId,
  parseDialCsv,
  removeDialUpload,
  type DialUploadBatch,
} from "@/lib/dial-upload";

const DIAL_UPLOADS_KEY = ["dial-uploads"];

/** Purple tint matching the sidebar accent (#854BF6), used for campaign badges. */
const PURPLE_BADGE =
  "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300";

interface PendingFile {
  fileName: string;
  rowCount: number;
  connects: number;
  dialAttempts: number;
  /** CRM campaign auto-detected from the CSV content, if any. */
  detectedCampaign: string | undefined;
  /** Raw campaign name strings found in the CSV (for display). */
  rawCampaignNames: string[];
  /** True if this is a "Successful Call List" file, not a "Call Details" file. */
  isSuccessList: boolean;
  /** Distinct Customer / Customer Name values found (the per-record Client). */
  customerCount: number;
}

function readUploads(): DialUploadBatch[] {
  return loadDialUploads();
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const key of DIAL_UPLOAD_QUERY_KEYS) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

export function DialUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTextsRef = useRef<Map<string, string>>(new Map());
  const [campaign, setCampaign] = useState<string>("");
  const [campaignAutoDetected, setCampaignAutoDetected] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [parsing, setParsing] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.listCampaigns,
  });

  const { data: batches = [] } = useQuery({
    queryKey: DIAL_UPLOADS_KEY,
    queryFn: readUploads,
  });

  const reset = () => {
    setCampaign("");
    setCampaignAutoDetected(false);
    setFiles([]);
    setParsing(false);
    fileTextsRef.current.clear();
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) reset();
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    const csvs = picked.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    const invalid = picked.filter((f) => !f.name.toLowerCase().endsWith(".csv"));
    if (invalid.length) {
      toast.error(`Skip non-CSV: ${invalid.map((f) => f.name).join(", ")}`);
    }
    if (csvs.length === 0) return;

    setParsing(true);
    const next: PendingFile[] = [];
    const errors: string[] = [];
    for (const file of csvs) {
      try {
        const text = await file.text();
        const parsed = parseDialCsv(text);
        fileTextsRef.current.set(file.name, text);
        next.push({
          fileName: file.name,
          rowCount: parsed.rowCount,
          connects: parsed.summary.connects,
          dialAttempts: parsed.summary.dialAttempts,
          detectedCampaign: parsed.detectedCampaign,
          rawCampaignNames: parsed.rawCampaignNames,
          isSuccessList: parsed.isSuccessList,
          customerCount: parsed.customerCount,
        });
      } catch (e) {
        fileTextsRef.current.delete(file.name);
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "unreadable"}`);
      }
    }
    setFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.fileName, f]));
      for (const f of next) byName.set(f.fileName, f);
      const all = [...byName.values()];

      // Auto-select campaign from the first file that has a detection, if not already set.
      const allDetected = all.map((f) => f.detectedCampaign).filter(Boolean) as string[];
      const detectedUniq = [...new Set(allDetected)];
      if (detectedUniq.length === 1) {
        setCampaign(detectedUniq[0] as string);
        setCampaignAutoDetected(true);
      } else if (detectedUniq.length > 1) {
        // Conflicting detections — clear auto-selection so the user must choose manually.
        setCampaign("");
        setCampaignAutoDetected(false);
      }
      return all;
    });
    setParsing(false);
    if (fileRef.current) fileRef.current.value = "";
    if (errors.length) toast.error(errors[0]);
    if (next.length > 0) {
      const rows = next.reduce((n, f) => n + f.rowCount, 0);
      toast.success(`${next.length} file${next.length > 1 ? "s" : ""} ready`, {
        description: `${rows.toLocaleString("en-GB")} rows parsed`,
      });
    }
  };

  const removePending = (fileName: string) => {
    fileTextsRef.current.delete(fileName);
    setFiles((prev) => prev.filter((f) => f.fileName !== fileName));
  };

  const commitUpload = useMutation({
    mutationFn: () => {
      if (!campaign) throw new Error("Select a campaign first.");
      if (files.length === 0) throw new Error("Choose one or more call-details CSVs.");
      const uploadedAt = new Date().toISOString();
      for (const f of files) {
        const text = fileTextsRef.current.get(f.fileName);
        if (!text) throw new Error(`Missing content for ${f.fileName}.`);
        const parsed = parseDialCsv(text);
        addDialUpload({
          id: newUploadId(),
          campaign,
          fileName: f.fileName,
          uploadedAt,
          uploadDate: uploadedAt.slice(0, 10),
          rowCount: parsed.rowCount,
          summary: parsed.summary,
          hourly: parsed.hourly,
          agents: parsed.agents,
          rawCampaignNames: parsed.rawCampaignNames,
          customers: parsed.customers,
          customerCount: parsed.customerCount,
        });
      }
      return Promise.resolve(readUploads());
    },
    onSuccess: (next) => {
      qc.setQueryData(DIAL_UPLOADS_KEY, next);
      invalidateAll(qc);
      const total = files.reduce((n, f) => n + f.rowCount, 0);
      toast.success("Call details uploaded", {
        description: `${files.length} file${files.length > 1 ? "s" : ""} · ${total.toLocaleString("en-GB")} rows for ${campaign}.`,
      });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => {
      removeDialUpload(id);
      return Promise.resolve(readUploads());
    },
    onSuccess: (next) => {
      qc.setQueryData(DIAL_UPLOADS_KEY, next);
      invalidateAll(qc);
      toast.success("Upload removed");
    },
  });

  // Warn if multiple files map to different campaigns.
  const detectedCampaigns = [...new Set(files.map((f) => f.detectedCampaign).filter(Boolean))];
  const hasConflictingCampaigns = detectedCampaigns.length > 1;
  const hasUndetectedFiles = files.some((f) => !f.detectedCampaign);
  const hasSuccessListFiles = files.some((f) => f.isSuccessList);

  const canUpload = !!campaign && files.length > 0 && !parsing && !commitUpload.isPending;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="size-4 text-purple-600 dark:text-purple-400" /> Upload dial data
          </DialogTitle>
          <DialogDescription>
            Import one or more Infynd-style <span className="font-medium">Call Details</span> CSVs
            for a campaign. Parsed stats merge into Dial Data, campaigns, and reports — kept in this
            browser.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Campaign</span>
              {campaignAutoDetected && campaign && (
                <Badge variant="secondary" className={cn("gap-1 text-[10px]", PURPLE_BADGE)}>
                  <span className="inline-block size-1.5 rounded-full bg-purple-500" />
                  Auto-detected
                </Badge>
              )}
            </div>
            {hasConflictingCampaigns && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                ⚠ Files contain different campaigns ({detectedCampaigns.join(", ")}). Select the
                correct campaign below.
              </p>
            )}
            <Select
              value={campaign}
              onValueChange={(v) => {
                setCampaign(v);
                setCampaignAutoDetected(false);
              }}
            >
              <SelectTrigger className="w-full focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50">
                <SelectValue placeholder="Select campaign…" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {campaign && files.some((f) => f.rawCampaignNames.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-purple-500/25 bg-purple-500/5 px-3 py-2">
                <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
                  {campaign}
                </span>
                <span className="text-[10px] text-muted-foreground">from</span>
                {[...new Set(files.flatMap((f) => f.rawCampaignNames))].slice(0, 6).map((n) => (
                  <Badge
                    key={n}
                    variant="outline"
                    className={cn("px-1.5 py-0 text-[9px] font-normal", PURPLE_BADGE)}
                  >
                    {n}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Call details files</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 border-dashed border-purple-500/40 bg-purple-500/5 px-4 py-6 text-left hover:border-purple-500/60 hover:bg-purple-500/10"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
            >
              {parsing ? (
                <Loader2 className="size-4 animate-spin text-purple-600 dark:text-purple-400" />
              ) : (
                <Upload className="size-4 text-purple-600 dark:text-purple-400" />
              )}
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">
                  {files.length > 0
                    ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                    : "Choose CSV exports"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Select multiple Call Details files · click to add more
                </span>
              </span>
            </Button>

            {files.length > 0 && (
              <>
                {hasSuccessListFiles && (
                  <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                    ℹ Some files are <strong>Successful Call Lists</strong> — they count all rows as
                    connects.
                  </p>
                )}
                {hasUndetectedFiles && !hasConflictingCampaigns && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    ⚠ Some files have no recognisable Campaign Name column — please confirm the
                    campaign above.
                  </p>
                )}
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li
                      key={f.fileName}
                      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {num(f.rowCount)} rows · {num(f.connects)} connects
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {f.isSuccessList && (
                            <Badge
                              variant="outline"
                              className="text-[9px] text-blue-600 dark:text-blue-400"
                            >
                              Successful Calls
                            </Badge>
                          )}
                          {f.detectedCampaign && (
                            <Badge
                              variant="outline"
                              className={cn("px-1.5 py-0 text-[9px] font-normal", PURPLE_BADGE)}
                            >
                              → {f.detectedCampaign}
                            </Badge>
                          )}
                          {f.customerCount > 0 && (
                            <Badge variant="outline" className="text-[9px] text-muted-foreground">
                              {num(f.customerCount)} clients
                            </Badge>
                          )}
                        </div>
                        {f.rawCampaignNames.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                              CSV
                            </span>
                            {f.rawCampaignNames.slice(0, 4).map((n) => (
                              <Badge
                                key={n}
                                variant="outline"
                                className={cn("px-1.5 py-0 text-[9px] font-normal", PURPLE_BADGE)}
                              >
                                {n}
                              </Badge>
                            ))}
                            {f.rawCampaignNames.length > 4 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{f.rawCampaignNames.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${f.fileName}`}
                        onClick={() => removePending(f.fileName)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Uploaded batches</span>
              <Badge variant="secondary">{batches.length}</Badge>
            </div>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No uploads yet. Data you import will be listed here.
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {batches.slice(0, 12).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-start gap-2 rounded-md border border-purple-500/25 bg-purple-500/5 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{b.campaign}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {num(b.rowCount)} rows
                        </Badge>
                      </div>
                      {(b.rawCampaignNames?.length ?? 0) > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {b.rawCampaignNames!.slice(0, 4).map((n) => (
                            <Badge
                              key={n}
                              variant="outline"
                              className={cn("px-1.5 py-0 text-[9px] font-normal", PURPLE_BADGE)}
                            >
                              {n}
                            </Badge>
                          ))}
                          {b.rawCampaignNames!.length > 4 && (
                            <span className="text-[9px] text-muted-foreground">
                              +{b.rawCampaignNames!.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                      <p className="truncate text-xs text-muted-foreground">{b.fileName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(b.uploadedAt).toLocaleString("en-GB")} · {num(b.summary.connects)}{" "}
                        connects
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove upload"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(b.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-background px-6 py-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            <X className="mr-2 size-4" /> Close
          </Button>
          <Button
            type="button"
            className="bg-purple-600 text-white shadow-sm hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
            onClick={() => commitUpload.mutate()}
            disabled={!canUpload}
          >
            {commitUpload.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Upload {files.length > 1 ? `${files.length} files` : "to campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
