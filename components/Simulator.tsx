"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Share2, Check, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { DEFAULT_INPUTS, simulate, type SimInputs, type SimResult } from "@/lib/calculator";
import { PRESETS } from "@/lib/presets";
import { inputsToQuery, queryToInputs } from "@/lib/url";
import { formatCompactILS, formatILS, formatPct } from "@/lib/format";
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

function TickerTape({ r }: { r: SimResult }) {
  const i = r.inputs;
  const items: { code: string; label: string; value: string; dir?: "up" | "down" }[] = [
    { code: "RE", label: "דירה נטו", value: formatCompactILS(r.realEstate.netWorth), dir: r.realEstate.totalReturnPct >= 0 ? "up" : "down" },
    { code: "SPX", label: "S&P נטו", value: formatCompactILS(r.sp500.netWorth), dir: r.sp500.totalReturnPct >= 0 ? "up" : "down" },
    { code: "MTG", label: "ריבית משכנתא", value: formatPct(i.mortgageRate, 2) },
    { code: "PMT", label: "החזר חודשי", value: formatILS(r.realEstate.monthlyMortgagePayment) },
    { code: "RENT", label: "שכ״ד חודשי", value: formatILS(r.realEstate.initialMonthlyRentGross) },
    { code: "YLD", label: "תשואת שכירות", value: formatPct(i.rentalYield, 2) },
    { code: "HPA", label: "עליית ערך", value: formatPct(i.appreciation, 1) },
    { code: "SPR", label: "תשואת S&P", value: formatPct(i.spReturn, 1) },
    { code: "FEE", label: "דמי ניהול", value: formatPct(i.spFee, 2) },
    { code: "CPI", label: "אינפלציה", value: formatPct(i.inflation, 1) },
    { code: "LTV", label: "מימון", value: formatPct(r.realEstate.ltv * 100, 0) },
  ];
  const run = (key: string) => (
    <div key={key} className="flex shrink-0 items-center" aria-hidden={key === "b"}>
      {items.map((it) => (
        <span key={it.code} className="flex items-center gap-2 border-l border-term-line px-4 text-[12px]">
          <span dir="ltr" className="font-mono font-bold text-amber">{it.code}</span>
          <span className="text-term-dim">{it.label}</span>
          <span className="font-mono font-semibold text-term-text">{it.value}</span>
          {it.dir && (
            <span className={it.dir === "up" ? "text-sp-glow" : "text-down-glow"}>{it.dir === "up" ? "▲" : "▼"}</span>
          )}
        </span>
      ))}
    </div>
  );
  return (
    <div className="ticker overflow-hidden border-b border-term bg-term py-2" role="marquee" aria-label="נתוני הסימולציה">
      <div className="ticker-track flex w-max">
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
}

export default function Simulator() {
  const [inputs, setInputs] = useState<SimInputs>(DEFAULT_INPUTS);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()));
  }, []);

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

  const gutter = "pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))] sm:px-6 lg:px-8";

  return (
    <div className="pb-16">
      <TickerTape r={result} />

      <div className={`mx-auto max-w-[1280px] ${gutter}`}>
        {/* ---------- Masthead ---------- */}
        <header className="pt-5 sm:pt-7">
          <div className="flex items-center justify-between gap-3 text-[11.5px] text-ink-2">
            <span>מוסף נדל״ן ושוק ההון · מהדורת סימולציה</span>
            <span className="hidden sm:inline">{today}</span>
          </div>
          <div className="mt-2 border-y-[3px] border-double border-ink py-3 text-center sm:py-4">
            <h1 className="font-serif text-[44px] font-black leading-none tracking-tight text-ink sm:text-[64px] lg:text-[76px]">
              נדל״ן מול סנופי
            </h1>
            <p className="mt-2 font-serif text-[15px] font-medium text-ink-2 sm:text-[17px]">
              דירה להשקעה במינוף משכנתא מול מדד S&P 500, אחרי כל המסים בישראל
            </p>
          </div>

          {/* Section bar: presets + share */}
          <nav aria-label="תרחישים מהירים" className="flex items-stretch justify-between gap-3 border-b border-ink">
            <div className="flex min-w-0 items-stretch overflow-x-auto">
              <span className="flex shrink-0 items-center pl-3 text-[12px] font-bold text-ink">תרחישים:</span>
              {PRESETS.map((p) => {
                const active = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setInputs(p.inputs)}
                    aria-pressed={active}
                    title={p.description}
                    className={`shrink-0 border-r border-hair px-3 py-2.5 text-right transition-colors ${
                      active ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"
                    }`}
                  >
                    <span className="block text-[13px] font-bold">{p.label}</span>
                    <span className={`block text-[11px] ${active ? "text-paper/70" : "text-ink-3"}`}>{p.description}</span>
                  </button>
                );
              })}
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => setInputs(DEFAULT_INPUTS)}
                  className="flex shrink-0 items-center gap-1 border-r border-hair px-3 text-[12px] font-medium text-ink-2 hover:text-ink"
                >
                  <RotateCcw size={13} /> איפוס
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={share}
              className="my-1.5 hidden shrink-0 items-center gap-2 bg-ink px-4 text-[13px] font-bold text-paper transition hover:bg-ink-2 sm:flex"
            >
              {copied === "ok" ? <Check size={15} /> : <Share2 size={15} />}
              {copied === "ok" ? "הועתק ללוח!" : copied === "fail" ? "ההעתקה נכשלה" : "שתף תוצאה"}
            </button>
          </nav>
        </header>
      </div>

      {/* ---------- Mobile sticky summary bar (terminal strip) ---------- */}
      <div className={`sticky top-[env(safe-area-inset-top,0px)] z-30 mt-4 border-y border-term bg-term py-2.5 text-term-text lg:hidden ${gutter}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">
              {result.winner === "tie"
                ? "תיקו"
                : `${result.winner === "realEstate" ? "נדל״ן" : "S&P 500"} מנצח ב-${formatCompactILS(result.difference)}`}
            </p>
            <p className="flex gap-3 whitespace-nowrap font-mono text-[11.5px] text-term-dim">
              <span><span className="text-re-glow">RE</span> {formatCompactILS(result.realEstate.netWorth)}</span>
              <span><span className="text-sp-glow">SPX</span> {formatCompactILS(result.sp500.netWorth)}</span>
              <span>{inputs.years}Y</span>
            </p>
          </div>
          <button
            type="button"
            onClick={share}
            aria-label="שתף תוצאה"
            className="grid h-9 w-9 shrink-0 place-items-center border border-term-line text-term-text"
          >
            {copied === "ok" ? <Check size={16} /> : <Share2 size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="controls"
            className="flex shrink-0 items-center gap-1.5 bg-amber px-3 py-2 text-[12px] font-bold text-term"
          >
            {mobileOpen ? <X size={14} /> : <SlidersHorizontal size={14} />}
            {mobileOpen ? "סגור" : "עריכת הנחות"}
          </button>
        </div>
      </div>

      {/* ---------- Main grid (RTL: controls on the right) ---------- */}
      <div className={`mx-auto mt-5 grid max-w-[1280px] gap-6 lg:mt-7 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-8 ${gutter}`}>
        <aside
          id="controls"
          aria-label="הנחות הסימולציה"
          className={`${mobileOpen ? "block" : "hidden"} term-scroll lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-2 lg:pl-2`}
        >
          <ControlPanel inputs={inputs} result={result} set={set} />
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mt-4 w-full bg-ink py-3 text-sm font-bold text-paper lg:hidden"
          >
            הצג תוצאות
          </button>
        </aside>

        <main className="min-w-0 space-y-8">
          <VerdictBanner result={result} />
          <GrowthChart result={result} />
          <Breakdown result={result} />

          <button
            type="button"
            onClick={share}
            className="flex w-full items-center justify-center gap-2 border border-ink py-3 text-sm font-bold text-ink sm:hidden"
          >
            {copied === "ok" ? <Check size={16} /> : <Share2 size={16} />}
            {copied === "ok" ? "הועתק ללוח!" : "שתף תוצאה"}
          </button>

          <footer className="border-t border-ink pt-3 text-[12px] leading-relaxed text-ink-3">
            <p className="max-w-[80ch]">
              <span className="font-bold text-ink-2">גילוי נאות. </span>
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
