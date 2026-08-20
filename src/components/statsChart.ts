import type { StatsDay } from "../types/api";

/**
 * Chart geometry lives here rather than inside the component so the shapes can
 * be checked without rendering, the same way the meal card and calendar rules
 * are tested.
 */

/** Split a ring into the clean arc and the remaining gap for stroke-dasharray. */
export function donutDash(cleanRatio: number, circumference: number): [number, number] {
  const bounded = Math.min(100, Math.max(0, cleanRatio));
  const filled = (bounded / 100) * circumference;
  return [filled, circumference - filled];
}

export type DailyBar = {
  date: string;
  /** Day of month, e.g. "10". */
  label: string;
  clean: number;
  free: number;
  total: number;
  /** Share of the chart height, 0–1, scaled against the busiest day. */
  cleanHeight: number;
  freeHeight: number;
};

/**
 * Scale each day against the busiest day so the tallest column fills the chart.
 * A day with no record keeps its slot at zero height instead of disappearing —
 * the gaps are the point of this chart.
 */
export function buildDailyBars(daily: StatsDay[]): DailyBar[] {
  const peak = daily.reduce((highest, day) => Math.max(highest, day.clean + day.free), 0);
  const scale = peak > 0 ? 1 / peak : 0;

  return daily.map((day) => ({
    date: day.date,
    label: String(Number(day.date.split("-")[2])),
    clean: day.clean,
    free: day.free,
    total: day.clean + day.free,
    cleanHeight: day.clean * scale,
    freeHeight: day.free * scale,
  }));
}

/** One sentence describing the ring for screen readers. */
export function donutLabel(clean: number, free: number, cleanRatio: number): string {
  return `클린식 ${clean}회 ${cleanRatio}퍼센트, 자유식 ${free}회 ${100 - cleanRatio}퍼센트`;
}
