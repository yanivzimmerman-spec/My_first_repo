"use client";

import type { SimResult } from "@/lib/calculator";
import { formatCompactILS, formatILS, formatPct } from "@/lib/format";
import { topReasons } from "@/lib/insights";

export interface BreakEven {
  value: number | null;
  below: boolean;
}

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
function breakEvenText(r: SimResult, be: BreakEven): string {
  const assumed = formatPct(r.inputs.appreciation, 1);
  if (be.value === null) {
    return be.below
      ? "הדירה מנצחת גם אם מחירי הדירות לא יעלו בכלל, ואפילו ירדו 2% בשנה."
      : "גם אם מחירי הדירות יעלו ב-10% בשנה, ה-S&P עדיין ינצח.";
  }
  const v = formatPct(be.value, 1);
  return r.winner === "realEstate"
    ? `הדירה מנצחת כל עוד המחירים עולים ביותר מ-${v} בשנה. הנחתם ${assumed}.`
    : `הדירה תנצח רק אם המחירים יעלו ביותר מ-${v} בשנה. הנחתם ${assumed}.`;
}

export default function VerdictBanner({ result, breakEven }: { result: SimResult; breakEven: BreakEven }) {
  const r = result;
  const max = Math.max(r.realEstate.netWorth, r.sp500.netWorth);
  const winInk = r.winner === "realEstate" ? "#4338CA" : r.winner === "sp500" ? "#047857" : "#0F172A";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" aria-live="polite">
      <p className="text-[13px] font-semibold text-slate-500">התשובה</p>
      <h2 className="mt-1 text-2xl font-bold leading-snug text-slate-900 [text-wrap:balance] sm:text-[28px]">
        {r.winner === "tie" ? (
          verdictText(r)
        ) : (
          <>
            בטווח של {r.inputs.years} שנה,{" "}
            <span className="whitespace-nowrap" style={{ color: winInk }}>{r.winner === "realEstate" ? "הדירה" : "ה-S&P 500"}</span>{" "}
            {r.winner === "realEstate" ? "משאירה" : "משאיר"} לכם{" "}
            <span className="whitespace-nowrap" style={{ color: winInk }}>{formatCompactILS(r.difference)}</span> יותר
          </>
        )}
      </h2>
      <p className="mt-1 text-[14px] text-slate-500">שווי נטו ביום המכירה, אחרי כל המסים וסילוק המשכנתא{r.realEstate.extraLoanPrincipal > 0 ? " וההלוואה" : ""}</p>

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

      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="text-[13px] font-semibold text-slate-500">למה זה יצא ככה?</h3>
        <ul className="mt-3 space-y-2.5">
          {topReasons(r).map((reason, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-slate-700">
              <span
                className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: reason.favors === "realEstate" ? "#4F46E5" : "#10B981" }}
                aria-label={reason.favors === "realEstate" ? "לטובת הדירה" : "לטובת ה-S&P"}
              />
              <span>{reason.text(formatCompactILS)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[14px] font-medium leading-relaxed text-slate-800">
          {breakEvenText(r, breakEven)}
        </p>
      </div>
    </section>
  );
}
