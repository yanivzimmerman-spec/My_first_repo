"use client";

import { Home, KeyRound, Repeat, Plus, ArrowLeftRight, Building2, RotateCcw, Compass } from "lucide-react";
import type { SimInputs } from "@/lib/calculator";
import { SITUATIONS, matchSituation, situationInputs, type Situation } from "@/lib/presets";
import { SOURCES } from "@/lib/sources";
import { formatCompactILS as c } from "@/lib/format";
import { track } from "@/lib/track";

const ICONS: Record<Situation["icon"], typeof Home> = {
  home: Home,
  key: KeyRound,
  swap: Repeat,
  plus: Plus,
  move: ArrowLeftRight,
  two: Building2,
};

/** One short line with the example's numbers. */
function exampleLine(s: Situation): string {
  const e = s.example;
  if (s.id === "upgrade" && e.oldHomeValue) return `מוכרים ב-${c(e.oldHomeValue)} · קונים ב-${c(e.propertyPrice)}`;
  return `${c(e.equity)} הון · דירה ב-${c(e.propertyPrice)}`;
}

const link = "underline decoration-slate-300 underline-offset-2 hover:text-slate-800";

/** "מה המצב שלכם?" — one card per main situation; a click fills in typical example numbers. */
export default function SituationPicker({
  inputs,
  set,
  onReset,
  guideHref,
}: {
  inputs: SimInputs;
  set: <K extends keyof SimInputs>(key: K, value: SimInputs[K]) => void;
  /** Shown when the inputs differ from the defaults */
  onReset?: () => void;
  /** Extra card that opens the guided path */
  guideHref?: string;
}) {
  const current = matchSituation(inputs);
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-slate-800">מה המצב שלכם?</p>
        {onReset && (
          <button type="button" onClick={onReset} className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900">
            <RotateCcw size={13} /> איפוס
          </button>
        )}
      </div>
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
              title={s.description}
              onClick={() => {
                track({ type: "card", id: s.id });
                const next = situationInputs(s);
                (Object.keys(next) as (keyof SimInputs)[]).forEach((k) => set(k, next[k] as SimInputs[typeof k]));
              }}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-right transition sm:gap-3 sm:p-3 ${
                active ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900" : "border-slate-200 bg-white hover:border-slate-400"
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
                <span className="mt-0.5 block text-[11.5px] leading-snug tabular-nums text-slate-500 sm:text-[12.5px]">{exampleLine(s)}</span>
              </span>
            </button>
          );
        })}
        {guideHref && (
          <a
            href={guideHref}
            onClick={() => track({ type: "guideCard" })}
            className="col-span-2 flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 p-2.5 text-right transition hover:border-slate-500 sm:gap-3 sm:p-3 lg:col-span-3"
          >
            <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 sm:grid">
              <Compass size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold leading-snug text-slate-900 sm:text-[14.5px]">לא בטוחים? בואו נעבור על זה יחד</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500 sm:text-[12.5px]">
                מה יש לכם, מה עושים קודם, ותוכנית מסודרת בשישה שלבים קצרים
              </span>
            </span>
          </a>
        )}
      </div>
      <p className="mt-2 text-[12px] text-slate-500">
        מספרים לדוגמה לפי{" "}
        <a href={SOURCES.cbsPrices.url} target="_blank" rel="noopener noreferrer" className={link}>
          הלמ״ס
        </a>{" "}
        ו
        <a href={SOURCES.boiLoans.url} target="_blank" rel="noopener noreferrer" className={link}>
          בנק ישראל
        </a>
        . אפשר לשנות כל פרט בפאנל.
      </p>
    </div>
  );
}
