"use client";

import { Home, KeyRound, Repeat, Plus, ArrowLeftRight, Building2 } from "lucide-react";
import type { SimInputs } from "@/lib/calculator";
import { SITUATIONS, matchSituation, situationInputs, type Situation } from "@/lib/presets";
import { formatCompactILS as c } from "@/lib/format";
import Sources from "./Sources";

const ICONS: Record<Situation["icon"], typeof Home> = {
  home: Home,
  key: KeyRound,
  swap: Repeat,
  plus: Plus,
  move: ArrowLeftRight,
  two: Building2,
};

/** Statistics as published, two decimals: ₪1.13M. */
const m = (v: number) => `\u2066₪${(v / 1_000_000).toFixed(2)}M\u2069`;

/** One short line with the example's numbers. */
function exampleLine(s: Situation): string {
  const e = s.example;
  if (s.id === "upgrade" && e.oldHomeValue) return `מוכרים ב-${c(e.oldHomeValue)} · קונים ב-${c(e.propertyPrice)}`;
  return `${c(e.equity)} הון · דירה ב-${c(e.propertyPrice)}`;
}

/** Draft: "מה המצב שלכם?" — cards for the main situations, replacing the example chips. */
export default function SituationPicker({
  inputs,
  set,
}: {
  inputs: SimInputs;
  set: <K extends keyof SimInputs>(key: K, value: SimInputs[K]) => void;
}) {
  const current = matchSituation(inputs);
  return (
    <div className="mt-6">
      <p className="mb-3 text-[15px] font-semibold text-slate-800">מה המצב שלכם?</p>
      <div role="radiogroup" aria-label="מה המצב שלכם" className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-3">
        {SITUATIONS.map((s) => {
          const Icon = ICONS[s.icon];
          const active = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                const next = situationInputs(s);
                (Object.keys(next) as (keyof SimInputs)[]).forEach((k) => set(k, next[k] as SimInputs[typeof k]));
              }}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-right transition sm:items-start sm:gap-3 sm:p-3.5 ${
                active
                  ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900 dark:border-slate-300 dark:ring-slate-300"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <span
                className={`hidden h-9 w-9 shrink-0 place-items-center rounded-lg sm:grid ${
                  active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold leading-snug text-slate-900 sm:text-[14.5px]">{s.title}</span>
                <span className="mt-0.5 hidden text-[12.5px] leading-snug text-slate-500 sm:block">{s.description}</span>
                <span className="mt-1 hidden text-[12px] leading-snug text-slate-500 sm:block">לדוגמה: {s.persona}</span>
                <span className="mt-0.5 block text-[11.5px] font-medium leading-snug tabular-nums text-slate-700 sm:text-[12.5px]">
                  {exampleLine(s)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-slate-500">
        {current
          ? "בחירה ממלאת מספרים לדוגמה של משפחה טיפוסית. אפשר לשנות כל פרט בפאנל."
          : "בחרתם שילוב אחר בפאנל. אפשר לחזור לאחד המצבים כאן."}
      </p>
      <details className="group mt-1.5 text-[12px] text-slate-500">
        <summary className="cursor-pointer select-none text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
          מאיפה המספרים לדוגמה?
        </summary>
        <ul className="mt-2 list-disc space-y-1 ps-4 leading-relaxed">
          <li>
            דירה ממוצעת נמכרה ב-{m(2_330_000)} בתחילת 2026. בצפון {m(1_510_000)}, ובבאר שבע {m(1_240_000)}.
          </li>
          <li>
            משכנתא ממוצעת: דירה ראשונה {m(1_130_000)}, משפרי דיור {m(1_320_000)}, משקיעים {m(1_190_000)}. רק 60% ממשפרי
            הדיור ו-45% מהמשקיעים לוקחים משכנתא בכלל.
          </li>
          <li>זוגות שקונים דירה ראשונה הם בני 30 בממוצע.</li>
          <li>כל דוגמה עומדת במגבלות המימון של הבנקים.</li>
        </ul>
        <Sources ids={["cbsPrices", "boiLoans", "boiFirstBuyers"]} className="mt-2" />
      </details>
    </div>
  );
}
