// Artifact build: the charts library ships as charts.js next to the page and loads on first use.
// A classic script (not an ES module), so it works inside a sandboxed viewer frame without CORS.
import type GrowthChartT from "../components/GrowthChart";
import type ComboViewT from "../components/ComboView";

type Charts = { GrowthChart: typeof GrowthChartT; ComboView: typeof ComboViewT };
type W = Window & { __snoopyCharts?: Charts };
let pending: Promise<Charts> | null = null;

function load(): Promise<Charts> {
  if (pending) return pending;
  pending = new Promise<Charts>((resolve, reject) => {
    const w = window as W;
    if (w.__snoopyCharts) return resolve(w.__snoopyCharts);
    const s = document.createElement("script");
    s.src = "charts.js";
    s.async = true;
    s.onload = () => (w.__snoopyCharts ? resolve(w.__snoopyCharts) : reject(new Error("charts")));
    s.onerror = () => {
      pending = null; // allow a retry
      reject(new Error("charts"));
    };
    document.head.appendChild(s);
  });
  return pending;
}

export const loadGrowthChart = () => load().then((m) => ({ default: m.GrowthChart }));
export const loadComboView = () => load().then((m) => ({ default: m.ComboView }));
