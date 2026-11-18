"use client";

import { useState } from "react";
import {
  Wallet,
  CalendarRange,
  Building2,
  Percent,
  Home,
  TrendingUp,
  LineChart,
  Coins,
  ArrowLeftRight,
  ChevronDown,
  Settings2,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import { BOUNDS, type SimInputs, type SimResult } from "@/lib/calculator";
import { formatILS, formatPct } from "@/lib/format";
import SliderInput from "./SliderInput";
import { Segmented, Switch } from "./Toggle";

const RE = "#4F46E5";
const SP = "#10B981";

interface Props {
  inputs: SimInputs;
  result: SimResult;
  set: <K extends keyof SimInputs>(key: K, value: SimInputs[K]) => void;
}

function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg"
          style={{ background: color ? `${color}14` : "#F1F5F9", color: color ?? "#334155" }}
        >
          {icon}
        </span>
        {title}
      </h3>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export default function ControlPanel({ inputs, result, set }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const re = result.realEstate;

  return (
    <div className="space-y-4">
      {/* 1. Primary inputs */}
      <section className="rounded-2xl border-2 border-slate-900/90 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-5">
          <SliderInput
            highlight
            label="הון עצמי פנוי"
            icon={<Wallet size={16} />}
            kind="currency"
            value={inputs.equity}
            bound={BOUNDS.equity}
            onChange={(v) => set("equity", v)}
          />
          <SliderInput
            highlight
            label="טווח השקעה"
            icon={<CalendarRange size={16} />}
            kind="years"
            value={inputs.years}
            bound={BOUNDS.years}
            onChange={(v) => set("years", Math.round(v))}
          />
        </div>
      </section>

      {/* 2. Real-estate track */}
      <Section title="מסלול דירה להשקעה" icon={<Building2 size={16} />} color={RE}>
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
        <p className="-mt-2 text-xs leading-relaxed text-slate-500">
          {inputs.isFirstApartment
            ? "מס רכישה לפי מדרגות דירה יחידה (0% עד ₪1.98M) · פטור ממס שבח במכירה."
            : "מס רכישה 8% מהשקל הראשון · מס שבח 25% על הרווח הריאלי במכירה."}
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Wand2 size={14} />
              חישוב אוטומטי (הון עצמי ÷ 25%)
            </span>
            <Switch
              label="חישוב שווי נכס אוטומטי"
              checked={inputs.autoPrice}
              onChange={(v) => set("autoPrice", v)}
              accent={RE}
            />
          </div>
          <SliderInput
            label="שווי הנכס הנרכש"
            icon={<Home size={15} />}
            kind="currency"
            value={re.propertyPrice}
            bound={BOUNDS.propertyPrice}
            accent={RE}
            disabled={inputs.autoPrice}
            onChange={(v) => set("propertyPrice", v)}
            hint={
              <>
                מס רכישה {formatILS(re.purchaseTax)} + עלויות נלוות 2% {formatILS(re.closingCosts)} · משכנתא{" "}
                <span className="font-semibold text-slate-700">{formatILS(re.loanAmount)}</span> (מימון{" "}
                {formatPct(re.ltv * 100, 0)})
              </>
            }
          />
          {(re.ltvExceeded || re.equityShortfall) && (
            <div className="mt-2 flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                {re.equityShortfall
                  ? "ההון העצמי לא מכסה אפילו את מס הרכישה והעלויות הנלוות. הקטינו את שווי הנכס."
                  : `שיעור המימון (${formatPct(re.ltv * 100, 0)}) גבוה מהמקסימום שבנק ישראל מתיר ל${
                      inputs.isFirstApartment ? "דירה יחידה (75%)" : "דירה נוספת (50%)"
                    }. בפועל הבנק לא יאשר משכנתא כזו.`}
              </span>
            </div>
          )}
        </div>

        <SliderInput
          label="ריבית משכנתא ממוצעת"
          icon={<Percent size={15} />}
          kind="percent"
          value={inputs.mortgageRate}
          bound={BOUNDS.mortgageRate}
          accent={RE}
          onChange={(v) => set("mortgageRate", v)}
          hint={`החזר חודשי (שפיצר, ${inputs.mortgageTerm} שנה): ${formatILS(re.monthlyMortgagePayment)}`}
        />
        <SliderInput
          label="תשואת שכירות שנתית נטו"
          icon={<Coins size={15} />}
          kind="percent"
          value={inputs.rentalYield}
          bound={BOUNDS.rentalYield}
          accent={RE}
          onChange={(v) => set("rentalYield", v)}
          hint={`שכ״ד חודשי בשנה הראשונה: ${formatILS(re.initialMonthlyRentGross)} (אחרי חודש פנוי/תחזוקה)${
            re.initialMonthlyRentGross > re.initialMonthlyRentNet + 0.5 ? " · חייב במס 10%" : " · פטור ממס"
          }`}
        />
        <SliderInput
          label="עליית ערך שנתית צפויה"
          icon={<TrendingUp size={15} />}
          kind="percent"
          decimals={1}
          value={inputs.appreciation}
          bound={BOUNDS.appreciation}
          accent={RE}
          onChange={(v) => set("appreciation", v)}
        />
      </Section>

      {/* 3. S&P track */}
      <Section title="מסלול S&P 500" icon={<LineChart size={16} />} color={SP}>
        <SliderInput
          label="תשואה שנתית ממוצעת"
          icon={<TrendingUp size={15} />}
          kind="percent"
          decimals={1}
          value={inputs.spReturn}
          bound={BOUNDS.spReturn}
          accent={SP}
          onChange={(v) => set("spReturn", v)}
          hint="ממוצע היסטורי נומינלי (כולל דיבידנדים) ≈ 9.5%–10%"
        />
        <SliderInput
          label="דמי ניהול שנתיים"
          icon={<Percent size={15} />}
          kind="percent"
          value={inputs.spFee}
          bound={BOUNDS.spFee}
          accent={SP}
          onChange={(v) => set("spFee", v)}
          hint="קרן אירית / קרן מחקה ישראלית: 0.07%–0.25%"
        />
        <div className="rounded-xl bg-emerald-50/70 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <ArrowLeftRight size={15} className="text-sp-ink" />
              הפקדה חודשית משלימה
            </span>
            <Switch
              label="הפקדה חודשית משלימה"
              checked={inputs.cashflowMatching}
              onChange={(v) => set("cashflowMatching", v)}
              accent={SP}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            כדי שההשוואה תהיה הוגנת, אם החזר המשכנתא גבוה מהשכירות, ההפרש החודשי מושקע אוטומטית ב-S&P 500. אם
            השכירות גבוהה מההחזר — העודף מושקע במדד בתוך מסלול הנדל״ן.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-700">
            {re.initialMonthlyGap > 0.5
              ? `כרגע: ${formatILS(re.initialMonthlyGap)} בחודש מהכיס → ל-S&P`
              : re.initialMonthlyGap < -0.5
                ? `כרגע: עודף שכירות של ${formatILS(-re.initialMonthlyGap)} בחודש`
                : "כרגע: השכירות מכסה בדיוק את ההחזר"}
          </p>
        </div>
      </Section>

      {/* 4. Advanced */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="flex w-full items-center justify-between p-4 text-sm font-bold text-slate-900 sm:px-5"
        >
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600">
              <Settings2 size={16} />
            </span>
            הנחות מתקדמות
          </span>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${advanced ? "rotate-180" : ""}`} />
        </button>
        {advanced && (
          <div className="space-y-5 px-4 pb-5 sm:px-5">
            <SliderInput
              label="אינפלציה שנתית"
              kind="percent"
              decimals={1}
              value={inputs.inflation}
              bound={BOUNDS.inflation}
              onChange={(v) => set("inflation", v)}
              hint="משמשת לחישוב רווח ריאלי (מס שבח ומס רווחי הון) ולהצמדת תקרת הפטור על שכירות"
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
