"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Share2, Check, SlidersHorizontal, X, RotateCcw, Sparkles, Info, Building2, LineChart } from "lucide-react";
import { DEFAULT_INPUTS, simulate, type SimInputs } from "@/lib/calculator";
import { PRESETS } from "@/lib/presets";
import { inputsToQuery, queryToInputs } from "@/lib/url";
import { formatCompactILS, formatILS } from "@/lib/format";
import ControlPanel from "./ControlPanel";
import VerdictBanner, { verdictText } from "./VerdictBanner";
import GrowthChart from "./GrowthChart";
import Breakdown from "./Breakdown";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  // Load a shared scenario from the URL once on mount.
  useEffect(() => {
    const fromUrl = queryToInputs(window.location.search);
    if (fromUrl) setInputs(fromUrl);
    setHydrated(true);
  }, []);

  // Keep the URL in sync (no reload, no history spam).
  useEffect(() => {
    if (!hydrated) return;
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
      url,
    ]
      .join("\n")
      .replace(/[\u2066-\u2069]/g, "");
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied("idle"), 2200);
  };

  const activePreset = PRESETS.find((p) => sameInputs(p.inputs, inputs))?.id;
  const isDefault = sameInputs(inputs, DEFAULT_INPUTS);
  const winColor =
    result.winner === "realEstate" ? "text-re-ink" : result.winner === "sp500" ? "text-sp-ink" : "text-slate-700";

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-4 sm:pt-8">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-slate-900 text-white">
            <Building2 size={18} className="absolute right-1.5 top-1.5 text-indigo-300" />
            <LineChart size={18} className="absolute bottom-1.5 left-1.5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">נדל״ן מול סנופי</h1>
            <p className="text-xs text-slate-500 sm:text-sm">דירה להשקעה במינוף מול S&P 500 — עם כל המסים בישראל</p>
          </div>
        </div>
        <button
          type="button"
          onClick={share}
          className="hidden items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] sm:flex"
        >
          {copied === "ok" ? <Check size={16} /> : <Share2 size={16} />}
          {copied === "ok" ? "הועתק ללוח!" : copied === "fail" ? "ההעתקה נכשלה" : "שתף תוצאה"}
        </button>
      </header>

      {/* ---------- Presets ---------- */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500">
          <Sparkles size={14} /> תרחישים מהירים:
        </span>
        {PRESETS.map((p) => {
          const active = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setInputs(p.inputs)}
              aria-pressed={active}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-right transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="block text-sm font-semibold">{p.label}</span>
              <span className={`block text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>{p.description}</span>
            </button>
          );
        })}
        {!isDefault && (
          <button
            type="button"
            onClick={() => setInputs(DEFAULT_INPUTS)}
            className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <RotateCcw size={13} /> איפוס
          </button>
        )}
      </div>

      {/* ---------- Mobile sticky summary bar ---------- */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-bold ${winColor}`}>
              {result.winner === "tie"
                ? "תיקו"
                : `${result.winner === "realEstate" ? "נדל״ן" : "S&P 500"} מנצח ב-${formatCompactILS(result.difference)}`}
            </p>
            <p className="flex gap-3 whitespace-nowrap text-xs tabular-nums text-slate-500">
              <span>
                <span className="inline-block h-2 w-2 rounded-full bg-re" /> {formatCompactILS(result.realEstate.netWorth)}
              </span>
              <span>
                <span className="inline-block h-2 w-2 rounded-full bg-sp" /> {formatCompactILS(result.sp500.netWorth)}
              </span>
              <span>
                {formatCompactILS(inputs.equity)} · {inputs.years} שנה
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={share}
            aria-label="שתף תוצאה"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700"
          >
            {copied === "ok" ? <Check size={16} /> : <Share2 size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="controls"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            {mobileOpen ? <X size={14} /> : <SlidersHorizontal size={14} />}
            {mobileOpen ? "סגור" : "עריכת הנחות"}
          </button>
        </div>
      </div>

      {/* ---------- Main grid (RTL: controls on the right) ---------- */}
      <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside
          id="controls"
          aria-label="הנחות הסימולציה"
          className={`${mobileOpen ? "block" : "hidden"} lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-2 lg:[scrollbar-width:thin]`}
        >
          <ControlPanel inputs={inputs} result={result} set={set} />
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white lg:hidden"
          >
            הצג תוצאות
          </button>
        </aside>

        <main className="min-w-0 space-y-5">
          <VerdictBanner result={result} />
          <GrowthChart result={result} />
          <Breakdown result={result} />

          <button
            type="button"
            onClick={share}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:hidden"
          >
            {copied === "ok" ? <Check size={16} /> : <Share2 size={16} />}
            {copied === "ok" ? "הועתק ללוח!" : "שתף תוצאה"}
          </button>

          <footer className="flex gap-2.5 rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-xs leading-relaxed text-slate-500">
            <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <p>
              <span className="font-semibold text-slate-700">גילוי נאות: </span>
              זוהי סימולציה פיננסית לצורכי המחשה בלבד, המבוססת על הנחות קבועות ומפושטות (תשואות, ריביות ואינפלציה קבועות לאורך
              כל התקופה). אין לראות בה ייעוץ השקעות, ייעוץ מס או המלצה לפעולה, ואין בה תחליף לייעוץ מותאם אישית מגורם מוסמך.
              תשואות עבר אינן מבטיחות תשואות עתידיות. מדרגות המס הן הערכה ועשויות להשתנות.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
