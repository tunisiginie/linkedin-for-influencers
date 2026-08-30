"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updateContactOptOut } from "@/lib/actions/settings";

export function OptOutSwitch({ initialOptedOut }: { initialOptedOut: boolean }) {
  const [optedOut, setOptedOut] = useState(initialOptedOut);
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    setOptedOut(next);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("opt_out", String(next));
        await updateContactOptOut(fd);
        toast.success(next ? "You're opted out of new outreach." : "Open to new outreach again.");
      } catch (err) {
        setOptedOut(!next);
        toast.error(err instanceof Error ? err.message : "Failed to update.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Pause new outreach</p>
        <p className="text-xs text-muted-foreground">
          Sponsors won&apos;t be able to start new conversations with you.
          Existing conversations aren&apos;t affected.
        </p>
      </div>
      <Switch checked={optedOut} onCheckedChange={save} disabled={isPending} />
    </div>
  );
}
