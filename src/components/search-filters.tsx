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
import { Separator } from "@/components/ui/separator";
import { ResolvedIcon } from "@/lib/icon-map";
import type { Category, Platform } from "@/lib/types";
import { RotateCcw } from "lucide-react";

const ROI_BANDS = [
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
  { value: "roi", label: "ROI score" },
  { value: "followers", label: "Followers" },
  { value: "newest", label: "Newest" },
];

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

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
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

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <form onSubmit={onSearchSubmit} className="mb-4 flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, headline, bio..."
        />
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select
            items={[
              { value: "__all__", label: "All categories" },
              ...categories.map((c) => ({ value: c.slug, label: c.name })),
            ]}
            value={searchParams.get("category") ?? "__all__"}
            onValueChange={(v) => update({ category: v === "__all__" ? null : v })}
          >
            <SelectTrigger className="w-full">
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
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Platform</Label>
          <Select
            items={[
              { value: "__all__", label: "All platforms" },
              ...platforms.map((p) => ({ value: p.slug, label: p.name })),
            ]}
            value={searchParams.get("platform") ?? "__all__"}
            onValueChange={(v) => update({ platform: v === "__all__" ? null : v })}
          >
            <SelectTrigger className="w-full">
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
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Follower range</Label>
          <Select
            items={FOLLOWER_BANDS.map((b) => ({ value: b.value || "__any__", label: b.label }))}
            value={followerValue || "__any__"}
            onValueChange={(v) => onFollowerChange(v === "__any__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
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
          <Label className="text-xs text-muted-foreground">ROI score</Label>
          <Select
            items={ROI_BANDS.map((b) => ({ value: b.value || "__any__", label: b.label }))}
            value={searchParams.get("minRoiScore") ?? "__any__"}
            onValueChange={(v) => update({ minRoiScore: v === "__any__" ? null : v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROI_BANDS.map((b) => (
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
            onBlur={(e) => update({ country: e.target.value.toUpperCase() || null })}
          />
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sort by</Label>
          <Select
            items={SORTS}
            value={searchParams.get("sort") ?? "roi"}
            onValueChange={(v) => update({ sort: v === "roi" ? null : v })}
          >
            <SelectTrigger className="w-full">
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
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => router.push(pathname)}
        >
          <RotateCcw className="size-3.5" /> Reset filters
        </Button>
      </div>
    </div>
  );
}
