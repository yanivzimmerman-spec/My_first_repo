"use client";

import type { SimResult } from "@/lib/calculator";
import { formatILS, formatPct } from "@/lib/format";

export function verdictText(r: SimResult): string {
  const y = r.inputs.years;
  if (r.winner === "tie") return `בטווח של ${y} שנה, שני המסלולים מסתיימים כמעט בתיקו`;
  const name = r.winner === "realEstate" ? "הנדל״ן" : "ה-S&P 500";
  return `בטווח של ${y} שנה, מסלול ${name} מנצח ב-${formatILS(Math.round(r.difference / 1000) * 1000)} נטו בכיס`;
}

/** One column of the "market close" quote board. */
function Quote({
  code,
  name,
  color,
  ink,
  net,
  cash,
  ret,
  winner,
}: {
  code: string;
  name: string;
  color: string;
  ink: string;
  net: number;
  cash: number;
  ret: number;
  winner: boolean;
}) {
  const up = ret >= 0;
  return (
    <div className="min-w-0 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span dir="ltr" className="px-1.5 py-0.5 font-mono text-[11px] font-bold text-white" style={{ background: color }}>
            {code}
          </span>
          <span className="text-sm font-bold text-ink">{name}</span>
        </span>
        {winner && <span className="bg-ink px-2 py-0.5 text-[11px] font-bold text-paper">★ מנצח</span>}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">שווי נטו לאחר מס וכיסוי משכנתא</p>
      <p className="mt-0.5 font-mono text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">
        {formatILS(net)}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span dir="ltr" className="font-mono text-[14px] font-semibold" style={{ color: up ? ink : "var(--color-down)" }}>
          {up ? "▲" : "▼"} {up ? "+" : ""}
          {formatPct(ret, 0)}
        </span>
        <span>
          הושקעו <span className="font-mono font-medium text-ink-2">{formatILS(cash)}</span>
        </span>
      </div>
    </div>
  );
}

export default function VerdictBanner({ result }: { result: SimResult }) {
  const r = result;
  const lo = Math.min(r.realEstate.netWorth, r.sp500.netWorth);
  const hi = Math.max(r.realEstate.netWorth, r.sp500.netWorth);
  const multiple = lo > 0 ? hi / lo : NaN;

  return (
    <article>
      <div className="border-t-4 border-ink pt-3">
        <p className="text-[12px] font-bold tracking-wide text-ink-2">השורה התחתונה · הון עצמי {formatILS(r.inputs.equity)}</p>
        <h2 className="mt-2 font-serif text-[30px] font-black leading-[1.12] text-ink [text-wrap:balance] sm:text-[42px] lg:text-[48px]">
          {verdictText(r)}
        </h2>
        {r.winner !== "tie" && Number.isFinite(multiple) && (
          <p className="mt-3 max-w-[60ch] font-serif text-[17px] font-medium leading-relaxed text-ink-2 sm:text-[19px]">
            פי {multiple.toFixed(2)} יותר כסף ביום המכירה, אחרי מס רכישה, מס שבח, מס רווחי הון וסילוק המשכנתא.
          </p>
        )}
      </div>
      <div className="mt-5 grid border-y border-ink sm:grid-cols-2">
        <div className="border-b border-hair sm:border-b-0 sm:border-l sm:pl-5">
          <Quote
            code="RE"
            name="דירה להשקעה"
            color="var(--color-re)"
            ink="var(--color-re-ink)"
            net={r.realEstate.netWorth}
            cash={r.realEstate.totalCashInvested}
            ret={r.realEstate.totalReturnPct}
            winner={r.winner === "realEstate"}
          />
        </div>
        <div className="sm:pr-5">
          <Quote
            code="SPX"
            name="S&P 500"
            color="var(--color-sp-ink)"
            ink="var(--color-sp-ink)"
            net={r.sp500.netWorth}
            cash={r.sp500.totalCashInvested}
            ret={r.sp500.totalReturnPct}
            winner={r.winner === "sp500"}
          />
        </div>
      </div>
    </article>
  );
}
