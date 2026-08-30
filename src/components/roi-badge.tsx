"use client";

import { useTheme } from "next-themes";
import { STATUS, statusForGrade } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import type { RoiGrade } from "@/lib/types";

export function RoiBadge({
  score,
  grade,
  size = "md",
}: {
  score: number | null;
  grade: RoiGrade | null;
  size?: "sm" | "md" | "lg";
}) {
  useTheme(); // status palette is mode-invariant, but keep hook usage consistent for future theming

  if (score === null || grade === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
        ROI: pending
      </span>
    );
  }

  const color = STATUS[statusForGrade(grade)];
  const sizes = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-0.5 gap-1.5",
    lg: "text-sm px-2.5 py-1 gap-1.5",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizes,
      )}
      style={{ borderColor: color, color }}
      title={`ROI score ${score} / 1000, grade ${grade}`}
    >
      <span className="font-semibold">{grade}</span>
      <span className="tabular-nums opacity-80">{score}</span>
    </span>
  );
}
