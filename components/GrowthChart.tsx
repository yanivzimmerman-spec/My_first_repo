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
import type { SimResult, YearPoint } from "@/lib/calculator";
import { formatCompactILS, formatILS } from "@/lib/format";

// Validated for the dark terminal surface (#0E1110): lightness band, CVD, contrast.
const RE = "#7C78FF";
const SP = "#10A97C";
const AMBER = "#F2A93B";
const GRID = "#222825";
const DIM = "#8B958F";

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
    <div dir="rtl" className="min-w-[220px] border border-term-line bg-term-2/95 p-3 text-[13px] text-term-text shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-term-line pb-2">
        <span className="font-bold">{p.year === 0 ? "יום הרכישה" : `שנה ${p.year}`}</span>
        {crossYears.has(p.year) && (
          <span className="bg-amber px-1.5 py-0.5 text-[10.5px] font-bold text-term">נקודת המהפך</span>
        )}
      </div>
      <div className="space-y-1.5">
        <Row color={RE} code="RE" label="דירה" value={p.realEstate} />
        <Row color={SP} code="SPX" label="S&P 500" value={p.sp500} />
      </div>
      <div className="mt-2 border-t border-term-line pt-2 text-[11.5px] text-term-dim">
        {Math.abs(p.diff) < 1 ? (
          "תיקו"
        ) : (
          <>
            {leader} מוביל ב-<span className="font-mono font-semibold text-amber">{formatILS(Math.abs(p.diff))}</span>
          </>
        )}
        <div className="mt-0.5">
          שווי דירה <span className="font-mono">{formatCompactILS(p.propertyValue)}</span> · יתרת משכנתא{" "}
          <span className="font-mono">{formatCompactILS(p.mortgageBalance)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ color, code, label, value }: { color: string; code: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-term-dim">
        <span className="h-0.5 w-3" style={{ background: color }} />
        <span dir="ltr" className="font-mono text-[10.5px]" style={{ color }}>
          {code}
        </span>
        {label}
      </span>
      <span className="font-mono font-semibold tabular-nums">{formatILS(value)}</span>
    </div>
  );
}

export default function GrowthChart({ result }: { result: SimResult }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const { points, crossovers } = result;
  const crossYears = new Set(crossovers.map((c) => c.year));
  const mainCross = crossovers[crossovers.length - 1];
  const last = points[points.length - 1];
  const tickInterval = points.length > 21 ? 4 : points.length > 11 ? 1 : 0;

  return (
    <section className="border border-term bg-term text-term-text shadow-[6px_6px_0_rgb(21_21_20/0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-term-line bg-term-2 px-4 py-2.5 sm:px-5">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[14px] font-bold">שווי נטו לאורך זמן</h3>
          <span dir="ltr" className="hidden font-mono text-[10.5px] tracking-wider text-term-dim sm:inline">
            NET WORTH · Y0–Y{result.inputs.years}
          </span>
        </div>
        <div className="flex border border-term-line font-mono text-[11px]" role="tablist" aria-label="תצוגה">
          {(
            [
              ["chart", "גרף"],
              ["table", "טבלה"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 font-sans font-semibold ${view === v ? "bg-amber text-term" : "text-term-dim hover:text-term-text"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-4 pt-3 sm:px-5">
        <p className="mb-3 text-[11.5px] text-term-dim">כמה היה נשאר בכיס אילו הכול היה נמכר בסוף כל שנה (אחרי מסים ומשכנתא)</p>

        {/* Legend doubling as direct labels (final values) */}
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
          <span className="flex items-center gap-2 text-term-dim">
            <span className="h-0.5 w-4" style={{ background: RE }} />
            דירה להשקעה <span className="font-mono font-semibold text-term-text">{formatCompactILS(last.realEstate)}</span>
          </span>
          <span className="flex items-center gap-2 text-term-dim">
            <span className="h-0.5 w-4" style={{ background: SP }} />
            S&P 500 <span className="font-mono font-semibold text-term-text">{formatCompactILS(last.sp500)}</span>
          </span>
          {mainCross && (
            <span className="flex items-center gap-2 text-amber">
              <span className="h-3 w-0 border-r border-dashed border-amber" />
              נקודת המהפך: שנה {mainCross.year} ({mainCross.leader === "realEstate" ? "הנדל״ן עוקף" : "ה-S&P עוקף"})
            </span>
          )}
        </div>

        {view === "chart" ? (
          <div className="h-[280px] w-full sm:h-[360px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RE} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={RE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SP} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SP} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
                {/* RTL: time flows right → left, value axis on the right */}
                <XAxis
                  dataKey="year"
                  reversed
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  tick={{ fill: DIM, fontSize: 11 }}
                  interval={tickInterval}
                  tickFormatter={(y: number) => (y === 0 ? "Y0" : `Y${y}`)}
                />
                <YAxis
                  orientation="right"
                  width={62}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: DIM, fontSize: 11 }}
                  tickFormatter={(v: number) => formatCompactILS(v)}
                />
                <Tooltip
                  cursor={{ stroke: AMBER, strokeWidth: 1, strokeDasharray: "3 3" }}
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
                    stroke={AMBER}
                    strokeDasharray="4 4"
                    label={{ value: "נקודת המהפך", position: "top", fill: AMBER, fontSize: 11, fontWeight: 600 }}
                  />
                ))}
                <Area
                  type="monotone"
                  dataKey="sp500"
                  name="S&P 500"
                  stroke={SP}
                  strokeWidth={2}
                  fill="url(#gSP)"
                  isAnimationActive={false}
                  activeDot={{ r: 5, stroke: "#0E1110", strokeWidth: 2, fill: SP }}
                />
                <Area
                  type="monotone"
                  dataKey="realEstate"
                  name="דירה להשקעה"
                  stroke={RE}
                  strokeWidth={2}
                  fill="url(#gRE)"
                  isAnimationActive={false}
                  activeDot={{ r: 5, stroke: "#0E1110", strokeWidth: 2, fill: RE }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="term-scroll max-h-[360px] overflow-auto border border-term-line">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-term-2 text-[11.5px] text-term-dim">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">שנה</th>
                  <th className="px-3 py-2 text-right font-medium">דירה (נטו)</th>
                  <th className="px-3 py-2 text-right font-medium">S&P 500 (נטו)</th>
                  <th className="px-3 py-2 text-right font-medium">הפרש</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {points.map((p) => (
                  <tr key={p.year} className={`border-t border-term-line ${crossYears.has(p.year) ? "bg-amber/10" : ""}`}>
                    <td className="px-3 py-1.5 text-term-dim">{p.year === 0 ? "Y0" : `Y${p.year}`}</td>
                    <td className="px-3 py-1.5">{formatILS(p.realEstate)}</td>
                    <td className="px-3 py-1.5">{formatILS(p.sp500)}</td>
                    <td className="px-3 py-1.5 font-semibold" style={{ color: p.diff >= 0 ? RE : SP }}>
                      {formatILS(p.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
