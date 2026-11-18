"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SimResult } from "@/lib/calculator";
import { formatILS } from "@/lib/format";

type Cell = number | string | null;
interface Line {
  label: string;
  re: Cell;
  sp: Cell;
  note?: string;
  negative?: boolean;
  strong?: boolean;
}

function cell(v: Cell, negative?: boolean) {
  if (v === null) return <span className="text-hair">—</span>;
  if (typeof v === "string") return v;
  if (Math.abs(v) < 0.5) return formatILS(0);
  return negative ? `−${formatILS(Math.abs(v))}` : formatILS(v);
}

export default function Breakdown({ result }: { result: SimResult }) {
  const [open, setOpen] = useState(false);
  const re = result.realEstate;
  const sp = result.sp500;
  const matching = result.inputs.cashflowMatching;

  const groups: { title: string; lines: Line[] }[] = [
    {
      title: "כסף שהושקע",
      lines: [
        { label: "הון עצמי התחלתי", re: result.inputs.equity, sp: sp.initialInvestment },
        {
          label: "השלמות חודשיות מהכיס",
          re: re.outOfPocketContributions,
          sp: sp.monthlyContributionsTotal,
          note: matching ? "פער משכנתא מול שכירות" : "ההשלמה כבויה — ה-S&P לא מקבל הפקדות",
        },
        { label: "סך מזומן שהושקע", re: re.totalCashInvested, sp: sp.totalCashInvested, strong: true },
      ],
    },
    {
      title: "עלויות ומסים בדרך",
      lines: [
        { label: "מס רכישה", re: re.purchaseTax, sp: null, negative: true },
        { label: "עו״ד, תיווך, שמאי (2%)", re: re.closingCosts, sp: null, negative: true },
        { label: "ריבית משכנתא ששולמה", re: re.totalInterestPaid, sp: null, negative: true, note: "כלולה בהחזרים החודשיים" },
        { label: "הכנסות שכירות (ברוטו)", re: re.totalRentGross, sp: null },
        { label: "מס על שכירות", re: re.totalRentTax, sp: null, negative: true },
      ],
    },
    {
      title: `ביום המכירה (שנה ${result.inputs.years})`,
      lines: [
        { label: "שווי הנכס / תיק ההשקעות", re: re.finalPropertyValue, sp: sp.grossValue },
        { label: "יתרת משכנתא שנותרה", re: re.remainingMortgage, sp: null, negative: true },
        ...(re.sideFundValue > 0.5
          ? [{ label: "תיק מדד מעודפי שכירות", re: re.sideFundValue, sp: null, note: "עודפי שכ״ד שהושקעו במדד" } as Line]
          : []),
        ...(re.idleCash > 0.5 ? [{ label: "עודפי שכירות במזומן", re: re.idleCash, sp: null } as Line] : []),
        {
          label: "תשואה ברוטו (לפני מסי מכירה)",
          re: re.grossGain,
          sp: sp.grossGain,
          strong: true,
        },
        { label: "עלויות מכירה (1%)", re: re.sellingCosts, sp: null, negative: true },
        {
          label: "מס שבח",
          re: re.shevachExempt ? "פטור (דירה יחידה)" : re.shevachTax,
          sp: null,
          negative: true,
          note: re.shevachExempt ? undefined : "25% על הרווח הריאלי",
        },
        {
          label: "מס רווחי הון ריאלי (25%)",
          re: re.sideFundTax > 0.5 ? re.sideFundTax : null,
          sp: sp.capitalGainsTax,
          negative: true,
        },
      ],
    },
  ];

  return (
    <section className="border-t-4 border-ink">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-end justify-between gap-3 border-b border-ink py-3 text-right"
      >
        <span>
          <span className="block font-serif text-[24px] font-black leading-tight text-ink sm:text-[28px]">איך הגענו למספרים?</span>
          <span className="mt-1 block text-[13px] text-ink-3">פירוט מלא: השקעה, מסים, משכנתא ושווי סופי</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink">
          {open ? "סגירה" : "לפירוט המלא"}
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[460px] text-[14px]">
            <thead>
              <tr className="border-b border-hair text-[12px]">
                <th className="w-[44%] py-2.5 text-right font-medium"></th>
                <th className="py-2.5 text-right">
                  <span dir="ltr" className="ml-1.5 bg-re px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">RE</span>
                  <span className="font-bold text-ink">דירה להשקעה</span>
                </th>
                <th className="py-2.5 text-right">
                  <span dir="ltr" className="ml-1.5 bg-sp-ink px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">SPX</span>
                  <span className="font-bold text-ink">S&P 500</span>
                </th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title}>
                <tr>
                  <td colSpan={3} className="pb-1 pt-5 font-serif text-[15px] font-bold text-ink">
                    {g.title}
                  </td>
                </tr>
                {g.lines.map((l) => (
                  <tr key={l.label} className={`border-t border-hair ${l.strong ? "bg-paper-2/70 font-semibold" : ""}`}>
                    <td className="py-2 pl-2 text-ink-2">
                      {l.label}
                      {l.note && <span className="block text-[11.5px] font-normal text-ink-3">{l.note}</span>}
                    </td>
                    <td
                      className={`py-2 font-mono tabular-nums ${typeof l.re === "string" ? "font-sans text-[13px]" : ""} ${
                        l.negative && typeof l.re === "number" && l.re > 0.5 ? "text-down" : "text-ink"
                      }`}
                    >
                      {cell(l.re, l.negative)}
                    </td>
                    <td
                      className={`py-2 font-mono tabular-nums ${
                        l.negative && typeof l.sp === "number" && l.sp > 0.5 ? "text-down" : "text-ink"
                      }`}
                    >
                      {cell(l.sp, l.negative)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tbody>
              <tr className="border-y-2 border-ink">
                <td className="py-3 font-serif text-[16px] font-black text-ink">שווי נטו בכיס</td>
                <td className="py-3 font-mono text-[16px] font-bold tabular-nums text-re-ink">{formatILS(re.netWorth)}</td>
                <td className="py-3 font-mono text-[16px] font-bold tabular-nums text-sp-ink">{formatILS(sp.netWorth)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
            הנחות: מס רכישה לפי מדרגות 2025 · פטור על שכירות עד ₪5,654 לחודש (צמוד למדד), מעליו מסלול 10% · מס שבח ומס רווחי
            הון 25% על רווח ריאלי (בניכוי אינפלציה של {result.inputs.inflation}% בשנה) · דמי ניהול מנוכים מהתשואה.
          </p>
        </div>
      )}
    </section>
  );
}
