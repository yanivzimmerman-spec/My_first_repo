"use client";

import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { BOUNDS, type SimInputs, type SimResult } from "@/lib/calculator";
import { formatILS, formatPct } from "@/lib/format";
import SliderInput from "./SliderInput";
import { Segmented, Switch } from "./Toggle";

const RE = "#4F46E5";
const SP = "#059669";

interface Props {
  inputs: SimInputs;
  result: SimResult;
  set: <K extends keyof SimInputs>(key: K, value: SimInputs[K]) => void;
}

function Group({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-6 first:border-t-0 sm:px-6">
      <h2 className="mb-5 flex items-center gap-2 text-[13px] font-semibold text-slate-500">
        {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        {title}
      </h2>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export default function ControlPanel({ inputs, result, set }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const re = result.realEstate;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <Group title="הנתונים שלכם">
        <SliderInput
          label="הון עצמי פנוי"
          kind="currency"
          value={inputs.equity}
          bound={BOUNDS.equity}
          onChange={(v) => set("equity", v)}
        />
        <SliderInput
          label="לכמה שנים?"
          kind="years"
          value={inputs.years}
          bound={BOUNDS.years}
          onChange={(v) => set("years", Math.round(v))}
        />
      </Group>

      <Group title="דירה להשקעה" color={RE}>
        <div>
          <Segmented
            ariaLabel="סוג הדירה"
            accent={RE}
            value={inputs.isFirstApartment ? "first" : "additional"}
            onChange={(v) => set("isFirstApartment", v === "first")}
            options={[
              { value: "first", label: "דירה יחידה" },
              { value: "additional", label: "דירה נוספת" },
            ]}
          />
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            {inputs.isFirstApartment
              ? "מס רכישה מופחת ופטור ממס שבח במכירה."
              : "מס רכישה 8% ומס שבח 25% על הרווח הריאלי."}
          </p>
        </div>

        <div>
          <SliderInput
            label="מחיר הדירה"
            kind="currency"
            value={re.propertyPrice}
            bound={BOUNDS.propertyPrice}
            accent={RE}
            disabled={inputs.autoPrice}
            onChange={(v) => set("propertyPrice", v)}
            hint={
              <>
                משכנתא: <span className="font-medium text-slate-700">{formatILS(re.loanAmount)}</span> (
                {formatPct(re.ltv * 100, 0)} מימון) · מס רכישה ועלויות: {formatILS(re.purchaseTax + re.closingCosts)}
              </>
            }
          />
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-[13px] text-slate-600">
            <span>חשבו לי את המחיר לפי 25% הון עצמי</span>
            <Switch
              label="חישוב מחיר אוטומטי"
              checked={inputs.autoPrice}
              onChange={(v) => set("autoPrice", v)}
              accent={RE}
            />
          </label>
          {(re.ltvExceeded || re.equityShortfall) && (
            <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {re.equityShortfall
                  ? "ההון העצמי לא מכסה את מס הרכישה והעלויות. בחרו דירה זולה יותר."
                  : `הבנק לא יאשר מימון של ${formatPct(re.ltv * 100, 0)}. המקסימום ל${
                      inputs.isFirstApartment ? "דירה יחידה הוא 75%" : "דירה נוספת הוא 50%"
                    }.`}
              </span>
            </div>
          )}
        </div>

        <SliderInput
          label="ריבית משכנתא"
          kind="percent"
          value={inputs.mortgageRate}
          bound={BOUNDS.mortgageRate}
          accent={RE}
          onChange={(v) => set("mortgageRate", v)}
          hint={`החזר חודשי: ${formatILS(re.monthlyMortgagePayment)}`}
        />
        <SliderInput
          label="תשואת שכירות שנתית"
          kind="percent"
          value={inputs.rentalYield}
          bound={BOUNDS.rentalYield}
          accent={RE}
          onChange={(v) => set("rentalYield", v)}
          hint={`שכר דירה: ${formatILS(re.initialMonthlyRentGross)} לחודש (נטו, אחרי חודש פנוי ותחזוקה)`}
        />
        <SliderInput
          label="עליית ערך שנתית"
          kind="percent"
          decimals={1}
          value={inputs.appreciation}
          bound={BOUNDS.appreciation}
          accent={RE}
          onChange={(v) => set("appreciation", v)}
        />
      </Group>

      <Group title="S&P 500" color={SP}>
        <SliderInput
          label="תשואה שנתית ממוצעת"
          kind="percent"
          decimals={1}
          value={inputs.spReturn}
          bound={BOUNDS.spReturn}
          accent={SP}
          onChange={(v) => set("spReturn", v)}
          hint="הממוצע ההיסטורי הוא כ-9.5% בשנה"
        />
        <SliderInput
          label="דמי ניהול"
          kind="percent"
          value={inputs.spFee}
          bound={BOUNDS.spFee}
          accent={SP}
          onChange={(v) => set("spFee", v)}
        />
        <div>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-[15px] text-slate-700">השקעת ההפרש החודשי</span>
            <Switch
              label="השקעת ההפרש החודשי"
              checked={inputs.cashflowMatching}
              onChange={(v) => set("cashflowMatching", v)}
              accent={SP}
            />
          </label>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            כדי שההשוואה תהיה הוגנת, אם החזר המשכנתא גבוה מהשכירות, ההפרש החודשי מושקע אוטומטית ב-S&P 500
            {re.initialMonthlyGap > 0.5 && (
              <>
                {" "}
                (כרגע <span className="font-medium text-slate-700">{formatILS(re.initialMonthlyGap)}</span> בחודש)
              </>
            )}
            .
          </p>
        </div>
      </Group>

      <section className="border-t border-slate-100">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="flex w-full items-center justify-between px-5 py-4 text-[13px] font-semibold text-slate-500 hover:text-slate-800 sm:px-6"
        >
          הנחות נוספות
          <ChevronDown size={16} className={`transition-transform ${advanced ? "rotate-180" : ""}`} />
        </button>
        {advanced && (
          <div className="space-y-6 px-5 pb-6 sm:px-6">
            <SliderInput
              label="אינפלציה שנתית"
              kind="percent"
              decimals={1}
              value={inputs.inflation}
              bound={BOUNDS.inflation}
              onChange={(v) => set("inflation", v)}
              hint="משמשת לחישוב המס על הרווח הריאלי"
            />
            <SliderInput
              label="תקופת המשכנתא"
              kind="years"
              value={inputs.mortgageTerm}
              bound={BOUNDS.mortgageTerm}
              onChange={(v) => set("mortgageTerm", Math.round(v))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
