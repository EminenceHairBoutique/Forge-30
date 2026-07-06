"use client";

import { useEffect, useState, type ComponentProps, type ComponentType } from "react";

/**
 * Lazy TrendChart wrapper (v3.3 C8). Recharts is ~100 kB of first-load JS;
 * this defers it to a client-side dynamic import (never SSR'd) behind a
 * dimension-matched skeleton, so chart pages' initial bundles stay lean.
 * Consumers keep importing { TrendChart } from here unchanged.
 */

export { CHART_1, CHART_1_END, CHART_2 } from "./chartTokens";
export type { TrendPoint } from "./chartTokens";

type ChartProps = ComponentProps<typeof import("./TrendChartImpl").TrendChartImpl>;

let cached: ComponentType<ChartProps> | null = null;

export function TrendChart(props: ChartProps) {
  const [Impl, setImpl] = useState<ComponentType<ChartProps> | null>(cached);
  useEffect(() => {
    if (Impl) return;
    let mounted = true;
    void import("./TrendChartImpl").then((m) => {
      cached = m.TrendChartImpl;
      if (mounted) setImpl(() => m.TrendChartImpl);
    });
    return () => {
      mounted = false;
    };
  }, [Impl]);

  if (!Impl) {
    return (
      <div
        aria-hidden
        className="w-full animate-pulse rounded-(--radius-control) bg-elevated"
        style={{ height: props.height ?? 220 }}
      />
    );
  }
  return <Impl {...props} />;
}
