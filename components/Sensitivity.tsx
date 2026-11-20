"use client";

import { useMemo } from "react";
import type { SimInputs } from "@/lib/calculator";
import { flips, flipSentence, FLIP_LABEL } from "@/lib/sensitivity";

/** "What flips the result": one plain line per key assumption, closest flip first. */
export default function Sensitivity({ inputs }: { inputs: SimInputs }) {
  const rows = useMemo(() => {
    const all = flips(inputs);
    // Closest flip (smallest relative change) first; no-flip rows last
    return all.sort((a, b) => {
      const d = (f: typeof a) => (f.flipAt === null ? Infinity : Math.abs(f.flipAt - f.current) / Math.max(0.5, Math.abs(f.current)));
      return d(a) - d(b);
    });
  }, [inputs]);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="flip-title">
      <h3 id="flip-title" className="text-lg font-bold text-slate-900">
        מה הופך את התוצאה?
      </h3>
      <p className="mt-0.5 text-[13px] text-slate-600">כל שורה משנה הנחה אחת ומשאירה את כל השאר כמו שהן.</p>
      <ul className="mt-4 space-y-2.5">
        {rows.map((f) => (
          <li key={f.key} className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800">
            <span className="sr-only">{FLIP_LABEL[f.key]}. </span>
            {flipSentence(f)}
          </li>
        ))}
      </ul>
    </section>
  );
}
