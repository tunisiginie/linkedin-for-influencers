"use client";

import { categoricalColor, useIsDarkTheme } from "@/lib/chart-colors";
import type { RoiComponents, RoiPillarKey, RoiReason } from "@/lib/types";

const PILLAR_LABELS: Record<RoiPillarKey, { label: string; blurb: string }> = {
  scale: { label: "Scale & delivery", blurb: "Audience size, reach efficiency, growth, platform mix" },
  attention: { label: "Attention & engagement", blurb: "Engagement rate, watch time, posting cadence" },
  trust: { label: "Audience trust & quality", blurb: "How natural the engagement pattern looks" },
  relevance: { label: "Relevance & authority", blurb: "Topical authority (AI-assessed from bio and recent content)" },
  commercial: { label: "Commercial performance", blurb: "Past campaign results, conversions — coming soon" },
  deal: { label: "Deal economics", blurb: "Pricing efficiency — coming soon" },
  governance: { label: "Governance & future", blurb: "Track record creating content" },
};

// Fixed display order — pillars are never re-ordered by value, so a given
// pillar always reads as the same position/color everywhere it appears.
const PILLAR_ORDER: RoiPillarKey[] = [
  "scale",
  "attention",
  "trust",
  "relevance",
  "commercial",
  "deal",
  "governance",
];

/** Horizontal bar breakdown of the ROI pillars actually present for this
 * creator (v2 only weights pillars with a live data source — see
 * src/lib/roi/score.ts). Each bar is capped at 24px, 4px rounded data-end,
 * fixed categorical color per pillar (never re-ordered by value), value
 * labeled at the tip — per dataviz skill specs. This breakdown *is* the
 * product's explainability story: a sponsor should be able to see exactly
 * why a creator scored what they did. */
export function RoiBreakdown({
  components,
  confidence,
  reasons,
}: {
  components: RoiComponents;
  confidence?: number | null;
  reasons?: RoiReason[];
}) {
  const isDark = useIsDarkTheme();
  const present = PILLAR_ORDER.filter((key) => components[key] !== undefined);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {present.map((key, i) => {
          const pillar = components[key]!;
          const color = categoricalColor(i, isDark);
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-right">
                <div className="text-sm font-medium">{PILLAR_LABELS[key].label}</div>
              </div>
              <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${Math.max(2, pillar.raw)}%`, backgroundColor: color }}
                />
              </div>
              <div className="w-10 shrink-0 text-sm font-semibold tabular-nums">
                {Math.round(pillar.raw)}
              </div>
            </div>
          );
        })}
      </div>

      {confidence != null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Confidence:</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/60"
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
          <span className="tabular-nums">{Math.round(confidence * 100)}%</span>
        </div>
      ) : null}

      {reasons && reasons.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {reasons.map((r) => (
            <li
              key={r.code}
              className={r.direction === "positive" ? "text-[#0ca30c]" : "text-[#d03b3b]"}
            >
              {r.direction === "positive" ? "▲" : "▼"} {r.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RoiBreakdownLegend({ components }: { components?: RoiComponents }) {
  const present = components
    ? PILLAR_ORDER.filter((key) => components[key] !== undefined)
    : PILLAR_ORDER;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
      {present.map((key) => (
        <div key={key} className="flex justify-between gap-2">
          <dt className="font-medium text-foreground">{PILLAR_LABELS[key].label}</dt>
          <dd className="text-right">{PILLAR_LABELS[key].blurb}</dd>
        </div>
      ))}
    </dl>
  );
}
