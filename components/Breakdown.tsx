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
  if (v === null) return <span className="text-slate-300">—</span>;
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
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-right sm:px-7"
      >
        <span>
          <span className="block text-lg font-bold text-slate-900">איך הגענו למספרים?</span>
          <span className="block text-[13px] text-slate-500">פירוט מלא: השקעה, מסים, משכנתא ושווי סופי</span>
        </span>
        <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="overflow-x-auto px-3 pb-5 sm:px-7 sm:pb-7">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="w-[44%] px-2 py-2 text-right font-medium"></th>
                <th className="px-2 py-2 text-right font-semibold text-re-ink">דירה להשקעה</th>
                <th className="px-2 py-2 text-right font-semibold text-sp-ink">S&P 500</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title} className="tabular-nums">
                <tr>
                  <td colSpan={3} className="px-2 pb-1 pt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                    {g.title}
                  </td>
                </tr>
                {g.lines.map((l) => (
                  <tr key={l.label} className={`border-t border-slate-100 ${l.strong ? "bg-slate-50/80 font-semibold" : ""}`}>
                    <td className="px-2 py-2 text-slate-600">
                      {l.label}
                      {l.note && <span className="block text-[11px] font-normal text-slate-400">{l.note}</span>}
                    </td>
                    <td className={`px-2 py-2 ${l.negative && typeof l.re === "number" && l.re > 0.5 ? "text-rose-600" : "text-slate-900"}`}>
                      {cell(l.re, l.negative)}
                    </td>
                    <td className={`px-2 py-2 ${l.negative && typeof l.sp === "number" && l.sp > 0.5 ? "text-rose-600" : "text-slate-900"}`}>
                      {cell(l.sp, l.negative)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tbody>
              <tr className="border-t-2 border-slate-900">
                <td className="px-2 py-3 font-bold text-slate-900">שווי נטו בכיס</td>
                <td className="px-2 py-3 text-base font-extrabold text-re-ink tabular-nums">{formatILS(re.netWorth)}</td>
                <td className="px-2 py-3 text-base font-extrabold text-sp-ink tabular-nums">{formatILS(sp.netWorth)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 px-2 text-[11px] leading-relaxed text-slate-400">
            הנחות: מס רכישה לפי מדרגות 2025 · פטור על שכירות עד ₪5,654 לחודש (צמוד למדד), מעליו מסלול 10% · מס שבח ומס רווחי
            הון 25% על רווח ריאלי (בניכוי אינפלציה של {result.inputs.inflation}% בשנה) · דמי ניהול מנוכים מהתשואה.
          </p>
        </div>
      )}
    </div>
  );
}
