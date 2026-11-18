"use client";

import { Trophy, Building2, LineChart, Scale } from "lucide-react";
import type { SimResult } from "@/lib/calculator";
import { formatILS, formatPct } from "@/lib/format";

export function verdictText(r: SimResult): string {
  const y = r.inputs.years;
  if (r.winner === "tie") return `בטווח של ${y} שנה, שני המסלולים מסתיימים כמעט בתיקו`;
  const name = r.winner === "realEstate" ? "הנדל״ן" : "ה-S&P 500";
  return `בטווח של ${y} שנה, מסלול ${name} מנצח ב-${formatILS(Math.round(r.difference / 1000) * 1000)} נטו בכיס`;
}

function TrackCard({
  title,
  icon,
  color,
  ink,
  soft,
  net,
  cash,
  ret,
  winner,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  ink: string;
  soft: string;
  net: number;
  cash: number;
  ret: number;
  winner: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: winner ? color : "#E2E8F0", boxShadow: winner ? `0 0 0 1px ${color}` : undefined }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: soft, color: ink }}>
            {icon}
          </span>
          {title}
        </span>
        {winner && (
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ background: soft, color: ink }}
          >
            <Trophy size={12} /> מנצח
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">שווי נטו לאחר מס וכיסוי משכנתא</p>
      <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{formatILS(net)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          תשואה כוללת{" "}
          <span className="font-bold" style={{ color: ret >= 0 ? ink : "#B91C1C" }}>
            <bdi>
              {ret >= 0 ? "+" : ""}
              {formatPct(ret, 0)}
            </bdi>
          </span>
        </span>
        <span>
          הושקעו <span className="font-semibold text-slate-700">{formatILS(cash)}</span>
        </span>
      </div>
    </div>
  );
}

export default function VerdictBanner({ result }: { result: SimResult }) {
  const r = result;
  const color = r.winner === "realEstate" ? "#4F46E5" : r.winner === "sp500" ? "#10B981" : "#64748B";
  const multiple =
    r.winner !== "tie" ? Math.max(r.realEstate.netWorth, r.sp500.netWorth) / Math.max(1, Math.min(r.realEstate.netWorth, r.sp500.netWorth)) : 1;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white sm:p-6">
        <div
          className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
          style={{ background: color }}
        />
        <div className="relative flex items-start gap-3">
          <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}33`, color }}>
            {r.winner === "tie" ? <Scale size={20} /> : <Trophy size={20} />}
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">השורה התחתונה</p>
            <h2 className="mt-1 text-xl font-extrabold leading-snug sm:text-2xl lg:text-[28px]">{verdictText(r)}</h2>
            {r.winner !== "tie" && Number.isFinite(multiple) && r.realEstate.netWorth > 0 && r.sp500.netWorth > 0 && (
              <p className="mt-1.5 text-sm text-slate-300">
                פי {multiple.toFixed(2)} יותר כסף ביום המכירה, אחרי כל המסים וסילוק המשכנתא.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TrackCard
          title="דירה להשקעה"
          icon={<Building2 size={16} />}
          color="#4F46E5"
          ink="#4338CA"
          soft="#EEF2FF"
          net={r.realEstate.netWorth}
          cash={r.realEstate.totalCashInvested}
          ret={r.realEstate.totalReturnPct}
          winner={r.winner === "realEstate"}
        />
        <TrackCard
          title="S&P 500"
          icon={<LineChart size={16} />}
          color="#10B981"
          ink="#047857"
          soft="#ECFDF5"
          net={r.sp500.netWorth}
          cash={r.sp500.totalCashInvested}
          ret={r.sp500.totalReturnPct}
          winner={r.winner === "sp500"}
        />
      </div>
    </div>
  );
}
