"use client";

import type { SimResult } from "@/lib/calculator";
import { trackRisks, type TrackRisk } from "@/lib/risk";

const LEVEL_COLORS = ["#10B981", "#84CC16", "#F59E0B", "#F97316", "#EF4444"];

function Gauge({ title, dot, risk }: { title: string; dot: string; risk: TrackRisk }) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
        {title}
      </h4>
      <div className="mt-3 grid grid-cols-5 gap-1" role="img" aria-label={`רמת סיכון: ${risk.label}`}>
        {LEVEL_COLORS.map((c, i) => (
          <span key={c} className="h-2.5 rounded-full" style={{ background: i < risk.level ? c : "var(--color-slate-200)" }} />
        ))}
      </div>
      <p className="mt-2 text-[14px] font-semibold text-slate-900">סיכון {risk.label}</p>
      <p className="mt-1 text-[13px] text-slate-700">
        בשנה גרועה: עד כ-<span className="font-semibold">{Math.round(risk.badYearLossPct)}%</span> מהכסף שלכם
      </p>
      <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-slate-600">
        {risk.factors.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-slate-300">•</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How risky each track is, from leverage and a bad-year drop (rule of thumb). */
export default function RiskGauges({ result }: { result: SimResult }) {
  const risks = trackRisks(result);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h3 className="text-lg font-bold text-slate-900">כמה סיכון בכל מסלול?</h3>
      <p className="mt-0.5 text-[13px] text-slate-500">
        כלל אצבע: המינוף כפול ירידה בשנה גרועה (דירה בודדת כ-15%, S&P כ-35%), ועוד גורמים שמקשים לעבור תקופה רעה
      </p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2 sm:gap-8">
        <Gauge title="קונים דירה" dot="var(--bar-re)" risk={risks.realEstate} />
        <Gauge title="S&P 500" dot="var(--bar-sp)" risk={risks.sp500} />
      </div>
    </section>
  );
}
