"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsiblePanel } from "@/components/ui/collapsible";
import { ResolvedIcon } from "@/lib/icon-map";
import type { Category, Platform } from "@/lib/types";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const JAE_BANDS = [
  { value: "", label: "Any score" },
  { value: "850", label: "850+ (A)" },
  { value: "700", label: "700+ (B or better)" },
  { value: "550", label: "550+ (C or better)" },
];

const FOLLOWER_BANDS = [
  { value: "", label: "Any size" },
  { value: "0-10000", label: "Nano · under 10K" },
  { value: "10000-100000", label: "Micro · 10K–100K" },
  { value: "100000-1000000", label: "Mid · 100K–1M" },
  { value: "1000000-", label: "Macro · 1M+" },
];

const SORTS = [
  { value: "roi", label: "JAE Score" },
  { value: "followers", label: "Followers" },
  { value: "newest", label: "Newest" },
];

/** Compact, single-row facet bar (category/platform/sort) with everything
 * else — follower range, JAE band, country — tucked behind a "More
 * filters" collapsible. Keeps the URL-searchParams-as-state model exactly
 * as before; only the layout and two bugs changed:
 *   - Any facet change now also clears `page`, so switching a filter mid
 *     pagination doesn't leave you stranded on a now out-of-range page.
 *   - "Reset filters" now goes through the same startTransition as every
 *     other update, so the pending-state dimming applies to it too. */
export function SearchFilters({
  categories,
  platforms,
}: {
  categories: Category[];
  platforms: Platform[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const hasMoreFiltersApplied = Boolean(
    searchParams.get("minFollowers") ||
      searchParams.get("maxFollowers") ||
      searchParams.get("minRoiScore") ||
      searchParams.get("country"),
  );
  const [moreOpen, setMoreOpen] = useState(hasMoreFiltersApplied);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in patch)) params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    update({ q: q || null });
  }

  const followerValue = (() => {
    const min = searchParams.get("minFollowers");
    const max = searchParams.get("maxFollowers");
    if (!min && !max) return "";
    return `${min ?? "0"}-${max ?? ""}`;
  })();

  function onFollowerChange(v: string | null) {
    if (!v) {
      update({ minFollowers: null, maxFollowers: null });
      return;
    }
    const [min, max] = v.split("-");
    update({ minFollowers: min || null, maxFollowers: max || null });
  }

  function onReset() {
    setQ("");
    setMoreOpen(false);
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <div className={cn("space-y-3", isPending && "opacity-60 transition-opacity")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <form onSubmit={onSearchSubmit} className="flex flex-1 gap-2 sm:min-w-48">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, headline, bio..."
          />
          <Button type="submit" size="sm" variant="outline">
            <Search className="size-3.5" />
          </Button>
        </form>

        <Select
          items={[
            { value: "__all__", label: "All categories" },
            ...categories.map((c) => ({ value: c.slug, label: c.name })),
          ]}
          value={searchParams.get("category") ?? "__all__"}
          onValueChange={(v) => update({ category: v === "__all__" ? null : v })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                <ResolvedIcon iconName={c.icon} className="size-3.5" /> {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={[
            { value: "__all__", label: "All platforms" },
            ...platforms.map((p) => ({ value: p.slug, label: p.name })),
          ]}
          value={searchParams.get("platform") ?? "__all__"}
          onValueChange={(v) => update({ platform: v === "__all__" ? null : v })}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All platforms</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p.id} value={p.slug}>
                <ResolvedIcon iconName={p.icon} className="size-3.5" /> {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={SORTS}
          value={searchParams.get("sort") ?? "roi"}
          onValueChange={(v) => update({ sort: v === "roi" ? null : v })}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
        >
          More filters
          <ChevronDown className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")} />
        </Button>

        {hasMoreFiltersApplied || q || searchParams.get("category") || searchParams.get("platform") ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        ) : null}
      </div>

      {/* Controlled entirely by the "More filters" button above — the
          panel needs no Trigger of its own since Base UI's Collapsible
          works from `open`/`onOpenChange` alone. */}
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsiblePanel>
          <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Follower range</Label>
              <Select
                items={FOLLOWER_BANDS.map((b) => ({ value: b.value || "__any__", label: b.label }))}
                value={followerValue || "__any__"}
                onValueChange={(v) => onFollowerChange(v === "__any__" ? "" : v)}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Any size" />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWER_BANDS.map((b) => (
                    <SelectItem key={b.value} value={b.value || "__any__"}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">JAE Score</Label>
              <Select
                items={JAE_BANDS.map((b) => ({ value: b.value || "__any__", label: b.label }))}
                value={searchParams.get("minRoiScore") ?? "__any__"}
                onValueChange={(v) => update({ minRoiScore: v === "__any__" ? null : v })}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JAE_BANDS.map((b) => (
                    <SelectItem key={b.value} value={b.value || "__any__"}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Country</Label>
              <Input
                defaultValue={searchParams.get("country") ?? ""}
                placeholder="e.g. US"
                className="sm:w-28"
                onBlur={(e) => update({ country: e.target.value.toUpperCase() || null })}
              />
            </div>
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}
