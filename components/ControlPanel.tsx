"use client";

import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { BOUNDS, MAX_LTV, type ApartmentType, type SimInputs, type SimResult } from "@/lib/calculator";
import { formatILS, formatPct } from "@/lib/format";
import SliderInput from "./SliderInput";
import { Segmented, Switch } from "./Toggle";

const RE = "#4F46E5";
const SP = "#059669";
const LOAN = "#B45309";

interface Props {
  inputs: SimInputs;
  result: SimResult;
  set: <K extends keyof SimInputs>(key: K, value: SimInputs[K]) => void;
}

const TYPE_TEXT: Record<ApartmentType, string> = {
  single: "דירה יחידה: מס רכישה מופחת, פטור ממס שבח במכירה (עד ₪5.008M), מימון עד 75%.",
  upgrader:
    "משפרי דיור: מס רכישה כמו דירה יחידה בתנאי שמוכרים את הדירה הקיימת תוך 24 חודשים, פטור ממס שבח, מימון עד 70%.",
  additional:
    "דירה נוספת: מס רכישה 8% מהשקל הראשון (הוראת שעה עד 10.2.2027), מס שבח 25% על הרווח הריאלי, מימון עד 50%.",
};

const TYPE_NAME: Record<ApartmentType, string> = {
  single: "דירה יחידה",
  upgrader: "דירה למשפרי דיור",
  additional: "דירה נוספת",
};

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

function SwitchRow({
  label,
  checked,
  onChange,
  accent,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-[15px] text-slate-700">{label}</span>
        <Switch label={label} checked={checked} onChange={onChange} accent={accent} />
      </label>
      {children && <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{children}</p>}
    </div>
  );
}

export default function ControlPanel({ inputs, result, set }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const re = result.realEstate;
  const type = inputs.apartmentType;

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
            value={type}
            onChange={(v) => set("apartmentType", v)}
            options={[
              { value: "single", label: "דירה יחידה" },
              { value: "upgrader", label: "משפר דיור" },
              { value: "additional", label: "דירה נוספת" },
            ]}
          />
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{TYPE_TEXT[type]}</p>
        </div>

        <div>
          <SliderInput
            label="מחיר הדירה"
            kind="currency"
            value={re.propertyPrice}
            bound={{ ...BOUNDS.propertyPrice, max: re.maxPrice }}
            accent={RE}
            disabled={inputs.autoPrice}
            onChange={(v) => set("propertyPrice", v)}
            hint={
              <>
                משכנתא: <span className="font-medium text-slate-700">{formatILS(re.loanAmount)}</span> (
                {formatPct(re.ltv * 100, 0)} מימון) · מס רכישה: {formatILS(re.purchaseTax)} · עלויות קנייה:{" "}
                {formatILS(re.closingCosts)}
              </>
            }
          />
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">
            {re.priceCapped && (
              <p className="mb-1 flex gap-1.5 font-medium text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                המחיר שבחרתם גבוה ממה שהבנק יממן, לכן החישוב נעשה לפי המקסימום.
              </p>
            )}
            <p>
              עם {formatILS(inputs.equity)} הון עצמי
              {inputs.loanEnabled && <> ועוד {formatILS(inputs.loanAmount)} הלוואה</>} אפשר לקנות {TYPE_NAME[type]} עד{" "}
              <span className="font-semibold text-slate-900">{formatILS(re.maxPrice)}</span>. הבנק מממן עד{" "}
              {formatPct(MAX_LTV[type] * 100, 0)}, והשאר, כולל מס רכישה ועלויות, משולם מהכסף שלכם.
            </p>
          </div>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-[13px] text-slate-600">
            <span>קנו את הדירה היקרה ביותר שהבנק יממן</span>
            <Switch
              label="מחיר מקסימלי אוטומטי"
              checked={inputs.autoPrice}
              onChange={(v) => set("autoPrice", v)}
              accent={RE}
            />
          </label>
        </div>

        <SwitchRow label="קנייה ומכירה דרך מתווך" checked={inputs.useBroker} onChange={(v) => set("useBroker", v)} accent={RE}>
          {inputs.useBroker
            ? "תיווך 2% ועו״ד 0.5% (+18% מע״מ) בכל צד, ועוד כ-₪10,000 לשמאי, יועץ משכנתאות ועמלות בנק."
            : "עו״ד 0.5% (+18% מע״מ) בכל צד, ועוד כ-₪10,000 לשמאי, יועץ משכנתאות ועמלות בנק."}
        </SwitchRow>

        <SliderInput
          label="ריבית משכנתא"
          kind="percent"
          value={inputs.mortgageRate}
          bound={BOUNDS.mortgageRate}
          accent={RE}
          onChange={(v) => set("mortgageRate", v)}
          hint={`החזר חודשי: ${formatILS(re.monthlyMortgagePayment)} · ריבית ממוצעת אחת לכל המסלולים`}
        />
        <SliderInput
          label="תשואת שכירות שנתית (ברוטו)"
          kind="percent"
          value={inputs.rentalYield}
          bound={BOUNDS.rentalYield}
          accent={RE}
          onChange={(v) => set("rentalYield", v)}
          hint={
            <>
              שכר דירה {formatILS(re.initialMonthlyRentGross)} לחודש. אחרי חודש פנוי בשנה, תחזוקה 8%, ביטוח ומס נשארים{" "}
              <span className="font-medium text-slate-700">{formatILS(re.initialMonthlyRentNet)}</span> (תשואה נטו{" "}
              {formatPct(re.netYieldPct, 1)}).
            </>
          }
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

      <Group title="הלוואה להון העצמי" color={LOAN}>
        <SwitchRow
          label="לקחת הלוואה נוספת"
          checked={inputs.loanEnabled}
          onChange={(v) => set("loanEnabled", v)}
          accent={LOAN}
        >
          הלוואה אישית או &quot;כל מטרה&quot; שמגדילה את הכסף לקניית הדירה. ההחזר החודשי שלה נחשב כהוצאה מהכיס.
        </SwitchRow>
        {inputs.loanEnabled && (
          <>
            <SliderInput
              label="סכום ההלוואה"
              kind="currency"
              value={inputs.loanAmount}
              bound={BOUNDS.loanAmount}
              accent={LOAN}
              onChange={(v) => set("loanAmount", v)}
            />
            <SliderInput
              label="ריבית ההלוואה"
              kind="percent"
              decimals={1}
              value={inputs.loanRate}
              bound={BOUNDS.loanRate}
              accent={LOAN}
              onChange={(v) => set("loanRate", v)}
              hint="הלוואות כאלה הן בדרך כלל פריים + 2% עד 4% (כ-7% עד 9%)"
            />
            <SliderInput
              label="תקופת ההלוואה"
              kind="years"
              value={inputs.loanTerm}
              bound={BOUNDS.loanTerm}
              accent={LOAN}
              onChange={(v) => set("loanTerm", Math.round(v))}
              hint={`החזר חודשי: ${formatILS(re.extraLoanPayment)}`}
            />
            <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                הבנק בודק מאיפה מגיע ההון העצמי. מפברואר 2026 החזרי כל ההלוואות לדיור, כולל &quot;כל מטרה&quot;, נספרים
                במגבלת 50% מההכנסה הפנויה, כך שבפועל לא תמיד יאשרו את המשכנתא.
              </span>
            </div>
          </>
        )}
      </Group>

      <Group title="S&P 500" color={SP}>
        <div>
          <Segmented
            ariaLabel="אפיק ההשקעה"
            accent={SP}
            value={inputs.spVehicle}
            onChange={(v) => set("spVehicle", v)}
            options={[
              { value: "israeli", label: "קרן מחקה ישראלית" },
              { value: "irish", label: "ETF אירי" },
            ]}
          />
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            {inputs.spVehicle === "israeli"
              ? "מס 25% על הרווח שמעל האינפלציה (צמוד למדד). דליפת מס דיבידנדים בתוך הקרן כ-0.25% בשנה."
              : "מס 25% על הרווח בשקלים, צמוד לשער הדולר (כאן הנחה שהשער לא משתנה, כלומר בלי הגנה מאינפלציה). ניכוי מס דיבידנדים 15% בתוך הקרן, כ-0.19% בשנה."}
          </p>
        </div>
        <SliderInput
          label="תשואה שנתית ממוצעת"
          kind="percent"
          decimals={1}
          value={inputs.spReturn}
          bound={BOUNDS.spReturn}
          accent={SP}
          onChange={(v) => set("spReturn", v)}
          hint="הממוצע ההיסטורי כ-9.5% בדולרים, וכ-8.5% עד 9% בשקלים"
        />
        <SliderInput
          label="דמי ניהול"
          kind="percent"
          value={inputs.spFee}
          bound={BOUNDS.spFee}
          accent={SP}
          onChange={(v) => set("spFee", v)}
        />
        <SwitchRow
          label="השקעת ההפרש החודשי"
          checked={inputs.cashflowMatching}
          onChange={(v) => set("cashflowMatching", v)}
          accent={SP}
        >
          כדי שההשוואה תהיה הוגנת, אם החזרי המשכנתא וההלוואה גבוהים מהשכירות נטו, ההפרש החודשי מושקע אוטומטית ב-S&P 500
          {re.initialMonthlyGap > 0.5 && (
            <>
              {" "}
              (כרגע <span className="font-medium text-slate-700">{formatILS(re.initialMonthlyGap)}</span> בחודש)
            </>
          )}
          .
        </SwitchRow>
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
              label="עליית שכר דירה שנתית"
              kind="percent"
              decimals={1}
              value={inputs.rentGrowth}
              bound={BOUNDS.rentGrowth}
              onChange={(v) => set("rentGrowth", v)}
              hint="שכר הדירה לא תמיד עולה יחד עם מחירי הדירות"
            />
            <SliderInput
              label="אינפלציה שנתית"
              kind="percent"
              decimals={1}
              value={inputs.inflation}
              bound={BOUNDS.inflation}
              onChange={(v) => set("inflation", v)}
              hint="יעד בנק ישראל 1%–3%. משמשת לחישוב רווח ריאלי ולהצמדת תקרות המס מ-2028"
            />
            <SliderInput
              label="תקופת המשכנתא"
              kind="years"
              value={inputs.mortgageTerm}
              bound={BOUNDS.mortgageTerm}
              onChange={(v) => set("mortgageTerm", Math.round(v))}
              hint="עד 30 שנה לפי בנק ישראל"
            />
          </div>
        )}
      </section>
    </div>
  );
}
