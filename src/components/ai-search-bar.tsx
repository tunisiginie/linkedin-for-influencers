"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

interface AiFilters {
  q?: string;
  category?: string;
  platform?: string;
  country?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minRoiScore?: number;
  sort?: string;
}

export function AiSearchBar() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsPending(true);
    try {
      const res = await fetch("/api/assistant/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt }),
      });
      const data = await res.json();
      if (data.type === "fallback") {
        toast.info("Claude isn't configured on this deployment yet — use the filters instead.");
        return;
      }
      if (!data.filters) {
        toast.error(data.error ?? "Couldn't understand that search.");
        return;
      }
      const filters = data.filters as AiFilters;
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.category) params.set("category", filters.category);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.country) params.set("country", filters.country);
      if (filters.minFollowers) params.set("minFollowers", String(filters.minFollowers));
      if (filters.maxFollowers) params.set("maxFollowers", String(filters.maxFollowers));
      if (filters.minRoiScore) params.set("minRoiScore", String(filters.minRoiScore));
      if (filters.sort) params.set("sort", filters.sort);
      router.push(`/search?${params.toString()}`);
    } catch {
      toast.error("Couldn't understand that search.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleAsk} className="mb-4 flex gap-2">
      <div className="relative flex-1">
        <Sparkles className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-primary" />
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Claude, e.g. 'fitness creators under 500k subs who are growing fast'"
          className="pl-8"
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Thinking..." : "Ask"}
      </Button>
    </form>
  );
}
