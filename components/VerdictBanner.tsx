"use client";

import type { SimResult } from "@/lib/calculator";
import { formatILS, formatPct } from "@/lib/format";

export function verdictText(r: SimResult): string {
  const y = r.inputs.years;
  if (r.winner === "tie") return `בטווח של ${y} שנה, שני המסלולים מסתיימים כמעט בתיקו`;
  const name = r.winner === "realEstate" ? "הנדל״ן" : "ה-S&P 500";
  return `בטווח של ${y} שנה, מסלול ${name} מנצח ב-${formatILS(Math.round(r.difference / 1000) * 1000)} נטו בכיס`;
}

function Bar({
  label,
  value,
  ret,
  max,
  color,
  ink,
  winner,
}: {
  label: string;
  value: number;
  ret: number;
  max: number;
  color: string;
  ink: string;
  winner: boolean;
}) {
  const w = max > 0 ? Math.max(2, (Math.max(0, value) / max) * 100) : 2;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className={`text-[15px] ${winner ? "font-semibold text-slate-900" : "text-slate-600"}`}>{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs tabular-nums" style={{ color: ret >= 0 ? ink : "#B91C1C" }}>
            <bdi>
              {ret >= 0 ? "+" : ""}
              {formatPct(ret, 0)}
            </bdi>
          </span>
          <span className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{formatILS(value)}</span>
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}

/** The answer: one sentence, two bars, three facts. */
export default function VerdictBanner({ result }: { result: SimResult }) {
  const r = result;
  const max = Math.max(r.realEstate.netWorth, r.sp500.netWorth);
  const winInk = r.winner === "realEstate" ? "#4338CA" : r.winner === "sp500" ? "#047857" : "#0F172A";
  const cross = r.crossovers[r.crossovers.length - 1];
  const sameCash = Math.abs(r.realEstate.totalCashInvested - r.sp500.totalCashInvested) < 1;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" aria-live="polite">
      <p className="text-[13px] font-semibold text-slate-500">התשובה</p>
      <h2 className="mt-1 text-2xl font-bold leading-snug text-slate-900 [text-wrap:balance] sm:text-[28px]">
        {r.winner === "tie" ? (
          verdictText(r)
        ) : (
          <>
            בטווח של {r.inputs.years} שנה,{" "}
            <span style={{ color: winInk }}>{r.winner === "realEstate" ? "הדירה" : "ה-S&P 500"}</span>{" "}
            {r.winner === "realEstate" ? "משאירה" : "משאיר"} לכם{" "}
            <span style={{ color: winInk }}>{formatILS(Math.round(r.difference / 1000) * 1000)}</span> יותר
          </>
        )}
      </h2>
      <p className="mt-1 text-[14px] text-slate-500">שווי נטו ביום המכירה, אחרי כל המסים וסילוק המשכנתא</p>

      <div className="mt-6 space-y-5">
        <Bar
          label="דירה להשקעה"
          value={r.realEstate.netWorth}
          ret={r.realEstate.totalReturnPct}
          max={max}
          color="#4F46E5"
          ink="#4338CA"
          winner={r.winner === "realEstate"}
        />
        <Bar
          label="S&P 500"
          value={r.sp500.netWorth}
          ret={r.sp500.totalReturnPct}
          max={max}
          color="#10B981"
          ink="#047857"
          winner={r.winner === "sp500"}
        />
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">{sameCash ? "השקעתם בכל מסלול" : "השקעתם (דירה / S&P)"}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
            {sameCash ? (
              formatILS(r.realEstate.totalCashInvested)
            ) : (
              <>
                {formatILS(r.realEstate.totalCashInvested)} / {formatILS(r.sp500.totalCashInvested)}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">מסים ששולמו (דירה / S&P)</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
            {formatILS(r.realEstate.purchaseTax + r.realEstate.totalRentTax + r.realEstate.shevachTax + r.realEstate.sideFundTax)} /{" "}
            {formatILS(r.sp500.capitalGainsTax)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">נקודת המהפך</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {cross
              ? `שנה ${cross.year}: ${cross.leader === "realEstate" ? "הדירה עוקפת" : "ה-S&P עוקף"}`
              : "אין, מוביל אחד לאורך כל הדרך"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
