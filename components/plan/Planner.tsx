"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Moon,
  Sun,
  ShieldCheck,
  CreditCard,
  PiggyBank,
  Receipt,
  CalendarClock,
  Check,
  Copy,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { simulate, breakEvenAppreciation, breakEvenRent, MIN_START_CAPITAL, type SimResult } from "@/lib/calculator";
import { RISK_PROFILES } from "@/lib/presets";
import {
  basics,
  decisionInputs,
  priceRange,
  leverage,
  monthsToMinimum,
  advisorPrompt,
  ADVISOR_QUESTIONS,
  DEFAULT_PROFILE,
  PROFILE_BOUNDS as B,
  COMFORTABLE_PTI,
  EXPENSIVE_DEBT_RATE,
  type Profile,
  type Basics,
  type Answers,
  type PromptDecision,
} from "@/lib/plan";
import { formatILS, formatCompactILS as c, formatPct } from "@/lib/format";
import SliderInput from "../SliderInput";
import { Switch, Segmented } from "../Toggle";
import VerdictBanner from "../VerdictBanner";
import RiskGauges from "../RiskGauges";
import ComboView from "../ComboView";
import { comboCurve, type ComboPoint } from "@/lib/combo";

const STEPS = ["מה יש לכם", "מה חשוב לכם", "קודם כל, הבסיס", "דירה או שוק ההון", "התוכנית שלכם", "התייעצות עם AI"] as const;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-3 text-[13px] font-semibold text-slate-500">{title}</legend>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

function Choice({
  active,
  onClick,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-xl border p-3.5 text-right transition ${
        active
          ? "border-slate-900 bg-white ring-1 ring-slate-900"
          : "border-slate-200 bg-white hover:border-slate-400"
      }`}
    >
      <span className="block text-[14.5px] font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{text}</span>
    </button>
  );
}

function LadderItem({
  icon,
  title,
  amount,
  done,
  children,
}: {
  icon: ReactNode;
  title: string;
  amount?: number;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          done ? "bg-slate-100 text-slate-400" : "bg-slate-900 text-white"
        }`}
      >
        {done ? <Check size={17} /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          {amount !== undefined && amount > 0 && (
            <span className="shrink-0 text-[15px] font-bold tabular-nums text-slate-900">{formatILS(amount)}</span>
          )}
        </div>
        <div className="mt-1 text-[13.5px] leading-relaxed text-slate-600">{children}</div>
      </div>
    </li>
  );
}

function Stat({ label, value, note, warn }: { label: string; value: string; note: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${warn ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="text-[12.5px] font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${warn ? "text-amber-800" : "text-slate-900"}`}>{value}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-slate-600">{note}</p>
    </div>
  );
}

/** "−52%" kept in order inside Hebrew text */
const loss = (share: number) => `\u2066−${formatPct(share * 100, 0)}\u2069`;

/** The most valuable mix when it beats both "all in" options; null otherwise. */
function bestMix(curve: ComboPoint[]): (ComboPoint & { value: number }) | null {
  const ok = curve.filter((x): x is ComboPoint & { value: number } => x.value !== null);
  const best = ok.reduce<(ComboPoint & { value: number }) | null>((a, x) => (!a || x.value > a.value ? x : a), null);
  return best && best.share > 0 && best.share < 100 ? best : null;
}

const winnerName = (r: SimResult) => (r.winner === "realEstate" ? "הדירה" : r.winner === "sp500" ? "ה-S&P 500" : null);

export default function Planner() {
  const [theme, toggleTheme] = useTheme();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [answers, setAnswers] = useState<Answers>({});

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((p) => (p[key] === value ? p : { ...p, [key]: value }));
    setPriceOverride(null);
  };

  const b = useMemo(() => basics(profile), [profile]);
  const decision = useMemo(() => {
    if (step < 3 || b.shortfall) return null;
    const range = priceRange(profile, b);
    const price = Math.min(priceOverride ?? range.suggested, range.bankCap);
    const inputs = decisionInputs(profile, b, price);
    const result = simulate(inputs);
    const curve = comboCurve(inputs, result);
    return {
      range,
      curve,
      bestMix: bestMix(curve),
      price,
      inputs,
      result,
      lev: leverage(result, profile, b),
      be: breakEvenAppreciation(inputs),
      ber: breakEvenRent(inputs),
    };
  }, [step, profile, b, priceOverride]);

  const go = (i: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-[780px] pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))] pb-16 sm:px-6">
      <header className="pt-8 pb-5 sm:pt-12 sm:pb-7">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-500">לפני היועץ · טיוטה</p>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
        <h1 className="mt-1 text-[28px] font-bold leading-tight text-slate-900 [text-wrap:balance] sm:text-4xl">
          מה כדאי לעשות עם הכסף שלכם?
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-slate-600 sm:text-base">
          עוברים יחד, שלב אחר שלב: מה יש לכם, מה חשוב לכם, מה עושים קודם, ומה משאיר לכם יותר בסוף: דירה או שוק ההון.
        </p>
      </header>

      {/* ---------- Progress ---------- */}
      <nav aria-label="שלבים" className="mb-5">
        <p className="mb-2 text-[13px] text-slate-500 sm:hidden">
          שלב {step + 1} מתוך {STEPS.length}: <span className="font-semibold text-slate-800">{STEPS[step]}</span>
        </p>
        <ol className="grid grid-cols-6 gap-1.5">
          {STEPS.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className="group block w-full text-right"
              >
                <span
                  className={`block h-1.5 rounded-full transition ${i <= step ? "bg-slate-900" : "bg-slate-200"}`}
                />
                <span
                  className={`mt-1.5 hidden text-[12.5px] sm:block ${i === step ? "font-semibold text-slate-900" : "text-slate-500 group-hover:text-slate-800"}`}
                >
                  {i + 1}. {name}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main>
        {step === 0 && <StepHave p={profile} set={set} b={b} />}
        {step === 1 && <StepGoals p={profile} set={set} />}
        {step === 2 && <StepBasics p={profile} set={set} b={b} />}
        {step === 3 &&
          (decision ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <h2 className="text-xl font-bold text-slate-900">דירה או שוק ההון?</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-slate-600">
                  בדקנו מה קורה אם שמים את {formatILS(decision.inputs.equity)}
                  {decision.inputs.equity < b.available ? ` (הכלי מחשב עד ${c(decision.inputs.equity)})` : ""}
                  {decision.result.realEstate.oldHomeNetProceeds > 0
                    ? ` ועוד ${c(decision.result.realEstate.oldHomeNetProceeds)} ממכירת הדירה הנוכחית`
                    : ""}{" "}
                  בדירה עם משכנתא, מול השקעה של אותו סכום ב-S&P 500, עם אותה הוצאה חודשית בשני המסלולים.
                </p>
                <div className="mt-5">
                  <SliderInput
                    label="מחיר הדירה"
                    kind="currency"
                    value={decision.price}
                    bound={{ min: 300_000, max: Math.max(310_000, decision.range.bankCap), step: 10_000 }}
                    onChange={(v) => setPriceOverride(v)}
                    hint={
                      <>
                        הבנק יממן עד {c(decision.range.bankCap)}.{" "}
                        {decision.range.limitedBy === "income"
                          ? `לפי ההכנסה, נוח עד ${c(decision.range.comfortable)}: כל ההחזרים עד ${formatPct(COMFORTABLE_PTI * 100, 0)} מההכנסה.`
                          : `גם ההחזר החודשי בטווח הנוח (עד ${formatPct(COMFORTABLE_PTI * 100, 0)} מההכנסה).`}
                      </>
                    }
                  />
                </div>
              </section>
              <VerdictBanner result={decision.result} breakEven={decision.be} breakEvenRent={decision.ber} comboLink={false} />
              <ComboView inputs={decision.inputs} result={decision.result} curve={decision.curve} dark={theme === "dark"} embedded />
              <LeverageCard r={decision.result} lev={decision.lev} b={b} />
              <RiskGauges result={decision.result} />
            </div>
          ) : (
            <ShortfallCard b={b} />
          ))}
        {step === 4 && (
          <StepPlan
            p={profile}
            b={b}
            decision={decision}
            copied={copied}
            onCopy={async (text) => {
              const ok = await copyText(text);
              setCopied(ok ? "ok" : "fail");
              setTimeout(() => setCopied("idle"), 2200);
            }}
          />
        )}
        {step === 5 && (
          <StepAI
            p={profile}
            b={b}
            decision={decision}
            answers={answers}
            setAnswers={setAnswers}
            copied={copied}
            onCopy={async (text) => {
              const ok = await copyText(text);
              setCopied(ok ? "ok" : "fail");
              setTimeout(() => setCopied("idle"), 2200);
            }}
          />
        )}
      </main>

      {/* ---------- Navigation ---------- */}
      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-[14.5px] font-semibold text-slate-700 transition hover:border-slate-500"
          >
            → הקודם
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => go(step + 1)}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-slate-700"
          >
            הבא: {STEPS[step + 1]} ←
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setProfile(DEFAULT_PROFILE);
              setPriceOverride(null);
              setAnswers({});
              go(0);
            }}
            className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-[14.5px] font-semibold text-slate-700 transition hover:border-slate-500"
          >
            להתחיל מחדש
          </button>
        )}
      </div>

      <p className="mt-10 text-[12px] leading-relaxed text-slate-500">
        זה לא ייעוץ השקעות. הכלי מחשב מה קורה לפי ההנחות שבחרתם ולפי כללי המס והבנקאות בישראל, בפישוט. לפני החלטה כדאי
        לבדוק עם יועץ השקעות או מתכנן פיננסי בעל רישיון.
      </p>
    </div>
  );
}

type SetFn = <K extends keyof Profile>(key: K, value: Profile[K]) => void;

function StepHave({ p, set, b }: { p: Profile; set: SetFn; b: Basics }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold text-slate-900">מה יש לכם היום?</h2>
      <p className="mt-1 mb-6 text-[14px] text-slate-600">בערך זה מספיק. אפשר לחזור ולתקן בכל שלב.</p>
      <div className="space-y-6">
        <Group title="כסף שכבר יש לכם">
          <SliderInput label="עו״ש, פיקדונות וחסכונות נזילים" kind="currency" value={p.cash} bound={B.cash} onChange={(v) => set("cash", v)} />
          <SliderInput
            label="השקעות בשוק ההון"
            hint="מניות וקרנות, בלי פנסיה וקופות גמל"
            kind="currency"
            value={p.investments}
            bound={B.investments}
            onChange={(v) => set("investments", v)}
          />
          {p.investments > 0 && (
            <SliderInput
              label="מתוכן רווח שעוד לא מומש"
              hint="כשמוכרים, משלמים 25% מס על הרווח"
              kind="currency"
              value={Math.min(p.investmentsGain, p.investments)}
              bound={{ ...B.investmentsGain, max: Math.max(B.investmentsGain.step, p.investments) }}
              onChange={(v) => set("investmentsGain", v)}
            />
          )}
          <SliderInput
            label="קרן השתלמות שכבר נזילה"
            hint="אחרי 6 שנים אפשר למשוך אותה בלי מס"
            kind="currency"
            value={p.hishtalmut}
            bound={B.hishtalmut}
            onChange={(v) => set("hishtalmut", v)}
          />
        </Group>
        <Group title="דירה">
          <Segmented
            ariaLabel="יש לכם דירה?"
            value={p.home}
            onChange={(v) => set("home", v)}
            options={[
              { value: "none", label: "אין לנו דירה" },
              { value: "own", label: "יש לנו דירה" },
            ]}
          />
          {p.home === "own" && (
            <>
              <SliderInput label="כמה הדירה שווה היום" kind="currency" value={p.homeValue} bound={B.homeValue} onChange={(v) => set("homeValue", v)} />
              <SliderInput label="כמה נשאר לשלם במשכנתא" kind="currency" value={p.homeMortgage} bound={B.homeMortgage} onChange={(v) => set("homeMortgage", v)} />
            </>
          )}
        </Group>
        <Group title="הלוואות אחרות">
          <SliderInput label="יתרת הלוואות" hint="רכב, הלוואה צרכנית, מינוס" kind="currency" value={p.debt} bound={B.debt} onChange={(v) => set("debt", v)} />
          {p.debt > 0 && (
            <SliderInput label="ריבית ההלוואה" kind="percent" decimals={1} value={p.debtRate} bound={B.debtRate} onChange={(v) => set("debtRate", v)} />
          )}
        </Group>
        <Group title="כל חודש">
          <SliderInput label="הכנסה נטו של משק הבית" kind="currency" value={p.income} bound={B.income} onChange={(v) => set("income", v)} />
          <SliderInput
            label="הוצאות בחודש"
            hint="כולל שכירות או משכנתא, אם יש"
            kind="currency"
            value={p.expenses}
            bound={B.expenses}
            onChange={(v) => set("expenses", v)}
          />
          <p className={`rounded-lg px-3.5 py-2.5 text-[14px] font-medium ${b.monthlySaving > 0 ? "bg-slate-50 text-slate-800" : "bg-amber-50 text-amber-900"}`}>
            {b.monthlySaving > 0
              ? `נשארים לכם כ-${formatILS(b.monthlySaving)} בחודש לחיסכון.`
              : "ההוצאות גבוהות מההכנסה. לפני כל השקעה, כדאי לאזן את התקציב."}
          </p>
        </Group>
      </div>
    </section>
  );
}

function StepGoals({ p, set }: { p: Profile; set: SetFn }) {
  const own = p.home === "own";
  const risk = RISK_PROFILES[p.risk];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold text-slate-900">מה חשוב לכם?</h2>
      <p className="mt-1 mb-6 text-[14px] text-slate-600">אין תשובות נכונות. זה מה שקובע מה נשווה.</p>
      <div className="space-y-6">
        <Group title="אם קונים דירה, מה התוכנית?">
          <div role="radiogroup" aria-label="מה התוכנית" className="grid gap-2.5 sm:grid-cols-2">
            <Choice
              active={p.homePlan === "live"}
              onClick={() => set("homePlan", "live")}
              title={own ? "לעבור לדירה אחרת" : "לקנות דירה ולגור בה"}
              text={own ? "מוכרים את הדירה שלנו וקונים אחרת, למשל גדולה יותר" : "במקום לשלם שכירות, משלמים משכנתא"}
            />
            <Choice
              active={p.homePlan === "invest"}
              onClick={() => set("homePlan", "invest")}
              title={own ? "עוד דירה להשקעה" : "דירה להשקעה"}
              text={own ? "נשארים בדירה שלנו וקונים עוד אחת להשכרה" : "קונים ומשכירים, וממשיכים לגור בשכירות"}
            />
          </div>
        </Group>
        <Group title="זמן ותוכניות">
          <SliderInput label="לכמה שנים?" hint="עד שתרצו להשתמש בכסף" kind="years" value={p.years} bound={B.years} onChange={(v) => set("years", v)} />
          <SliderInput
            label="הוצאה גדולה ב-3 השנים הקרובות"
            hint="חתונה, רכב, שיפוץ. נשמור אותה בצד"
            kind="currency"
            value={p.bigExpense}
            bound={B.bigExpense}
            onChange={(v) => set("bigExpense", v)}
          />
          <SliderInput
            label="כרית ביטחון: כמה חודשי הוצאות לשמור"
            hint="כלל אצבע: 3 עד 6 חודשים, יותר אם ההכנסה לא יציבה"
            kind="months"
            value={p.cushionMonths}
            bound={B.cushionMonths}
            onChange={(v) => set("cushionMonths", v)}
          />
        </Group>
        <Group title="כמה אתם שמרנים?">
          <div role="radiogroup" aria-label="כמה אתם שמרנים" className="grid grid-cols-5 gap-1.5">
            {RISK_PROFILES.map((r, i) => (
              <button
                key={r.label}
                type="button"
                role="radio"
                aria-checked={i === p.risk}
                onClick={() => set("risk", i)}
                className={`rounded-lg border px-1 py-2 text-[12.5px] font-semibold transition sm:text-[13.5px] ${
                  i === p.risk
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-slate-600">ההנחות: {risk.description}.</p>
        </Group>
      </div>
    </section>
  );
}

function StepBasics({ p, set, b }: { p: Profile; set: SetFn; b: Basics }) {
  const upgraderEquity = p.home === "own" && p.homePlan === "live" ? Math.max(0, p.homeValue - p.homeMortgage) : 0;
  const months = monthsToMinimum(b);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold text-slate-900">קודם כל, הבסיס</h2>
      <p className="mt-1 mb-6 text-[14px] text-slate-600">
        לפני שממנפים, מסדרים את מה שמגן עליכם. זה הסדר שרוב המתכננים הפיננסיים ממליצים עליו.
      </p>
      <ol className="divide-y divide-slate-100">
        <LadderItem icon={<ShieldCheck size={17} />} title="כרית ביטחון" amount={b.cushion}>
          {p.cushionMonths} חודשי הוצאות בצד, בפיקדון או בקרן כספית. את הכסף הזה לא משקיעים ולא ממנפים.
          {b.cushion < b.cushionTarget && (
            <> יש לכם כרגע {formatILS(b.cushion)} מתוך {formatILS(b.cushionTarget)}, ואת השאר משלימים מהחיסכון החודשי.</>
          )}
        </LadderItem>
        {b.bigExpense > 0 && (
          <LadderItem icon={<CalendarClock size={17} />} title="ההוצאה הגדולה שמתוכננת" amount={b.bigExpense}>
            כסף שתצטרכו בקרוב לא שמים בדירה או במניות. שומרים אותו בצד.
            {b.bigExpense < p.bigExpense && <> חסרים עוד {formatILS(p.bigExpense - b.bigExpense)}, מהחיסכון החודשי.</>}
          </LadderItem>
        )}
        {p.debt > 0 ? (
          p.debtRate >= EXPENSIVE_DEBT_RATE ? (
            <LadderItem icon={<CreditCard size={17} />} title="להחזיר את ההלוואה" amount={b.debtPayoff}>
              ריבית של {formatPct(p.debtRate, 1)} היא יקרה. כל שקל שמחזירים חוסך {formatPct(p.debtRate, 1)} בשנה בלי שום סיכון, יותר ממה
              שסביר לצפות מהשקעה.
              {b.debtKept > 0 && (
                <>
                  {" "}
                  {b.debtPayoff > 0 ? `נשארים ${formatILS(b.debtKept)}` : "כרגע אין כסף פנוי להחזר"}: כדאי להחזיר מהחיסכון החודשי לפני כל
                  השקעה.
                </>
              )}
            </LadderItem>
          ) : (
            <LadderItem icon={<CreditCard size={17} />} title="ההלוואה זולה" done>
              ריבית של {formatPct(p.debtRate, 1)} נמוכה, אז אפשר להשאיר אותה. ההחזר החודשי שלה נכנס לחישוב של כמה משכנתא נוח לכם.
            </LadderItem>
          )
        ) : (
          <LadderItem icon={<CreditCard size={17} />} title="אין הלוואות יקרות" done>
            מצוין, אין מה להחזיר קודם.
          </LadderItem>
        )}
        {b.saleTax > 0 && (
          <LadderItem icon={<Receipt size={17} />} title="מס על מכירת ההשקעות" amount={b.saleTax}>
            כדי להשתמש בכסף שבתיק צריך למכור, ואז משלמים 25% מס על הרווח. הורדנו את המס מהסכום. יועץ טוב יכול לעזור לתזמן את
            המכירה.
          </LadderItem>
        )}
        {p.hishtalmut > 0 && (
          <LadderItem icon={<PiggyBank size={17} />} title="קרן השתלמות" done={!p.useHishtalmut}>
            <p>
              {p.useHishtalmut
                ? "צירפתם את הקרן לסכום. שימו לב: כסף שנשאר בקרן ממשיך להרוויח בלי מס, וזה יתרון שקשה להשיג במקום אחר."
                : "השארנו אותה בצד: הרווחים בה פטורים ממס, וחבל לוותר על זה. אם תרצו, אפשר לצרף אותה."}
            </p>
            <div className="mt-2.5 flex items-center gap-2.5">
              <Switch checked={p.useHishtalmut} onChange={(v) => set("useHishtalmut", v)} label={`לצרף את קרן ההשתלמות (${c(p.hishtalmut)})`} />
              <span className="text-[13.5px] font-medium text-slate-700" aria-hidden>
                לצרף את קרן ההשתלמות ({c(p.hishtalmut)})
              </span>
            </div>
          </LadderItem>
        )}
      </ol>

      <div className={`mt-6 rounded-xl p-5 ${b.shortfall ? "bg-amber-50" : "bg-slate-50"}`}>
        <p className="text-[13px] font-semibold text-slate-500">נשאר לכם להשקיע</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{formatILS(b.available)}</p>
        {upgraderEquity > 0 && (
          <p className="mt-1 text-[13.5px] text-slate-600">ועוד ההון שבדירה הנוכחית, כ-{c(upgraderEquity)} לפני הוצאות המכירה.</p>
        )}
        {b.shortfall ? (
          <p className="mt-2 text-[14px] leading-relaxed text-amber-900">
            לדירה צריך לפחות {c(MIN_START_CAPITAL)} למקדמה ולהוצאות.{" "}
            {Number.isFinite(months)
              ? `בקצב החיסכון של היום תגיעו לשם בעוד כ-${months} חודשים.`
              : "כדאי קודם לפנות מקום לחיסכון חודשי."}
          </p>
        ) : (
          <p className="mt-1 text-[13.5px] text-slate-600">ובנוסף, כ-{formatILS(Math.max(0, b.monthlySaving))} בחודש מהחיסכון השוטף.</p>
        )}
      </div>
    </section>
  );
}

function LeverageCard({ r, lev, b }: { r: SimResult; lev: ReturnType<typeof leverage>; b: Basics }) {
  const re = r.realEstate;
  const pocketWarn = lev.monthlyFromPocket > Math.max(0, b.monthlySaving);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h3 className="text-lg font-bold text-slate-900">המנוף במספרים</h3>
      <p className="mt-0.5 text-[13px] text-slate-500">
        משכנתא של {c(re.loanAmount)} על דירה ב-{c(re.propertyPrice)}. מינוף מגדיל את הרווח, וגם את ההפסד.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stat label="שווי דירה על כל שקל שלכם" value={`פי ${lev.exposure.toFixed(1)}`} note="במדד: פי 1, בלי הלוואה" />
        <Stat
          label="אם מחירי הדירות יירדו 15%"
          value={loss(lev.aptDropLoss)}
          note={`מהכסף שלכם. ירידה של 35% במדד: ${loss(lev.spDropLoss)}`}
          warn={lev.aptDropLoss > 0.5}
        />
        <Stat
          label="החזרים מתוך ההכנסה"
          value={formatPct(lev.pti * 100, 0)}
          note={lev.pti > COMFORTABLE_PTI ? "מעל 30%. הבנק עשוי לאשר, אבל זה דוחק" : "בטווח הנוח, עד 30%"}
          warn={lev.pti > COMFORTABLE_PTI}
        />
        <Stat
          label="תוספת מהכיס בכל חודש"
          value={formatILS(Math.max(0, lev.monthlyFromPocket))}
          note={
            pocketWarn
              ? `יותר ממה שאתם חוסכים היום (${c(Math.max(0, b.monthlySaving))})`
              : `מתוך ${c(Math.max(0, b.monthlySaving))} שאתם חוסכים. אותו סכום נכנס גם למדד`
          }
          warn={pocketWarn}
        />
      </div>
    </section>
  );
}

function ShortfallCard({ b }: { b: Basics }) {
  const months = monthsToMinimum(b);
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-7">
      <h2 className="flex items-center gap-2 text-xl font-bold text-amber-900">
        <AlertTriangle size={20} /> עוד מוקדם לדירה
      </h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-amber-900">
        אחרי הבסיס נשארים {formatILS(b.available)}, ולדירה צריך לפחות {c(MIN_START_CAPITAL)}.{" "}
        {Number.isFinite(months) ? `בקצב החיסכון של היום, זה ייקח כ-${months} חודשים.` : ""} בינתיים, חיסכון חודשי קבוע בקרן מחקה מדד
        בדמי ניהול נמוכים בונה את ההון הזה, ונשאר נזיל אם תחליטו לקנות.
      </p>
    </section>
  );
}

function StepPlan({
  p,
  b,
  decision,
  copied,
  onCopy,
}: {
  p: Profile;
  b: Basics;
  decision: {
    result: SimResult;
    price: number;
    be: { value: number | null; below: boolean };
    bestMix: (ComboPoint & { value: number }) | null;
  } | null;
  copied: "idle" | "ok" | "fail";
  onCopy: (text: string) => void;
}) {
  const steps: string[] = [];
  if (b.monthlySaving <= 0) steps.push("לאזן את התקציב החודשי. כל עוד ההוצאות גבוהות מההכנסה, משכנתא או השקעה חודשית לא יחזיקו.");
  steps.push(
    b.cushion < b.cushionTarget
      ? `לבנות כרית ביטחון של ${formatILS(b.cushionTarget)} בפיקדון או בקרן כספית: יש ${formatILS(b.cushion)}, ומשלימים מהחיסכון החודשי.`
      : `לשים ${formatILS(b.cushion)} בצד, כרית ביטחון בפיקדון או בקרן כספית.`,
  );
  if (p.bigExpense > 0) steps.push(`לשמור ${formatILS(p.bigExpense)} להוצאה הגדולה שמתוכננת.`);
  if (p.debt > 0 && p.debtRate >= EXPENSIVE_DEBT_RATE)
    steps.push(
      b.debtKept > 0
        ? `להחזיר את ההלוואה (${formatILS(p.debt)}, ריבית ${formatPct(p.debtRate, 1)})${b.debtPayoff > 0 ? `: ${formatILS(b.debtPayoff)} עכשיו, והשאר מהחיסכון החודשי` : " מהחיסכון החודשי"}.`
        : `להחזיר את ההלוואה של ${formatILS(b.debtPayoff)} (ריבית ${formatPct(p.debtRate, 1)}).`,
    );
  steps.push("להמשיך להפקיד לקרן השתלמות עד התקרה הפטורה ממס. זה החיסכון המשתלם ביותר מבחינת מס.");

  const r = decision?.result;
  const name = r ? winnerName(r) : null;
  let big: string;
  if (!r) big = `לחסוך כל חודש בקרן מחקה מדד, עד שיהיו לכם לפחות ${c(MIN_START_CAPITAL)} להון עצמי.`;
  else if (r.winner === "sp500")
    big =
      r.realEstate.oldHomeNetProceeds > 0
        ? `ההשוואה הייתה: מעבר לדירה החדשה, מול מכירת הדירה והשקעה של הכול (${c(r.realEstate.startCapital)}) במדד ומגורים בשכירות. המדד יצא משתלם יותר. אם למכור ולשכור לא בא בחשבון, כדאי לבדוק עם יועץ אפשרות שלישית: להישאר בדירה ולהשקיע במדד רק את ${c(b.available)}.`
        : `בחישוב, השקעה של ${formatILS(b.available)} במדד S&P 500 (למשל בקרן מחקה בדמי ניהול נמוכים) והפקדה חודשית משאירות יותר מדירה.`;
  else if (r.winner === "realEstate")
    big = `בחישוב, דירה בסביבות ${c(decision!.price)} עם משכנתא של כ-${c(r.realEstate.loanAmount)} משאירה יותר מהשקעה במדד.`;
  else big = "שני המסלולים קרובים מאוד. אפשר לשלב: חלק בדירה וחלק במדד.";
  steps.push(big);
  const mix = decision?.bestMix;
  if (r && mix && mix.value > Math.max(r.realEstate.netWorth, r.sp500.netWorth))
    steps.push(
      `שווה לשקול שילוב: בחישוב, ${mix.share}% מהכסף לדירה${mix.price ? ` (דירה בסביבות ${c(mix.price)})` : ""} והשאר במדד משאירים ${c(mix.value)}, יותר משני המסלולים לבד.`,
    );

  const why = r && name ? `לפי ההנחות שלכם, ${name} ${r.winner === "realEstate" ? "משאירה" : "משאיר"} כ-${c(r.difference)} יותר אחרי ${p.years} שנה.` : null;
  const flip =
    r && decision?.be.value != null
      ? r.winner === "realEstate"
        ? `התשובה תתהפך אם מחירי הדירות יעלו פחות מ-${formatPct(decision.be.value, 1)} בשנה.`
        : `הדירה תנצח רק אם המחירים יעלו ביותר מ-${formatPct(decision.be.value, 1)} בשנה.`
      : null;

  const questions = [
    "האם אתה מקבל עמלה על המוצרים שאתה ממליץ עליהם?",
    `כמה אשלם בדמי ניהול, וכמה זה יוצא אחרי ${p.years} שנה?`,
    "איך כדאי למכור את התיק הקיים כדי לשלם פחות מס?",
    "אם לוקחים משכנתא: איזה תמהיל מתאים לי, ומה קורה אם הריבית עולה ב-2%?",
    "יש לי מספיק ביטוח חיים ואובדן כושר עבודה?",
  ];

  const summary = [
    "התוכנית שלי (לפני היועץ):",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    ...(why ? [why] : []),
    ...(flip ? [flip] : []),
    "",
    "שאלות ליועץ:",
    ...questions.map((q) => `• ${q}`),
  ]
    .join("\n")
    .replace(/[⁦-⁩]/g, "");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-bold text-slate-900">התוכנית שלכם, לפי הסדר</h2>
        <p className="mt-1 text-[13px] text-slate-500">סיכום של החישוב לפי הנתונים וההנחות שלכם. לא המלצה אישית.</p>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-slate-800">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[13px] font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        {(why || flip) && (
          <p className="mt-5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-700">
            {why} {flip}
          </p>
        )}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h3 className="text-lg font-bold text-slate-900">שאלות טובות ליועץ</h3>
        <p className="mt-0.5 text-[13px] text-slate-500">כדי להגיע לפגישה מוכנים, ולדעת אם היועץ עובד בשבילכם</p>
        <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[14px] leading-relaxed text-slate-700">
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onCopy(summary)}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-slate-700"
        >
          {copied === "ok" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "ok" ? "הועתק!" : copied === "fail" ? "ההעתקה נכשלה" : "להעתיק את התוכנית"}
        </button>
      </section>
    </div>
  );
}

function StepAI({
  p,
  b,
  decision,
  answers,
  setAnswers,
  copied,
  onCopy,
}: {
  p: Profile;
  b: Basics;
  decision: PromptDecision | null;
  answers: Answers;
  setAnswers: (f: (a: Answers) => Answers) => void;
  copied: "idle" | "ok" | "fail";
  onCopy: (text: string) => void;
}) {
  const prompt = advisorPrompt(p, b, decision, answers);
  const left = ADVISOR_QUESTIONS.filter((q) => !answers[q.key]).length;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-bold text-slate-900">שאלות שיועץ היה שואל</h2>
        <p className="mt-1 text-[14px] text-slate-600">לא חובה. על מה שלא תענו, הבינה המלאכותית תשאל אתכם בעצמה.</p>
        <div className="mt-5 space-y-4">
          {ADVISOR_QUESTIONS.map((q) => (
            <div key={q.key}>
              <p className="text-[13.5px] font-medium text-slate-700">{q.label}</p>
              <div role="radiogroup" aria-label={q.label} className="mt-1.5 flex flex-wrap gap-1.5">
                {q.options.map((o) => {
                  const on = answers[q.key] === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: a[q.key] === o ? undefined : o }))}
                      className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                        on ? "border-slate-900 bg-slate-900 font-semibold text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <label className="block">
            <span className="text-[13.5px] font-medium text-slate-700">עוד משהו שחשוב שהיועץ יידע</span>
            <textarea
              rows={2}
              value={answers.note ?? ""}
              onChange={(e) => {
                const note = e.target.value;
                setAnswers((a) => ({ ...a, note }));
              }}
              placeholder="למשל: צפויה עזרה מההורים, מתכננים ילד, רוצים לפרוש מוקדם"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Sparkles size={19} aria-hidden /> הפרומפט שלכם
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-600">
          מעתיקים ומדביקים בצ׳אט עם בינה מלאכותית, כמו Claude, ChatGPT או Gemini. היא תשאל קודם את מה שחסר
          {left > 0 ? ` (${left} מהשאלות כאן ועוד כמה שאלות עומק)` : " (שאלות עומק שאי אפשר לענות עליהן בכפתור)"}, ורק אז תציע תוכנית.
        </p>
        <textarea
          readOnly
          value={prompt}
          rows={14}
          aria-label="הפרומפט"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-700 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onCopy(prompt)}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-slate-700"
        >
          {copied === "ok" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "ok" ? "הועתק!" : copied === "fail" ? "ההעתקה נכשלה, אפשר לסמן ולהעתיק ידנית" : "להעתיק את הפרומפט"}
        </button>
        <ul className="mt-5 list-disc space-y-1 ps-5 text-[12.5px] leading-relaxed text-slate-500">
          <li>הפרומפט כולל רק מספרים. אל תוסיפו בצ׳אט שם, תעודת זהות או מספרי חשבון.</li>
          <li>בינה מלאכותית יכולה לטעות, במיוחד במספרי מס עדכניים. את מה שחשוב, בדקו במקור.</li>
          <li>זה לא מחליף יועץ מורשה, אבל תגיעו לפגישה מוכנים הרבה יותר.</li>
        </ul>
      </section>
    </div>
  );
}
