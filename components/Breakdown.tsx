"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SimResult } from "@/lib/calculator";
import { formatILS } from "@/lib/format";
import Sources from "./Sources";

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

  const loan = re.extraLoanPrincipal > 0;
  const groups: { title: string; lines: Line[] }[] = [
    {
      title: "כסף שהושקע",
      lines: [
        ...(re.oldHomeNetProceeds > 0
          ? [
              { label: "כסף מזומן", re: result.inputs.equity, sp: result.inputs.equity } as Line,
              {
                label: "מכירת הדירה הקיימת (נטו)",
                re: re.oldHomeNetProceeds,
                sp: re.oldHomeNetProceeds,
                note: "מחיר פחות עמלות ויתרת המשכנתא, בשני המסלולים",
              } as Line,
            ]
          : []),
        { label: "הון עצמי התחלתי", re: re.startCapital, sp: sp.initialInvestment },
        ...(loan
          ? [{ label: "הלוואה להון העצמי", re: re.extraLoanPrincipal, sp: null, note: "כסף מושאל, לא נספר כהשקעה שלכם" } as Line]
          : []),
        {
          label: "השלמות חודשיות מהכיס",
          re: re.outOfPocketContributions,
          sp: sp.monthlyContributionsTotal,
          note: matching
            ? "אותו סכום בשני המסלולים"
            : sp.loanPrincipal > 0
              ? "ההשקעה החודשית כבויה; ב-S&P רק החזרי ההלוואה"
              : "ההשקעה החודשית כבויה, ה-S&P לא מקבל הפקדות",
        },
        ...(sp.loanPrincipal > 0
          ? [{ label: "הלוואה להשקעה", re: null, sp: sp.loanPrincipal, note: "כסף מושאל, לא נספר כהשקעה שלכם" } as Line]
          : []),
        { label: "סך מזומן שהושקע", re: re.totalCashInvested, sp: sp.totalCashInvested, strong: true },
      ],
    },
    {
      title: "עלויות ומסים בדרך",
      lines: [
        { label: "מס רכישה", re: re.purchaseTax, sp: null, negative: true },
        {
          label: "עלויות קנייה",
          re: re.closingCosts,
          sp: null,
          negative: true,
          note: result.inputs.useBroker ? "תיווך, עו״ד, מע״מ, שמאי, יועץ" : "עו״ד, מע״מ, שמאי, יועץ",
        },
        {
          label: result.inputs.cpiShare > 0 ? "ריבית והצמדה על המשכנתא" : "ריבית משכנתא ששולמה",
          re: re.totalInterestPaid,
          sp: null,
          negative: true,
          note: "כלולה בהחזרים החודשיים",
        },
        ...(loan || sp.loanPrincipal > 0
          ? [
              {
                label: "ריבית על הלוואות",
                re: loan ? re.extraLoanInterestPaid : null,
                sp: sp.loanPrincipal > 0 ? sp.loanInterestPaid : null,
                negative: true,
              } as Line,
            ]
          : []),
        re.livesInNew
          ? { label: "שכר דירה שנחסך", re: re.totalRentGross, sp: null, note: "גרים בדירה; במסלול ה-S&P משלמים שכירות" }
          : { label: re.rentsOutOld ? "שכר דירה מהדירה הישנה (ברוטו)" : "שכר דירה (ברוטו)", re: re.totalRentGross, sp: null },
        ...(re.livesInNew
          ? []
          : [{ label: "חודשים פנויים", re: re.totalVacancyLoss, sp: null, negative: true, note: "חודש אחד בשנה" } as Line]),
        { label: "תחזוקה שוטפת", re: re.totalMaintenance, sp: null, negative: true, note: "8% משכר הדירה" },
        { label: "רזרבה לשיפוצים", re: re.totalCapex, sp: null, negative: true, note: `${result.inputs.capexRate}% משווי הדירה בשנה` },
        ...(re.totalVacancyCosts > 0.5
          ? [{ label: "ועד בית וארנונה בחודשים פנויים", re: re.totalVacancyCosts, sp: null, negative: true } as Line]
          : []),
        ...(re.totalManagement > 0.5
          ? [{ label: "דמי ניהול", re: re.totalManagement, sp: null, negative: true, note: `${result.inputs.managementFee}% משכר הדירה` } as Line]
          : []),
        { label: "ביטוח מבנה וחיים", re: re.totalInsurance, sp: null, negative: true, note: "ביטוח החיים יורד עם יתרת המשכנתא" },
        ...(re.rentsOutOld
          ? [
              {
                label: "הפרש בשווי המגורים",
                re: re.housingDifference,
                sp: null,
                note: "גרים בדירה החדשה במקום בישנה, לפי שכר הדירה של כל אחת",
              } as Line,
            ]
          : []),
        ...(re.renewalIncomeLost > 0.5
          ? [{ label: "הכנסה שאבדה בזמן ההתחדשות", re: re.renewalIncomeLost, sp: null, negative: true, note: "3 שנות בנייה" } as Line]
          : []),
        ...(re.livesInNew
          ? []
          : [
              {
                label: "מס על שכירות",
                re: re.totalRentTax,
                sp: null,
                negative: true,
                note: re.rentsOutBoth
                  ? "המס הנוסף שהדירה החדשה גורמת: תקרת הפטור משותפת עם הדירה הישנה"
                  : "פטור עד ₪5,654 לחודש; מעל זה 10%",
              } as Line,
            ]),
        {
          label: "דליפת מס דיבידנדים",
          re: null,
          sp: sp.vehicle === "israeli" ? "כ-0.32% בשנה" : "כ-0.19% בשנה",
          note: "מנוכה מהתשואה בתוך הקרן",
        },
      ],
    },
    {
      title: `ביום המכירה (שנה ${result.inputs.years})`,
      lines: [
        { label: "שווי הנכס / תיק ההשקעות", re: re.finalPropertyValue, sp: sp.grossValue },
        { label: "יתרת משכנתא שנותרה", re: re.remainingMortgage, sp: null, negative: true },
        ...(loan || sp.loanPrincipal > 0
          ? [
              {
                label: "יתרת הלוואה שנותרה",
                re: loan ? re.extraLoanRemaining : null,
                sp: sp.loanPrincipal > 0 ? sp.loanRemaining : null,
                negative: true,
              } as Line,
            ]
          : []),
        ...(re.sideFundValue > 0.5
          ? [{ label: "תיק מדד מעודפי שכירות", re: re.sideFundValue, sp: null, note: "עודפים שהושקעו במדד" } as Line]
          : []),
        ...(re.idleCash > 0.5 ? [{ label: "עודפי שכירות במזומן", re: re.idleCash, sp: null } as Line] : []),
        {
          label: "תשואה ברוטו (לפני מסי מכירה)",
          re: re.grossGain,
          sp: sp.grossGain,
          strong: true,
        },
        {
          label: "עלויות מכירה",
          re: re.sellingCosts,
          sp: null,
          negative: true,
          note: result.inputs.useBroker ? "תיווך 2% + עו״ד 0.5% + מע״מ" : "עו״ד 0.5% + מע״מ",
        },
        ...(re.sellDelayCost > 0.5
          ? [
              {
                label: "חודשים עד המכירה",
                re: re.sellDelayCost,
                sp: null,
                negative: true,
                note: `${result.inputs.monthsToSell} חודשים בלי שוכר, עם ועד בית וארנונה`,
              } as Line,
            ]
          : []),
        ...(re.renewalLevy > 0.5
          ? [{ label: "היטל השבחה", re: re.renewalLevy, sp: null, negative: true, note: "25% מתוספת השווי מההתחדשות" } as Line]
          : []),
        {
          label: "מס שבח",
          re: re.shevachExempt ? "פטור (דירה יחידה)" : re.shevachTax,
          sp: null,
          negative: true,
          note: re.shevachPartial
            ? "חלקי: מחיר המכירה מעל תקרת הפטור"
            : re.shevachExempt
              ? undefined
              : re.depreciationDeducted > 0.5
                ? `25% על הרווח הריאלי, כולל פחת רעיוני של ${formatILS(re.depreciationDeducted)}`
                : "25% על הרווח הריאלי",
        },
        {
          label: "מס רווחי הון (25%)",
          re: re.sideFundTax > 0.5 ? re.sideFundTax : null,
          sp: sp.capitalGainsTax,
          negative: true,
          note: sp.vehicle === "irish" ? "ETF אירי: על הרווח מעל שער הדולר" : "על הרווח הריאלי",
        },
        {
          label: "מס יסף (5%)",
          re: re.surtax,
          sp: sp.surtax,
          negative: true,
          note: "על רווח הון מעל ₪721,560 בשנת המכירה",
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
                <th className="px-2 py-2 text-right font-semibold text-re-ink">קונים דירה</th>
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
            הנחות: מדרגות מס רכישה הקפואות עד 15.1.2028 · תקרות המס קפואות עד סוף 2027 וצמודות למדד אחר כך · מכירה בשנה אחת
            ובלי הכנסות נוספות באותה שנה (לצורך מס יסף) ·{" "}
            {result.inputs.depreciation ? "כולל פחת רעיוני (לפי בחירתכם)" : "בלי פחת רעיוני (אפשר להוסיף בהגדרות המתקדמות)"} ·
            אינפלציה {result.inputs.inflation}% בשנה · כל הסכומים בשקלים של אותה שנה.
          </p>
          <Sources ids={["purchaseTax", "rentTax", "shevach", "surtax", "sp500Tax", "boi329"]} className="mt-2 px-2" />
        </div>
      )}
    </div>
  );
}
