"use client";

import { useMemo, useState } from "react";
import { SEQUENTIAL_DARK, SEQUENTIAL_LIGHT, useIsDarkTheme } from "@/lib/chart-colors";

export interface GrowthPoint {
  date: string; // ISO date
  value: number;
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

/** A single-series line + area chart with a hover crosshair/tooltip and an
 * end-value direct label. No charting library — per dataviz skill: 2px
 * line, ~10% opacity area wash, hairline recessive gridlines, one sequential
 * hue (the app's primary blue) since there's only one series to identify. */
export function GrowthChart({ data, label }: { data: GrowthPoint[]; label: string }) {
  const isDark = useIsDarkTheme();
  const color = isDark ? SEQUENTIAL_DARK : SEQUENTIAL_LIGHT;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { points, minY, maxY, path, areaPath } = useMemo(() => {
    if (data.length === 0) {
      return { points: [] as { x: number; y: number }[], minY: 0, maxY: 0, path: "", areaPath: "" };
    }
    const values = data.map((d) => d.value);
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const spanY = maxY - minY || 1;
    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const points = data.map((d, i) => ({
      x: PAD_LEFT + (data.length === 1 ? 0 : (i / (data.length - 1)) * plotW),
      y: PAD_TOP + plotH - ((d.value - minY) / spanY) * plotH,
    }));

    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const baseline = PAD_TOP + plotH;
    const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`;

    return { points, minY, maxY, path, areaPath };
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Not enough history yet
      </div>
    );
  }

  const gridLines = 3;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIdx(closest);
  }

  const hovered = hoverIdx !== null ? { point: points[hoverIdx], datum: data[hoverIdx] } : null;
  const last = points[points.length - 1];
  const lastDatum = data[data.length - 1];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label={`${label} over time, from ${compactNumber(minY)} to ${compactNumber(maxY)}`}
      >
        {Array.from({ length: gridLines }).map((_, i) => {
          const y = PAD_TOP + (plotH / (gridLines - 1)) * i;
          const value = maxY - ((maxY - minY) / (gridLines - 1)) * i;
          return (
            <g key={i}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text x={0} y={y - 4} className="fill-muted-foreground text-[9px]">
                {compactNumber(value)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={color} opacity={0.1} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* End marker + direct label */}
        <circle cx={last.x} cy={last.y} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
        <text
          x={last.x - 4}
          y={last.y - 10}
          textAnchor="end"
          className="fill-foreground text-[11px] font-medium"
        >
          {compactNumber(lastDatum.value)}
        </text>

        {hovered ? (
          <g>
            <line
              x1={hovered.point.x}
              x2={hovered.point.x}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
            <circle
              cx={hovered.point.x}
              cy={hovered.point.y}
              r={4}
              fill={color}
              stroke="var(--card)"
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
          style={{ left: `${(hovered.point.x / WIDTH) * 100}%` }}
        >
          <div className="font-medium">{compactNumber(hovered.datum.value)}</div>
          <div className="text-muted-foreground">{hovered.datum.date}</div>
        </div>
      ) : null}
    </div>
  );
}
