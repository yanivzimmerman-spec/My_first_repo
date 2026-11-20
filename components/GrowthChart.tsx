"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Table2, Repeat } from "lucide-react";
import type { SimResult, YearPoint } from "@/lib/calculator";
import { formatCompactILS, formatILS } from "@/lib/format";

// HTML parts (legend, tooltip) follow the CSS theme variables.
const RE = "var(--bar-re)";
const SP = "var(--bar-sp)";

// SVG parts get explicit colors per theme (the dark pair is validated for the dark surface).
const PALETTE = {
  light: { re: "#4F46E5", sp: "#10B981", grid: "#EEF2F6", axis: "#E2E8F0", tick: "#64748B", cursor: "#94A3B8", cross: "#F59E0B", crossText: "#B45309", dot: "#FFFFFF" },
  dark: { re: "#7C78FF", sp: "#10A97C", grid: "#1E293B", axis: "#334155", tick: "#94A3B8", cursor: "#64748B", cross: "#F59E0B", crossText: "#FBBF24", dot: "#111A2B" },
};

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: YearPoint }>;
  crossYears: Set<number>;
}

function ChartTooltip({ active, payload, crossYears }: TipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const leader = p.diff > 0 ? "נדל״ן" : "S&P 500";
  return (
    <div dir="rtl" className="min-w-[210px] rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-bold text-slate-900">{p.year === 0 ? "יום הרכישה" : `שנה ${p.year}`}</span>
        {crossYears.has(p.year) && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <Repeat size={11} /> נקודת המהפך
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <Row color={RE} label="קונים דירה" value={p.realEstate} />
        <Row color={SP} label="S&P 500" value={p.sp500} />
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
        {Math.abs(p.diff) < 1 ? (
          "תיקו"
        ) : (
          <>
            {leader} מוביל ב-<span className="font-semibold text-slate-800">{formatILS(Math.abs(p.diff))}</span>
          </>
        )}
        <div className="mt-0.5">
          שווי דירה {formatCompactILS(p.propertyValue)} · יתרת משכנתא {formatCompactILS(p.mortgageBalance)}
        </div>
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-slate-600">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-slate-900">{formatILS(value)}</span>
    </div>
  );
}

export default function GrowthChart({ result, dark = false }: { result: SimResult; dark?: boolean }) {
  const pal = dark ? PALETTE.dark : PALETTE.light;
  const [view, setView] = useState<"chart" | "table">("chart");
  const { points, crossovers } = result;
  const crossYears = new Set(crossovers.map((c) => c.year));
  const mainCross = crossovers[crossovers.length - 1];
  const last = points[points.length - 1];
  const tickInterval = points.length > 21 ? 4 : points.length > 11 ? 1 : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">שווי נטו לאורך השנים</h3>
          <p className="mt-0.5 text-[13px] text-slate-500">כמה היה נשאר בכיס אילו הכול היה נמכר בסוף כל שנה (אחרי מסים ומשכנתא)</p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="תצוגה">
          {(
            [
              ["chart", "גרף", <BarChart3 key="c" size={14} />],
              ["table", "טבלה", <Table2 key="t" size={14} />],
            ] as const
          ).map(([v, label, icon]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend doubling as direct labels (final values) */}
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="h-0.5 w-4 rounded" style={{ background: RE }} />
          קונים דירה <span className="font-semibold text-slate-900">{formatCompactILS(last.realEstate)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="h-0.5 w-4 rounded" style={{ background: SP }} />
          S&P 500 <span className="font-semibold text-slate-900">{formatCompactILS(last.sp500)}</span>
        </span>
        {mainCross && (
          <span className="flex items-center gap-1.5 text-amber-700">
            <Repeat size={12} />
            נקודת המהפך: שנה {mainCross.year} ({mainCross.leader === "realEstate" ? "הנדל״ן עוקף" : "ה-S&P עוקף"})
          </span>
        )}
      </div>

      {view === "chart" ? (
        <div
          className="h-[280px] w-full sm:h-[360px]"
          dir="ltr"
          role="img"
          aria-label={`גרף שווי נטו לאורך ${last.year} שנים. בסוף: דירה ${formatILS(last.realEstate)}, S&P 500 ${formatILS(last.sp500)}. המספרים לכל שנה בכפתור טבלה.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gRE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pal.re} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={pal.re} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pal.sp} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={pal.sp} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={pal.grid} />
              {/* RTL: time flows right → left, value axis on the right */}
              <XAxis
                dataKey="year"
                reversed
                tickLine={false}
                axisLine={{ stroke: pal.axis }}
                tick={{ fill: pal.tick, fontSize: 12 }}
                interval={tickInterval}
                tickFormatter={(y: number) => (y === 0 ? "היום" : String(y))}
              />
              <YAxis
                orientation="right"
                width={62}
                tickLine={false}
                axisLine={false}
                tick={{ fill: pal.tick, fontSize: 12 }}
                tickFormatter={(v: number) => formatCompactILS(v)}
              />
              <Tooltip
                cursor={{ stroke: pal.cursor, strokeWidth: 1, strokeDasharray: "4 4" }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    payload={props.payload as TipProps["payload"]}
                    crossYears={crossYears}
                  />
                )}
              />
              {crossovers.map((c) => (
                <ReferenceLine
                  key={c.year}
                  x={c.year}
                  stroke={pal.cross}
                  strokeDasharray="4 4"
                  label={{ value: "נקודת המהפך", position: "top", fill: pal.crossText, fontSize: 11, fontWeight: 600 }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="sp500"
                name="S&P 500"
                stroke={pal.sp}
                strokeWidth={2}
                fill="url(#gSP)"
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: pal.dot, strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="realEstate"
                name="קונים דירה"
                stroke={pal.re}
                strokeWidth={2}
                fill="url(#gRE)"
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: pal.dot, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-right font-medium">שנה</th>
                <th className="px-3 py-2 text-right font-medium">דירה (נטו)</th>
                <th className="px-3 py-2 text-right font-medium">S&P 500 (נטו)</th>
                <th className="px-3 py-2 text-right font-medium">הפרש</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((p) => (
                <tr key={p.year} className={`border-t border-slate-100 ${crossYears.has(p.year) ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-1.5 text-slate-600">{p.year === 0 ? "היום" : p.year}</td>
                  <td className="px-3 py-1.5 font-medium text-slate-900">{formatILS(p.realEstate)}</td>
                  <td className="px-3 py-1.5 font-medium text-slate-900">{formatILS(p.sp500)}</td>
                  <td className={`px-3 py-1.5 font-semibold ${p.diff >= 0 ? "text-re-ink" : "text-sp-ink"}`}>
                    {formatILS(p.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
