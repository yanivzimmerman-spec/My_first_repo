"use client";

import { Component, lazy, Suspense, type ComponentProps, type ReactNode } from "react";
import { loadGrowthChart, loadComboView } from "./chartsSource";

// The charts library is large; it loads only when a chart is first shown.
const GrowthChartImpl = lazy(loadGrowthChart);
const ComboViewImpl = lazy(loadComboView);

/** If the chart code can't load (offline, blocked), say so instead of breaking the page. */
class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-[14px] text-slate-600">
          הגרף לא נטען. הסכומים מופיעים גם בכרטיס התוצאה ובפירוט המלא.
        </p>
      );
    return this.props.children;
  }
}

function Placeholder({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-[13px] text-slate-500"
      style={{ minHeight: height }}
      role="status"
    >
      טוען גרף…
    </div>
  );
}

export function GrowthChart(props: ComponentProps<typeof GrowthChartImpl>) {
  return (
    <ChartBoundary>
      <Suspense fallback={<Placeholder height={440} />}>
        <GrowthChartImpl {...props} />
      </Suspense>
    </ChartBoundary>
  );
}

export function ComboView(props: ComponentProps<typeof ComboViewImpl>) {
  return (
    <ChartBoundary>
      <Suspense fallback={<Placeholder height={520} />}>
        <ComboViewImpl {...props} />
      </Suspense>
    </ChartBoundary>
  );
}
