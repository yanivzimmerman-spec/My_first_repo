"use client";

import { Home, KeyRound, Repeat, Plus, ArrowLeftRight, Building2 } from "lucide-react";
import type { SimInputs } from "@/lib/calculator";
import { SITUATIONS, matchSituation, type Situation } from "@/lib/presets";

const ICONS: Record<Situation["icon"], typeof Home> = {
  home: Home,
  key: KeyRound,
  swap: Repeat,
  plus: Plus,
  move: ArrowLeftRight,
  two: Building2,
};

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
                set("apartmentType", s.values.apartmentType);
                set("liveInNew", s.values.liveInNew);
                set("liveElsewhere", s.values.liveElsewhere);
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
              <span>
                <span className="block text-[13.5px] font-semibold leading-snug text-slate-900 sm:text-[14.5px]">{s.title}</span>
                <span className="mt-0.5 hidden text-[12.5px] leading-snug text-slate-500 sm:block">{s.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-slate-500">
        {current ? "אפשר לכוונן כל פרט בפאנל." : "בחרתם שילוב אחר בפאנל. אפשר לחזור לאחד המצבים כאן."}
      </p>
    </div>
  );
}
