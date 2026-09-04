import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/mock/api";

export function CampaignDeleteDialog({ campaignName }: { campaignName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const matches = typed.trim() === campaignName;

  const del = useMutation({
    mutationFn: () => api.deleteCampaign(campaignName),
    onSuccess: () => {
      toast.success(`Campaign "${campaignName}" deleted`);
      qc.invalidateQueries();
      setOpen(false);
      navigate({ to: "/campaigns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTyped("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 size-4" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete campaign</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This permanently removes the campaign and its roster assignment. This action
                cannot be undone.
              </p>
              <p>
                Campaign: <span className="font-semibold text-foreground">{campaignName}</span>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-name">
            Type <span className="font-semibold">{campaignName}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={campaignName}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || del.isPending}
            onClick={() => del.mutate()}
          >
            {del.isPending ? "Deleting…" : "Delete campaign"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
