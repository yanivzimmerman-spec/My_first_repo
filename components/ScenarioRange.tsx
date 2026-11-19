"use client";

import type { SimResult } from "@/lib/calculator";
import { formatCompactILS } from "@/lib/format";

/** The result under pessimistic / your / optimistic assumptions, both assets moving together. */
export default function ScenarioRange({ pess, base, opt }: { pess: SimResult; base: SimResult; opt: SimResult }) {
  const rows: { label: string; r: SimResult; note: string }[] = [
    { label: "פסימי", r: pess, note: "דירות +1.5% פחות, S&P 2.5% פחות, דולר חלש יותר" },
    { label: "ההנחות שלכם", r: base, note: "" },
    { label: "אופטימי", r: opt, note: "דירות +1.5% יותר, S&P 2% יותר, דולר חזק יותר" },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h3 className="text-lg font-bold text-slate-900">ומה אם העתיד יהיה שונה?</h3>
      <p className="mt-0.5 text-[13px] text-slate-500">אותם נתונים, כשהשווקים טובים או גרועים מההנחה, לשני המסלולים יחד</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-[14px]">
          <thead>
            <tr className="text-[12px] text-slate-500">
              <th className="py-2 text-right font-medium">תרחיש</th>
              <th className="py-2 text-right font-medium">קונים דירה</th>
              <th className="py-2 text-right font-medium">S&P 500</th>
              <th className="py-2 text-right font-medium">מי מנצח</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(({ label, r, note }) => (
              <tr key={label} className={`border-t border-slate-100 ${note ? "" : "bg-slate-50 font-semibold"}`}>
                <td className="py-2.5 pl-2 text-slate-700">
                  {label}
                  {note && <span className="block text-[11.5px] font-normal text-slate-400">{note}</span>}
                </td>
                <td className="py-2.5 text-slate-900">{formatCompactILS(r.realEstate.netWorth)}</td>
                <td className="py-2.5 text-slate-900">{formatCompactILS(r.sp500.netWorth)}</td>
                <td className="py-2.5" style={{ color: r.winner === "realEstate" ? "var(--ink-re)" : r.winner === "sp500" ? "var(--ink-sp)" : undefined }}>
                  {r.winner === "tie" ? "תיקו" : `${r.winner === "realEstate" ? "דירה" : "S&P"} ב-${formatCompactILS(r.difference)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
