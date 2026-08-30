"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestDataDeletion } from "@/lib/actions/settings";

export function DeletionRequestButton({ alreadyRequested }: { alreadyRequested: boolean }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (alreadyRequested) {
    return (
      <p className="text-sm text-muted-foreground">
        Deletion requested. We&apos;ll remove your stored contact data and
        stop surfacing your profile to sponsors.
      </p>
    );
  }

  function confirm() {
    startTransition(async () => {
      try {
        await requestDataDeletion();
        toast.success("Deletion requested.");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to request deletion.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Request data deletion</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request data deletion</DialogTitle>
          <DialogDescription>
            This immediately pauses new outreach and flags your stored
            contact info for removal. Your public profile stays up but
            sponsors can no longer message or see your contact details.
            This can&apos;t be undone from this screen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending ? "Requesting..." : "Confirm deletion request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
