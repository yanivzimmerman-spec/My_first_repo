"use client";

import type { SimResult } from "@/lib/calculator";
import { formatCompactILS, formatILS, formatPct } from "@/lib/format";
import { topReasons } from "@/lib/insights";
import { track } from "@/lib/track";
import SimNote from "./SimNote";
import RuleWarnings from "./RuleWarnings";
import { verdictOf, verdictSentence, HISTORIC_APPRECIATION, TIE_SHARE, type Verdict } from "@/lib/verdict";

export interface BreakEven {
  value: number | null;
  below: boolean;
}

/** Share text: the same sentence as the card, in today's money. */
export function verdictText(r: SimResult): string {
  return verdictSentence(verdictOf(r), r.inputs.years, (n) => formatILS(Math.round(n / 1000) * 1000));
}

/** "The number to remember": break-even yearly price growth, and the crossover year. */
function KeyNumbers({ r, v, breakEven }: { r: SimResult; v: Verdict; breakEven: BreakEven }) {
  const assumed = formatPct(r.inputs.appreciation, 1);
  const be =
    breakEven.value !== null
      ? formatPct(breakEven.value, 1)
      : breakEven.below
        ? "גם בירידה"
        : "יותר מ-10%";
  const beNote =
    breakEven.value !== null
      ? `הדירה מובילה אם המחירים עולים יותר מזה. הנחתם ${assumed}; ב-25 השנים האחרונות כ-${formatPct(HISTORIC_APPRECIATION, 1)}.`
      : breakEven.below
        ? "הדירה מובילה גם אם המחירים לא עולים בכלל."
        : `גם עלייה של 10% בשנה לא מספיקה לדירה. הנחתם ${assumed}.`;
  const crossName = r.crossovers.length ? (r.crossovers[r.crossovers.length - 1].leader === "realEstate" ? "הדירה" : "ה-S&P 500") : "";
  return (
    <dl className="mt-5 grid gap-2.5 sm:grid-cols-2">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <dt className="text-[12.5px] font-semibold text-slate-600">נקודת האיזון: עליית מחירים בשנה</dt>
        <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900">
          <bdi>{be}</bdi>
        </dd>
        <dd className="mt-0.5 text-[12.5px] leading-snug text-slate-600">{beNote}</dd>
      </div>
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <dt className="text-[12.5px] font-semibold text-slate-600">שנת החצייה</dt>
        <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900">{v.crossYear ? `שנה ${v.crossYear}` : "אין"}</dd>
        <dd className="mt-0.5 text-[12.5px] leading-snug text-slate-600">
          {v.crossYear ? `מאז ${crossName} מוביל עד הסוף.` : "אותו מסלול מוביל לאורך כל התקופה."}
        </dd>
      </div>
    </dl>
  );
}

function Bar({
  label,
  value,
  today,
  ret,
  max,
  color,
  ink,
  winner,
}: {
  label: string;
  /** Nominal, in shekels of the sale year */
  value: number;
  /** The same in today's money (shown first) */
  today: number;
  ret: number;
  max: number;
  color: string;
  ink: string;
  winner: boolean;
}) {
  const w = max > 0 ? Math.max(2, (Math.max(0, today) / max) * 100) : 2;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className={`text-[15px] ${winner ? "font-semibold text-slate-900" : "text-slate-600"}`}>{label}</span>
        <span className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{formatILS(today)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${w}%`, background: color }} />
      </div>
      <p className="mt-1 text-[12px] text-slate-500">
        בשקלים של שנת המכירה: {formatCompactILS(value)}{" "}
        <span className="tabular-nums" style={{ color: ret >= 0 ? ink : "var(--ink-neg)" }}>
          <bdi>
            ({ret >= 0 ? "+" : ""}
            {formatPct(ret, 0)})
          </bdi>
        </span>
      </p>
    </div>
  );
}

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

function breakEvenRentText(r: SimResult, be: BreakEven): string | null {
  if (be.value === null) return null;
  const v = formatILS(Math.round(be.value / 10) * 10);
  const now = formatILS(Math.round(r.realEstate.initialMonthlyRentGross / 10) * 10);
  const what = r.realEstate.livesInNew ? "שכר הדירה שנחסך" : "שכר הדירה";
  return r.winner === "realEstate"
    ? `או כל עוד ${what} גבוה מ-${v} בחודש (הנחתם ${now}).`
    : `או אם ${what} יהיה מעל ${v} בחודש (הנחתם ${now}).`;
}

/** The answer: one sentence, two bars, reasons, break-even, link to the mixed strategy. */
export default function VerdictBanner({
  result,
  breakEven,
  breakEvenRent,
  comboLink = true,
  guideLink = false,
  details = true,
  onRules,
}: {
  result: SimResult;
  breakEven: BreakEven;
  breakEvenRent: BreakEven;
  /** Show the "mix both" link (the planner draft has no combo page) */
  comboLink?: boolean;
  /** Show the link to the guided path */
  guideLink?: boolean;
  /** Reasons, break-even and links under the bars (the step-by-step version shows them in a menu) */
  details?: boolean;
  /** Open the "how it's calculated" page from the rules notice */
  onRules?: () => void;
}) {
  const r = result;
  const v = verdictOf(r);
  const max = Math.max(v.reReal, v.spReal);
  const ink = v.kind === "realEstate" ? "var(--ink-re)" : v.kind === "sp500" ? "var(--ink-sp)" : "var(--accent-ink)";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" aria-live="polite" aria-labelledby="verdict-word">
      <p className="text-[13px] font-semibold text-slate-500">התוצאה לפי ההנחות</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="verdict-word" className="text-[40px] font-extrabold leading-none tracking-tight sm:text-5xl" style={{ color: ink }}>
          {v.word}
        </h2>
        <p className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
          {v.kind === "tie" ? "פער של " : "מוביל ב-"}
          {formatCompactILS(v.gapReal)}
          <span className="ms-1.5 text-[14px] font-medium text-slate-500">בערכי היום</span>
        </p>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{verdictSentence(v, r.inputs.years, formatCompactILS)}</p>
      <SimNote />
      <KeyNumbers r={r} v={v} breakEven={breakEven} />

      <div className="mt-6 space-y-5">
        <Bar
          label="קונים דירה"
          today={v.reReal}
          value={r.realEstate.netWorth}
          ret={r.realEstate.totalReturnPct}
          max={max}
          color="var(--bar-re)"
          ink="var(--ink-re)"
          winner={v.kind === "realEstate"}
        />
        <Bar
          label="S&P 500"
          today={v.spReal}
          value={r.sp500.netWorth}
          ret={r.sp500.totalReturnPct}
          max={max}
          color="var(--bar-sp)"
          ink="var(--ink-sp)"
          winner={v.kind === "sp500"}
        />
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
        שווי נטו ביום המכירה, אחרי כל המסים וסילוק המשכנתא{r.realEstate.extraLoanPrincipal > 0 ? " וההלוואה" : ""}, בערכי היום
        (אינפלציה {formatPct(r.inputs.inflation, 1)} בשנה). תיקו: פער של פחות מ-{Math.round(TIE_SHARE * 100)}% מהסכום הגבוה, כאן
        פחות מ-{formatCompactILS(v.tieLimit)}.
      </p>

      <RuleWarnings apartmentType={r.inputs.apartmentType} onRules={onRules} />
      {details && (
        <VerdictDetails result={r} breakEven={breakEven} breakEvenRent={breakEvenRent} comboLink={comboLink} guideLink={guideLink} />
      )}
    </section>
  );
}

/** Why it came out this way, the break-even sentence, and the links onward. */
export function VerdictDetails({
  result,
  breakEven,
  breakEvenRent,
  comboLink = true,
  guideLink = false,
  framed = true,
}: {
  result: SimResult;
  breakEven: BreakEven;
  breakEvenRent: BreakEven;
  comboLink?: boolean;
  guideLink?: boolean;
  /** Divider above (inside the answer card) */
  framed?: boolean;
}) {
  const r = result;
  return (
    <div className={framed ? "mt-6 border-t border-slate-100 pt-5" : ""}>
        {framed && <h3 className="text-[13px] font-semibold text-slate-500">למה זה יצא ככה?</h3>}
        <ul className={`${framed ? "mt-3 " : ""}space-y-2.5`}>
          {topReasons(r).map((reason, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-slate-700">
              <span
                className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: reason.favors === "realEstate" ? "var(--bar-re)" : "var(--bar-sp)" }}
                role="img"
                aria-label={reason.favors === "realEstate" ? "לטובת הדירה" : "לטובת ה-S&P"}
              />
              <span>{reason.text(formatCompactILS)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[14px] font-medium leading-relaxed text-slate-800">
          {breakEvenText(r, breakEven)} {breakEvenRentText(r, breakEvenRent)}
        </p>
        {comboLink && (
        <a
          href="#combo"
          className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
        >
          רוצים לשלב? חלק בדירה וחלק במדד ←
        </a>
        )}
        {guideLink && (
          <a
            href="#plan"
            onClick={() => track({ type: "guideLink" })}
            className="mt-2.5 flex items-center gap-1.5 text-[14px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
          >
            ומה עכשיו? לבדוק את הבסיס ולקבל סיכום מסודר ←
          </a>
        )}
      </div>
  );
}
