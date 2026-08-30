"use client";

import { useTheme } from "next-themes";
import { categoricalColor } from "@/lib/chart-colors";
import type { RoiComponents } from "@/lib/types";

const COMPONENT_LABELS: { key: keyof RoiComponents; label: string; blurb: string }[] = [
  { key: "reach", label: "Reach", blurb: "Followers + typical views vs. category" },
  { key: "engagement", label: "Engagement quality", blurb: "Likes + comments per view" },
  { key: "consistency", label: "Consistency", blurb: "How regular the upload cadence is" },
  { key: "trajectory", label: "Trajectory", blurb: "Growth rate over the last 90 days" },
  { key: "tenure", label: "Tenure", blurb: "Years actively creating" },
  { key: "authenticity", label: "Audience authenticity", blurb: "How natural the engagement pattern looks" },
];

/** Horizontal bar breakdown of the six ROI components. Each bar is capped at
 * 24px, 4px rounded data-end, fixed categorical color per component (never
 * re-ordered by value), value labeled at the tip — per dataviz skill specs.
 * This breakdown *is* the product's explainability story: a sponsor should
 * be able to see exactly why a creator scored what they did. */
export function RoiBreakdown({ components }: { components: RoiComponents }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="space-y-3">
      {COMPONENT_LABELS.map((c, i) => {
        const raw = components[c.key] ?? 0;
        const color = categoricalColor(i, isDark);
        return (
          <div key={c.key} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-right">
              <div className="text-sm font-medium">{c.label}</div>
            </div>
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${Math.max(2, raw)}%`, backgroundColor: color }}
              />
            </div>
            <div className="w-10 shrink-0 text-sm font-semibold tabular-nums">{Math.round(raw)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function RoiBreakdownLegend() {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
      {COMPONENT_LABELS.map((c) => (
        <div key={c.key} className="flex justify-between gap-2">
          <dt className="font-medium text-foreground">{c.label}</dt>
          <dd className="text-right">{c.blurb}</dd>
        </div>
      ))}
    </dl>
  );
}
