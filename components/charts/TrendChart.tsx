"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Dark-themed trend line chart.
 *
 * Data-mark colors are the validated chart palette (passes the lightness
 * band, chroma floor, CVD separation, and 3:1 contrast checks on the
 * #141416 surface) — distinct from the UI's muted brand gold, which is too
 * gray for marks. Status colors stay reserved for status.
 */
export const CHART_1 = "#B08A28"; // gold series
export const CHART_2 = "#4C86D8"; // blue series

export interface TrendPoint {
  label: string;
  a: number | null;
  b?: number | null;
}

export function TrendChart({
  data,
  seriesA,
  seriesB,
  unit = "",
  target,
  height = 220,
  yDomain,
}: {
  data: TrendPoint[];
  seriesA: string;
  seriesB?: string;
  unit?: string;
  /** Optional target reference line (e.g. calorie target). */
  target?: number;
  height?: number;
  /**
   * Fixed y-axis range for bounded metrics (e.g. [0, 100] for Forge Score).
   * Without it a single point renders a meaningless auto axis.
   */
  yDomain?: [number, number];
}) {
  const hasB = !!seriesB;
  return (
    <div>
      {/* Legend: only when two series are present (one series is named by the card title). */}
      {hasB && (
        <div className="mb-2 flex gap-4 px-1">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: CHART_1 }} />
            {seriesA}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: CHART_2 }} />
            {seriesB}
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={46}
            domain={yDomain ?? ["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--text-secondary)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              color: "var(--text-primary)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-secondary)" }}
            formatter={(value: number | string, name: string) => [`${value}${unit}`, name]}
          />
          {target !== undefined && (
            <ReferenceLine
              y={target}
              stroke="var(--text-secondary)"
              strokeDasharray="4 4"
              label={{
                value: `target ${target.toLocaleString()}`,
                fill: "var(--text-secondary)",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="a"
            name={seriesA}
            stroke={CHART_1}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-surface)" }}
            connectNulls
          />
          {hasB && (
            <Line
              type="monotone"
              dataKey="b"
              name={seriesB}
              stroke={CHART_2}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-surface)" }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
