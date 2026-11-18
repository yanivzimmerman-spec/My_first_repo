"use client";

import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { BOUNDS, type SimInputs, type SimResult } from "@/lib/calculator";
import { formatILS, formatPct } from "@/lib/format";
import SliderInput from "./SliderInput";
import { Segmented, Switch } from "./Toggle";

const RE = "var(--color-re-glow)";
const SP = "var(--color-sp-glow)";

interface Props {
  inputs: SimInputs;
  result: SimResult;
  set: <K extends keyof SimInputs>(key: K, value: SimInputs[K]) => void;
}

/** Section header styled like a terminal pane title: ticker code + Hebrew name. */
function Pane({
  code,
  title,
  color,
  children,
}: {
  code: string;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-term-line px-4 py-5 sm:px-5">
      <h3 className="mb-4 flex items-center gap-2.5">
        <span dir="ltr" className="px-1.5 py-0.5 font-mono text-[11px] font-bold text-term" style={{ background: color }}>
          {code}
        </span>
        <span className="text-sm font-bold text-term-text">{title}</span>
      </h3>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export default function ControlPanel({ inputs, result, set }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const re = result.realEstate;

  return (
    <div className="border border-term bg-term text-term-text shadow-[6px_6px_0_rgb(21_21_20/0.18)]">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-term-line bg-term-2 px-4 py-2.5 sm:px-5">
        <span className="text-[13px] font-bold text-term-text">
          הנחות הסימולציה<span className="cursor-blink mr-1 text-amber">▍</span>
        </span>
        <span dir="ltr" className="font-mono text-[10.5px] tracking-wider text-term-dim">
          ORDER TICKET
        </span>
      </div>

      {/* Primary inputs */}
      <div className="space-y-5 px-4 py-5 sm:px-5">
        <SliderInput
          highlight
          label="הון עצמי פנוי"
          kind="currency"
          value={inputs.equity}
          bound={BOUNDS.equity}
          onChange={(v) => set("equity", v)}
        />
        <SliderInput
          highlight
          label="טווח השקעה"
          kind="years"
          value={inputs.years}
          bound={BOUNDS.years}
          onChange={(v) => set("years", Math.round(v))}
        />
      </div>

      {/* Real-estate track */}
      <Pane code="RE" title="מסלול דירה להשקעה" color={RE}>
        <div>
          <Segmented
            ariaLabel="סוג הדירה"
            accent="var(--color-re)"
            value={inputs.isFirstApartment ? "first" : "additional"}
            onChange={(v) => set("isFirstApartment", v === "first")}
            options={[
              { value: "first", label: "דירה יחידה" },
              { value: "additional", label: "דירה נוספת" },
            ]}
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-term-dim">
            {inputs.isFirstApartment
              ? "מס רכישה לפי מדרגות דירה יחידה (0% עד ₪1.98M) · פטור ממס שבח במכירה."
              : "מס רכישה 8% מהשקל הראשון · מס שבח 25% על הרווח הריאלי במכירה."}
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[12px] text-term-dim">שווי אוטומטי (הון עצמי ÷ 25%)</span>
            <Switch
              label="חישוב שווי נכס אוטומטי"
              checked={inputs.autoPrice}
              onChange={(v) => set("autoPrice", v)}
              accent={RE}
            />
          </div>
          <SliderInput
            label="שווי הנכס הנרכש"
            kind="currency"
            value={re.propertyPrice}
            bound={BOUNDS.propertyPrice}
            accent={RE}
            disabled={inputs.autoPrice}
            onChange={(v) => set("propertyPrice", v)}
            hint={
              <>
                מס רכישה {formatILS(re.purchaseTax)} · עלויות נלוות {formatILS(re.closingCosts)} · משכנתא{" "}
                <span className="font-semibold text-term-text">{formatILS(re.loanAmount)}</span> (מימון{" "}
                {formatPct(re.ltv * 100, 0)})
              </>
            }
          />
          {(re.ltvExceeded || re.equityShortfall) && (
            <div className="mt-3 flex gap-2 border-r-2 border-amber bg-amber/10 p-2.5 text-[11.5px] leading-relaxed text-amber">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
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
          kind="percent"
          value={inputs.mortgageRate}
          bound={BOUNDS.mortgageRate}
          accent={RE}
          onChange={(v) => set("mortgageRate", v)}
          hint={`החזר חודשי (שפיצר, ${inputs.mortgageTerm} שנה): ${formatILS(re.monthlyMortgagePayment)}`}
        />
        <SliderInput
          label="תשואת שכירות שנתית נטו"
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
          kind="percent"
          decimals={1}
          value={inputs.appreciation}
          bound={BOUNDS.appreciation}
          accent={RE}
          onChange={(v) => set("appreciation", v)}
        />
      </Pane>

      {/* S&P track */}
      <Pane code="SPX" title="מסלול S&P 500" color={SP}>
        <SliderInput
          label="תשואה שנתית ממוצעת"
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
          kind="percent"
          value={inputs.spFee}
          bound={BOUNDS.spFee}
          accent={SP}
          onChange={(v) => set("spFee", v)}
          hint="קרן אירית / קרן מחקה ישראלית: 0.07%–0.25%"
        />
        <div className="border border-term-line bg-term-2 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-term-text">הפקדה חודשית משלימה</span>
            <Switch
              label="הפקדה חודשית משלימה"
              checked={inputs.cashflowMatching}
              onChange={(v) => set("cashflowMatching", v)}
              accent={SP}
            />
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-term-dim">
            כדי שההשוואה תהיה הוגנת, אם החזר המשכנתא גבוה מהשכירות, ההפרש החודשי מושקע אוטומטית ב-S&P 500. אם
            השכירות גבוהה מההחזר, העודף מושקע במדד בתוך מסלול הנדל״ן.
          </p>
          <p className="mt-2 font-mono text-[12px] text-sp-glow">
            {re.initialMonthlyGap > 0.5 ? (
              <>&gt; {formatILS(re.initialMonthlyGap)} לחודש מהכיס → S&P</>
            ) : re.initialMonthlyGap < -0.5 ? (
              <>&gt; עודף שכירות {formatILS(-re.initialMonthlyGap)} לחודש</>
            ) : (
              <>&gt; השכירות מכסה בדיוק את ההחזר</>
            )}
          </p>
        </div>
      </Pane>

      {/* Advanced */}
      <section className="border-t border-term-line">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="flex w-full items-center justify-between px-4 py-4 sm:px-5"
        >
          <span className="flex items-center gap-2.5">
            <span dir="ltr" className="bg-term-line px-1.5 py-0.5 font-mono text-[11px] font-bold text-term-text">
              ADV
            </span>
            <span className="text-sm font-bold text-term-text">הנחות מתקדמות</span>
          </span>
          <ChevronDown size={16} className={`text-term-dim transition-transform ${advanced ? "rotate-180" : ""}`} />
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
