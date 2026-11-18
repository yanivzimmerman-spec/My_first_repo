"use client";

import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { BOUNDS, MAX_LTV, MIN_START_CAPITAL, type ApartmentType, type SimInputs, type SimResult } from "@/lib/calculator";
import { formatCompactILS, formatILS, formatPct } from "@/lib/format";
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
  single: "זו תהיה הדירה היחידה שלכם. מס רכישה נמוך, ואין מס כשמוכרים. הבנק מממן עד 75%.",
  upgrader: "מוכרים את הדירה שיש לכם וקונים אחרת. מס רכישה כמו דירה יחידה, והבנק מממן עד 70%.",
  additional: "יש לכם כבר דירה ואתם שומרים אותה. מס רכישה 8%, מס 25% על הרווח כשמוכרים, והבנק מממן עד 50%.",
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

/** An optional add-on: a switch with a one-line explanation; its settings appear when switched on. */
function AddOn({
  title,
  description,
  checked,
  onChange,
  accent,
  children,
}: {
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4 transition-colors"
      style={{ borderColor: checked ? `${accent}55` : "#E2E8F0", background: checked ? `${accent}08` : "#FFFFFF" }}
    >
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span>
          <span className="block text-[15px] font-medium text-slate-800">{title}</span>
          <span className="mt-1 block text-[13px] leading-relaxed text-slate-500">{description}</span>
        </span>
        <span className="mt-0.5">
          <Switch label={title} checked={checked} onChange={onChange} accent={accent} />
        </span>
      </label>
      {checked && children && <div className="mt-5 space-y-6">{children}</div>}
    </div>
  );
}

export default function ControlPanel({ inputs, result, set }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const re = result.realEstate;
  const sp = result.sp500;
  const type = inputs.apartmentType;
  const price = re.propertyPrice;

  // Rent is asked in ₪ per month; the engine keeps it as a yield on the price.
  const rent = (price * inputs.rentalYield) / 1200;
  const rentBound = {
    min: Math.ceil((price * BOUNDS.rentalYield.min) / 1200 / 50) * 50,
    max: Math.floor((price * BOUNDS.rentalYield.max) / 1200 / 50) * 50,
    step: 50,
  };
  const futureValue = price * Math.pow(1 + inputs.appreciation / 100, inputs.years);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* ---------------- Basic ---------------- */}
      <Group title="הנתונים שלכם">
        <SliderInput
          label={type === "upgrader" ? "כמה כסף יש לכם, בנוסף לדירה?" : "כמה כסף יש לכם?"}
          kind="currency"
          value={inputs.equity}
          bound={{
            ...BOUNDS.equity,
            min: Math.max(0, MIN_START_CAPITAL - re.oldHomeNetProceeds),
          }}
          onChange={(v) => set("equity", v)}
          hint={type === "upgrader" ? "מזומן או חסכונות. הכסף ממכירת הדירה נוסף בהמשך" : "ההון העצמי שאתם יכולים להשקיע היום"}
        />
        <SliderInput
          label="לכמה שנים?"
          kind="years"
          value={inputs.years}
          bound={BOUNDS.years}
          onChange={(v) => set("years", Math.round(v))}
        />
      </Group>

      <Group title="הדירה" color={RE}>
        <div>
          <p className="mb-2 text-[15px] text-slate-700">יש לכם כבר דירה?</p>
          <Segmented
            ariaLabel="סוג הדירה"
            accent={RE}
            value={type}
            onChange={(v) => set("apartmentType", v)}
            options={[
              { value: "single", label: "אין לי" },
              { value: "upgrader", label: "יש, ואמכור" },
              { value: "additional", label: "יש, ואשמור" },
            ]}
          />
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{TYPE_TEXT[type]}</p>
        </div>

        {type === "upgrader" && (
          <div className="space-y-6 rounded-xl border border-slate-200 p-4">
            <SliderInput
              label="כמה שווה הדירה שלכם היום?"
              kind="currency"
              value={inputs.oldHomeValue}
              bound={BOUNDS.oldHomeValue}
              accent={RE}
              onChange={(v) => set("oldHomeValue", v)}
            />
            <SliderInput
              label="כמה נשאר לשלם על המשכנתא שלה?"
              kind="currency"
              value={inputs.oldHomeMortgage}
              bound={{ ...BOUNDS.oldHomeMortgage, max: inputs.oldHomeValue }}
              accent={RE}
              onChange={(v) => set("oldHomeMortgage", v)}
            />
            <p className="text-[13px] leading-relaxed text-slate-600">
              אחרי עמלות מכירה של {formatILS(re.oldHomeSellingCosts)} וסגירת המשכנתא נשארים לכם{" "}
              <span className="font-semibold text-slate-900">{formatILS(re.oldHomeNetProceeds)}</span>. יחד עם המזומן זה{" "}
              <span className="font-semibold text-slate-900">{formatILS(re.startCapital)}</span>, ואותו סכום מושקע גם במסלול
              ה-S&P.
            </p>
            {re.oldHomeAboveCeiling && (
              <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                הדירה שווה יותר מתקרת הפטור (₪5,008,000), כך שייתכן מס שבח חלקי על המכירה. הוא לא נכלל בחישוב.
              </p>
            )}
          </div>
        )}

        <div>
          <SliderInput
            label="מחיר הדירה"
            kind="currency"
            value={price}
            bound={{ ...BOUNDS.propertyPrice, max: re.maxPrice }}
            accent={RE}
            disabled={inputs.autoPrice}
            onChange={(v) => set("propertyPrice", v)}
            hint={
              <>
                משכנתא של {formatILS(re.loanAmount)}, החזר חודשי{" "}
                <span className="font-semibold text-slate-800">{formatILS(re.monthlyMortgagePayment)}</span>
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
              עם {formatILS(re.startCapital)}
              {inputs.loanEnabled && <> ועוד הלוואה של {formatILS(inputs.loanAmount)}</>} אפשר לקנות {TYPE_NAME[type]} עד{" "}
              <span className="font-semibold text-slate-900">{formatILS(re.maxPrice)}</span>. הבנק מממן עד{" "}
              {formatPct(MAX_LTV[type] * 100, 0)}, ואת השאר, כולל מס רכישה של {formatILS(re.purchaseTax)} ועלויות
              קנייה, אתם משלמים.
            </p>
          </div>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-[13px] text-slate-600">
            <span>קנו את הדירה היקרה ביותר שהבנק יממן</span>
            <Switch label="מחיר מקסימלי אוטומטי" checked={inputs.autoPrice} onChange={(v) => set("autoPrice", v)} accent={RE} />
          </label>
        </div>

        <SliderInput
          label="שכר דירה חודשי"
          kind="currency"
          value={Math.round(rent / 10) * 10}
          bound={rentBound}
          accent={RE}
          onChange={(v) => set("rentalYield", Math.min(BOUNDS.rentalYield.max, Math.max(BOUNDS.rentalYield.min, (v * 1200) / price)))}
          hint={
            <>
              אחרי חודש פנוי בשנה, תחזוקה, ביטוח ומס, נשארים לכם בערך{" "}
              <span className="font-semibold text-slate-800">{formatILS(re.initialMonthlyRentNet)}</span> בחודש
            </>
          }
        />

        <SliderInput
          label="בכמה יעלו מחירי הדירות בשנה?"
          kind="percent"
          decimals={1}
          value={inputs.appreciation}
          bound={BOUNDS.appreciation}
          accent={RE}
          onChange={(v) => set("appreciation", v)}
          hint={`בעוד ${inputs.years} שנה הדירה תהיה שווה כ-${formatCompactILS(futureValue)}`}
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
          hint="בעבר: כ-9.5% בשנה בדולרים, כ-8.5% עד 9% בשקלים. לא מובטח."
        />
      </Group>

      {/* ---------------- Optional add-ons ---------------- */}
      <Group title="תוספות לבחירתכם">
        <AddOn
          title="להשקיע את ההפרש החודשי"
          accent={SP}
          checked={inputs.cashflowMatching}
          onChange={(v) => set("cashflowMatching", v)}
          description={
            inputs.cashflowMatching ? (
              <>
                מה שאתם מוסיפים כל חודש לדירה מושקע גם במדד, כך ששני המסלולים מקבלים בדיוק אותו כסף.
                {re.initialMonthlyOwn > 0.5 && <> כרגע {formatILS(re.initialMonthlyOwn)} בחודש.</>}
              </>
            ) : (
              <>כבוי: ה-S&P מקבל רק את ההשקעה הראשונה, והתוספות החודשיות לדירה לא מושקעות. ההשוואה פחות הוגנת.</>
            )
          }
        />

        <AddOn
          title="הלוואה לקניית הדירה"
          accent={LOAN}
          checked={inputs.loanEnabled}
          onChange={(v) => set("loanEnabled", v)}
          description={'הלוואה אישית או "כל מטרה" שמגדילה את הכסף לקנייה, כדי לקנות דירה יקרה יותר.'}
        >
          <SliderInput
            label="סכום"
            kind="currency"
            value={inputs.loanAmount}
            bound={BOUNDS.loanAmount}
            accent={LOAN}
            onChange={(v) => set("loanAmount", v)}
          />
          <SliderInput
            label="ריבית"
            kind="percent"
            decimals={1}
            value={inputs.loanRate}
            bound={BOUNDS.loanRate}
            accent={LOAN}
            onChange={(v) => set("loanRate", v)}
            hint="בדרך כלל 7% עד 9%"
          />
          <SliderInput
            label="לכמה שנים"
            kind="years"
            value={inputs.loanTerm}
            bound={BOUNDS.loanTerm}
            accent={LOAN}
            onChange={(v) => set("loanTerm", Math.round(v))}
            hint={`החזר חודשי: ${formatILS(re.extraLoanPayment)}`}
          />
          <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            הבנק בודק מאיפה ההון העצמי, וההחזרים של כל ההלוואות נספרים במגבלה של 50% מההכנסה. ייתכן שהמשכנתא לא תאושר.
          </p>
        </AddOn>

        <AddOn
          title="הלוואה להשקעה ב-S&P 500"
          accent={LOAN}
          checked={inputs.spLoanEnabled}
          onChange={(v) => set("spLoanEnabled", v)}
          description="לווים כסף ומשקיעים אותו במדד כבר ביום הראשון, כמו שהמשכנתא ממנפת את הדירה."
        >
          <SliderInput
            label="סכום"
            kind="currency"
            value={inputs.spLoanAmount}
            bound={BOUNDS.spLoanAmount}
            accent={LOAN}
            onChange={(v) => set("spLoanAmount", v)}
          />
          <SliderInput
            label="ריבית"
            kind="percent"
            decimals={1}
            value={inputs.spLoanRate}
            bound={BOUNDS.spLoanRate}
            accent={LOAN}
            onChange={(v) => set("spLoanRate", v)}
            hint="הלוואה כנגד תיק השקעות: בדרך כלל פריים + 1% עד 2% (כ-6% עד 7%)"
          />
          <SliderInput
            label="לכמה שנים"
            kind="years"
            value={inputs.spLoanTerm}
            bound={BOUNDS.spLoanTerm}
            accent={LOAN}
            onChange={(v) => set("spLoanTerm", Math.round(v))}
            hint={`החזר חודשי: ${formatILS(sp.loanPayment)}`}
          />
          <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            השקעה בכסף מושאל מגדילה גם את ההפסד כשהשוק יורד. בירידה חדה הבנק עלול לדרוש החזר מיידי.
          </p>
        </AddOn>
      </Group>

      {/* ---------------- Advanced ---------------- */}
      <section className="border-t border-slate-100">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="flex w-full items-center justify-between px-5 py-4 text-[13px] font-semibold text-slate-500 hover:text-slate-800 sm:px-6"
        >
          <span>
            הגדרות מתקדמות
            <span className="mr-2 font-normal text-slate-400">ריבית, עמלות, מיסוי ואינפלציה</span>
          </span>
          <ChevronDown size={16} className={`transition-transform ${advanced ? "rotate-180" : ""}`} />
        </button>
        {advanced && (
          <div className="space-y-6 px-5 pb-6 sm:px-6">
            <SliderInput
              label="ריבית משכנתא"
              kind="percent"
              value={inputs.mortgageRate}
              bound={BOUNDS.mortgageRate}
              accent={RE}
              onChange={(v) => set("mortgageRate", v)}
              hint="ממוצע לכל המסלולים. ב-2026 כ-4.6% עד 4.8%"
            />
            <SliderInput
              label="תקופת המשכנתא"
              kind="years"
              value={inputs.mortgageTerm}
              bound={BOUNDS.mortgageTerm}
              accent={RE}
              onChange={(v) => set("mortgageTerm", Math.round(v))}
              hint="עד 30 שנה"
            />
            <div>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-[15px] text-slate-700">קנייה ומכירה דרך מתווך</span>
                <Switch label="מתווך" checked={inputs.useBroker} onChange={(v) => set("useBroker", v)} accent={RE} />
              </label>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                {inputs.useBroker ? "תיווך 2% ועו״ד 0.5% (+ מע״מ) בכל צד." : "עו״ד 0.5% (+ מע״מ) בכל צד."} ועוד כ-₪10,000 בקנייה
                לשמאי, יועץ משכנתאות ועמלות.
              </p>
            </div>
            <SliderInput
              label="עליית שכר הדירה בשנה"
              kind="percent"
              decimals={1}
              value={inputs.rentGrowth}
              bound={BOUNDS.rentGrowth}
              accent={RE}
              onChange={(v) => set("rentGrowth", v)}
            />
            <div>
              <p className="mb-2 text-[15px] text-slate-700">איך משקיעים ב-S&P 500?</p>
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
                  ? "מס 25% רק על הרווח שמעל האינפלציה."
                  : "מס 25% על כל הרווח בשקלים (צמוד לדולר, כאן בהנחה שהשער לא משתנה)."}
              </p>
            </div>
            <SliderInput
              label="דמי ניהול"
              kind="percent"
              value={inputs.spFee}
              bound={BOUNDS.spFee}
              accent={SP}
              onChange={(v) => set("spFee", v)}
            />
            <SliderInput
              label="אינפלציה שנתית"
              kind="percent"
              decimals={1}
              value={inputs.inflation}
              bound={BOUNDS.inflation}
              onChange={(v) => set("inflation", v)}
              hint="יעד בנק ישראל: 1% עד 3%"
            />
          </div>
        )}
      </section>
    </div>
  );
}
