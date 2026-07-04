"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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

/**
 * Glow dot on the latest non-null point only (HUD signature); all other
 * points stay dotless so the line reads clean.
 */
function LatestDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  data: TrendPoint[];
  dataKey: "a" | "b";
  fill: string;
}) {
  const { cx, cy, index, data, dataKey, fill } = props;
  if (cx === undefined || cy === undefined || index === undefined) return null;
  const lastIdx = data.reduce((acc, p, i) => (p[dataKey] != null ? i : acc), -1);
  if (index !== lastIdx) return null;
  return (
    <g style={{ filter: `drop-shadow(0 0 6px ${fill})` }}>
      <circle cx={cx} cy={cy} r={3.5} fill={fill} stroke="var(--bg-surface)" strokeWidth={1.5} />
    </g>
  );
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
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            {/* HUD treatment: gradient stroke + soft area fill for series A. */}
            <linearGradient id="hudStrokeA" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_1} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_1} stopOpacity={1} />
            </linearGradient>
            <linearGradient id="hudFillA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_1} stopOpacity={0.08} />
              <stop offset="100%" stopColor={CHART_1} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--stroke-hairline)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-secondary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--stroke-hairline)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
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
          <Area
            type="monotone"
            dataKey="a"
            fill="url(#hudFillA)"
            stroke="none"
            connectNulls
            tooltipType="none"
            legendType="none"
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="a"
            name={seriesA}
            stroke="url(#hudStrokeA)"
            strokeWidth={2}
            dot={<LatestDot data={data} dataKey="a" fill={CHART_1} />}
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
              dot={<LatestDot data={data} dataKey="b" fill={CHART_2} />}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-surface)" }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
