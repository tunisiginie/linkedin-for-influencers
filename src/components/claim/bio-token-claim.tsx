"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requestBioTokenClaim, verifyBioTokenClaim } from "@/lib/actions/claim";

export function BioTokenClaim({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function getToken() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("creator_id", creatorId);
        const { token } = await requestBioTokenClaim(fd);
        setToken(token);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start verification.");
      }
    });
  }

  function verify() {
    if (!token) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("creator_id", creatorId);
      fd.set("token", token);
      const result = await verifyBioTokenClaim(fd);
      if (result.ok) {
        toast.success("Profile claimed!");
        router.push("/settings");
      } else {
        toast.error(result.error ?? "Verification failed.");
      }
    });
  }

  if (!token) {
    return (
      <Button variant="outline" size="sm" onClick={getToken} disabled={isPending}>
        {isPending ? "Generating..." : "Get a verification code"}
      </Button>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 px-4 py-3 text-sm">
        <p>
          Add this code anywhere in your channel&apos;s description, save it,
          then verify below. You can remove it afterward.
        </p>
        <code className="block rounded-md bg-muted px-2 py-1.5 text-xs">{token}</code>
        <Button size="sm" onClick={verify} disabled={isPending}>
          {isPending ? "Checking..." : "I've added it — verify now"}
        </Button>
      </CardContent>
    </Card>
  );
}
