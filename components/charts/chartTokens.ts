/**
 * Chart palette + point shape, dependency-free (v3.3 C8) so consumers and
 * the lazy TrendChart wrapper can share them without pulling recharts into
 * the first-load bundle.
 */
export const CHART_1 = "#ffb13d"; // gold series (marks, legend)
export const CHART_1_END = "#ff6a3d"; // ember gradient end for the A stroke
export const CHART_2 = "#4C86D8"; // blue series

export interface TrendPoint {
  label: string;
  a: number | null;
  b?: number | null;
}
