"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Share2, Check, RotateCcw } from "lucide-react";
import { DEFAULT_INPUTS, simulate, type SimInputs } from "@/lib/calculator";
import { PRESETS } from "@/lib/presets";
import { inputsToQuery, queryToInputs } from "@/lib/url";
import { formatCompactILS, formatILS } from "@/lib/format";
import ControlPanel from "./ControlPanel";
import VerdictBanner, { verdictText } from "./VerdictBanner";
import GrowthChart from "./GrowthChart";
import Breakdown from "./Breakdown";

/** Static single-file build (claude.ai page): no query-string routing there. */
const STANDALONE = process.env.NEXT_PUBLIC_STANDALONE === "1";

const sameInputs = (a: SimInputs, b: SimInputs) =>
  (Object.keys(a) as (keyof SimInputs)[]).every((k) => a[k] === b[k]);

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

export default function Simulator() {
  const [inputs, setInputs] = useState<SimInputs>(DEFAULT_INPUTS);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  // Load a shared scenario from the URL once on mount.
  useEffect(() => {
    const fromUrl = STANDALONE ? null : queryToInputs(window.location.search);
    if (fromUrl) setInputs(fromUrl);
    setHydrated(true);
  }, []);

  // Keep the URL in sync (no reload, no history spam).
  useEffect(() => {
    if (!hydrated || STANDALONE) return;
    const q = inputsToQuery(inputs);
    const url = `${window.location.pathname}${q ? `?${q}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [inputs, hydrated]);

  const result = useMemo(() => simulate(inputs), [inputs]);

  const set = useCallback(<K extends keyof SimInputs>(key: K, value: SimInputs[K]) => {
    setInputs((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const share = async () => {
    const q = inputsToQuery(inputs);
    const url = `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ""}`;
    const text = [
      `נדל״ן מול סנופי — ${verdictText(result)}`,
      `🏠 דירה להשקעה: ${formatILS(result.realEstate.netWorth)} נטו`,
      `📈 S&P 500: ${formatILS(result.sp500.netWorth)} נטו`,
      `(הון עצמי ${formatILS(inputs.equity)}, ${inputs.isFirstApartment ? "דירה יחידה" : "דירה נוספת"}, ריבית ${inputs.mortgageRate}%, תשואת S&P ${inputs.spReturn}%)`,
      ...(STANDALONE ? [] : [url]),
    ]
      .join("\n")
      .replace(/[\u2066-\u2069]/g, "");
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied("idle"), 2200);
  };

  const activePreset = PRESETS.find((p) => sameInputs(p.inputs, inputs))?.id;
  const isDefault = sameInputs(inputs, DEFAULT_INPUTS);

  const shareLabel = copied === "ok" ? "הועתק!" : copied === "fail" ? "ההעתקה נכשלה" : "שיתוף התוצאה";

  return (
    <div className="mx-auto max-w-[1180px] pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))] pb-16 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header className="pt-8 pb-6 sm:pt-12 sm:pb-8">
        <p className="text-[13px] font-semibold text-slate-500">נדל״ן מול סנופי</p>
        <h1 className="mt-1 max-w-[22ch] text-[28px] font-bold leading-tight text-slate-900 [text-wrap:balance] sm:text-4xl">
          מה משתלם יותר: <span className="whitespace-nowrap text-re">דירה להשקעה</span> או <span className="whitespace-nowrap text-sp-ink">S&P 500</span>?
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-slate-600 sm:text-base">
          הזיזו את הנתונים וקבלו תשובה מיידית: כמה כסף יישאר לכם בכל מסלול, אחרי מס רכישה, מס שבח, מס על השכירות ומס
          רווחי הון.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-slate-500">נסו תרחיש:</span>
          {PRESETS.map((p) => {
            const active = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setInputs(p.inputs)}
                aria-pressed={active}
                title={p.description}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {!isDefault && (
            <button
              type="button"
              onClick={() => setInputs(DEFAULT_INPUTS)}
              className="flex items-center gap-1 px-2 py-1.5 text-[13px] text-slate-500 hover:text-slate-900"
            >
              <RotateCcw size={13} /> איפוס
            </button>
          )}
        </div>
      </header>

      {/* ---------- Mobile: compact answer that stays on screen while editing ---------- */}
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-30 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 text-[13px] tabular-nums">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-re" /> דירה{" "}
            <span className="font-semibold text-slate-900">{formatCompactILS(result.realEstate.netWorth)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sp" /> S&P{" "}
            <span className="font-semibold text-slate-900">{formatCompactILS(result.sp500.netWorth)}</span>
          </span>
          <span className="text-slate-500">{inputs.years} שנה</span>
        </div>
      </div>

      {/*
        Layout: phone = answer → inputs → chart → details (one column).
        Desktop (RTL) = inputs in a sticky right column, results on the left.
      */}
      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <VerdictBanner result={result} />
        </div>

        <aside
          aria-label="הנתונים שלכם"
          className="min-w-0 lg:sticky lg:top-6 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:[scrollbar-width:thin]"
        >
          <ControlPanel inputs={inputs} result={result} set={set} />
        </aside>

        <div className="min-w-0 lg:col-start-2">
          <GrowthChart result={result} />
        </div>

        <div className="min-w-0 space-y-5 lg:col-start-2">
          <Breakdown result={result} />

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <button
              type="button"
              onClick={share}
              className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {copied === "ok" ? <Check size={16} /> : <Share2 size={16} />}
              {shareLabel}
            </button>
            <span className="text-[13px] text-slate-500">מעתיק סיכום של התוצאה לשליחה</span>
          </div>

          <p className="border-t border-slate-200 pt-5 text-[12px] leading-relaxed text-slate-500">
            זוהי סימולציה לצורכי המחשה בלבד, המבוססת על הנחות קבועות ומפושטות (תשואות, ריביות ואינפלציה קבועות לאורך כל
            התקופה). אין לראות בה ייעוץ השקעות, ייעוץ מס או המלצה לפעולה. תשואות עבר אינן מבטיחות תשואות עתידיות. מדרגות המס
            הן הערכה ועשויות להשתנות.
          </p>
        </div>
      </div>
    </div>
  );
}
