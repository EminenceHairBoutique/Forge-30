/**
 * Chart palette + point shape, dependency-free (v3.3 C8) so consumers and
 * the lazy TrendChart wrapper can share them without pulling recharts into
 * the first-load bundle.
 */
export const CHART_1 = "#7c5cff"; // violet series (marks, legend)
export const CHART_1_END = "#4a2fd4"; // deep-violet gradient end for the A stroke
export const CHART_2 = "#00d4ff"; // cyan series (CVD-safe separation from violet)

export interface TrendPoint {
  label: string;
  a: number | null;
  b?: number | null;
}
