// Validated categorical palette (dataviz skill § references/palette.md).
// Fixed hue order — never cycled, never re-ordered by rank — so a given ROI
// component always reads as the same color everywhere it appears. Passes
// the CVD-safety gate in both light and dark mode as documented.
export const CATEGORICAL_LIGHT = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
] as const;

export const CATEGORICAL_DARK = [
  "#3987e5", // 1 blue
  "#d95926", // 2 orange
  "#199e70", // 3 aqua
  "#c98500", // 4 yellow
  "#d55181", // 5 magenta
  "#008300", // 6 green
] as const;

// Sequential default hue is the same blue as categorical slot 1 — used for
// single-series charts (the follower/view growth trajectory).
export const SEQUENTIAL_LIGHT = CATEGORICAL_LIGHT[0];
export const SEQUENTIAL_DARK = CATEGORICAL_DARK[0];

export function categoricalColor(index: number, isDark: boolean): string {
  const palette = isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  return palette[index % palette.length];
}

// Status palette (fixed — never themed, same hex in both modes per the
// dataviz reference; each still ships with a text label, never color alone).
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export function statusForGrade(grade: "A" | "B" | "C" | "D" | "F" | null): keyof typeof STATUS {
  switch (grade) {
    case "A":
    case "B":
      return "good";
    case "C":
      return "warning";
    case "D":
      return "serious";
    default:
      return "critical";
  }
}
