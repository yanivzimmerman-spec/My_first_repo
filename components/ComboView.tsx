"use client";

import { useMemo, useState } from "react";
import { track } from "@/lib/track";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SimInputs, SimResult } from "@/lib/calculator";
import { comboCurve, type ComboPoint } from "@/lib/combo";
import { formatCompactILS, formatILS } from "@/lib/format";
import SliderInput from "./SliderInput";

function Card({ title, value, sub, highlight }: { title: string; value: number | null; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-slate-900 dark:border-slate-300" : "border-slate-200"}`}>
      <p className="text-[13px] text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value === null ? "—" : formatILS(value)}</p>
      <p className="mt-1 text-[12px] text-slate-500">{sub}</p>
    </div>
  );
}

/** Second page (#combo): split the starting money between an apartment and the S&P. */
export default function ComboView({
  inputs,
  result,
  dark,
  embedded = false,
  curve: given,
}: {
  inputs: SimInputs;
  result: SimResult;
  dark: boolean;
  /** Inside another page (the planner): no back link, no reference to the main page */
  embedded?: boolean;
  /** Precomputed curve, when the caller already has it */
  curve?: ComboPoint[];
}) {
  const [share, setShare] = useState(50);
  const computed = useMemo(() => given ?? comboCurve(inputs, result), [given, inputs, result]);
  const curve = computed;
  const chosen = curve.find((p) => p.share === share) ?? curve[0];
  const feasible = curve.filter((p): p is ComboPoint & { value: number } => p.value !== null);
  const best = feasible.reduce((a, b) => (b.value > a.value ? b : a), feasible[0]);
  const start = result.realEstate.startCapital;
  const colors = dark
    ? { bar: "#334155", chosen: "#7C78FF", best: "#10A97C", tick: "#94A3B8" }
    : { bar: "#CBD5E1", chosen: "#4F46E5", best: "#10B981", tick: "#64748B" };

  return (
    <div className="space-y-5">
      {!embedded && (
        <a href="#main" className="inline-flex items-center gap-1 text-[14px] font-semibold text-slate-600 hover:text-slate-900">
          → חזרה לסימולטור
        </a>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-[13px] font-semibold text-slate-500">שילוב בין השניים</p>
        <h2 className={`mt-1 font-bold leading-snug text-slate-900 ${embedded ? "text-xl" : "text-2xl sm:text-[28px]"}`}>
          חלק מהכסף לדירה, וחלק ל-S&P 500
        </h2>
        <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-slate-600">
          במקום לבחור אחד, אפשר לקנות דירה קטנה יותר ולהשקיע את השאר במדד. כל השילובים מקבלים בדיוק אותו כסף: אותם{" "}
          {formatILS(start)} היום ואותה הוצאה חודשית כמו בקניית הדירה המלאה. מה שלא הולך לדירה מושקע במדד.
          {embedded ? "" : " כל שאר ההנחות לקוחות מהדף הראשי."}
        </p>

        <div className="mt-6">
          <SliderInput
            label="כמה מהכסף לדירה?"
            kind="percent"
            decimals={0}
            value={share}
            bound={{ min: 0, max: 100, step: 10 }}
            onChange={(v) => {
              setShare(Math.round(v / 10) * 10);
              track({ type: "combo" });
            }}
            hint={
              chosen.value === null
                ? `${formatILS((start * share) / 100)} לא מספיקים לדירה (מינימום ₪200,000).`
                : share > 0
                  ? `${formatILS((start * share) / 100)} לדירה (קונים דירה ב-${formatCompactILS(chosen.price ?? 0)}), ${formatILS(
                      (start * (100 - share)) / 100,
                    )} למדד.`
                  : "הכול במדד."
            }
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card title="הכול בדירה" value={curve[curve.length - 1].value} sub={embedded ? "כמו בהשוואה למעלה" : "כמו בדף הראשי"} />
          <Card title={`השילוב שבחרתם (${share}% לדירה)`} value={chosen.value} sub="אחרי כל המסים" highlight />
          <Card title="הכול ב-S&P 500" value={curve[0].value} sub="אותו כסף, הכול במדד" />
        </div>

        {best && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[14px] font-medium text-slate-800">
            בהנחות שלכם, השילוב הכי משתלם הוא {best.share}% לדירה ו-{100 - best.share}% למדד: {formatILS(best.value)}.
          </p>
        )}

        <div className="mt-6 h-[260px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={curve.map((p) => ({ ...p, v: p.value ?? 0 }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="share"
                reversed
                tickLine={false}
                axisLine={false}
                tick={{ fill: colors.tick, fontSize: 11 }}
                tickFormatter={(s: number) => `${s}%`}
              />
              <YAxis orientation="right" width={58} tickLine={false} axisLine={false} tick={{ fill: colors.tick, fontSize: 11 }} tickFormatter={(v: number) => formatCompactILS(v)} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                content={(props) => {
                  const p = props.payload?.[0]?.payload as ComboPoint | undefined;
                  if (!props.active || !p) return null;
                  return (
                    <div dir="rtl" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-lg">
                      <p className="font-semibold text-slate-900">{p.share}% לדירה</p>
                      <p className="tabular-nums text-slate-600">{p.value === null ? "לא אפשרי" : formatILS(p.value)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="v" radius={[4, 4, 0, 0]} onClick={(d) => setShare((d as unknown as ComboPoint).share)}>
                {curve.map((p) => (
                  <Cell
                    key={p.share}
                    cursor="pointer"
                    fill={p.share === share ? colors.chosen : best && p.share === best.share ? colors.best : colors.bar}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[12px] text-slate-500">
          כל עמודה היא שווי נטו בסוף התקופה. סגול: השילוב שבחרתם, ירוק: הכי משתלם. לחיצה על עמודה בוחרת אותה.
          {curve.some((p) => p.value === null) &&
            ` עמודות ריקות (${curve
              .filter((p) => p.value === null)
              .map((p) => `${p.share}%`)
              .join(", ")}): הסכום לא מספיק לדירה (מינימום ₪200,000).`}{" "}
          בקירוב: מס יסף מחושב לכל חלק בנפרד.
        </p>
      </section>
    </div>
  );
}
