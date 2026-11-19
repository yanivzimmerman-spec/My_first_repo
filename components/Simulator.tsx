"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Share2, Check, Moon, Sun, Mail, Copy } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { DEFAULT_INPUTS, breakEvenAppreciation, breakEvenRent, simulate, BOUNDS, type SimInputs } from "@/lib/calculator";
import { SCENARIO_DELTAS, SITUATIONS, matchSituation, situationInputs } from "@/lib/presets";
import { inputsToQuery, queryToInputs } from "@/lib/url";
import { formatCompactILS, formatILS } from "@/lib/format";
import ControlPanel from "./ControlPanel";
import VerdictBanner, { verdictText } from "./VerdictBanner";
import GrowthChart from "./GrowthChart";
import Breakdown from "./Breakdown";
import StoryCard from "./StoryCard";
import ScenarioRange from "./ScenarioRange";
import RisksCard from "./RisksCard";
import RiskGauges from "./RiskGauges";
import ComboView from "./ComboView";
import SituationPicker from "./SituationPicker";
import Planner from "./plan/Planner";
import StatsView from "./StatsView";
import { track, startTracking } from "@/lib/track";
import { profileFromInputs, encodePlan, decodePlan, type Profile, type PlanState } from "@/lib/plan";

/** Static single-file build (claude.ai page): no query-string routing there. */
const STANDALONE = process.env.NEXT_PUBLIC_STANDALONE === "1";

const FEEDBACK_EMAIL = "yanivzimmerman@gmail.com";

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

/**
 * The published site uses the default.
 */
/** The new version starts from the most common case: a first home to live in, with its example numbers. */
const GUIDED_START: SimInputs = { ...DEFAULT_INPUTS, ...situationInputs(SITUATIONS[0]) };

export default function Simulator({ withGuide = false }: { withGuide?: boolean } = {}) {
  const start = withGuide ? GUIDED_START : DEFAULT_INPUTS;
  const [inputs, setInputs] = useState<SimInputs>(start);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [emailCopied, setEmailCopied] = useState(false);
  const [theme, toggleTheme] = useTheme();

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
    // Keep a shared guided plan (?plan=…) next to the simulator's own parameters
    const plan = new URLSearchParams(window.location.search).get("plan");
    const all = [q, plan ? `plan=${plan}` : ""].filter(Boolean).join("&");
    const url = `${window.location.pathname}${all ? `?${all}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [inputs, hydrated]);

  const result = useMemo(() => simulate(inputs), [inputs]);
  const breakEven = useMemo(() => breakEvenAppreciation(inputs), [inputs]);
  const breakEvenRentResult = useMemo(() => breakEvenRent(inputs), [inputs]);
  // Pessimistic / optimistic: shift the market assumptions for both tracks together
  const scenarios = useMemo(() => {
    const shift = (d: Record<string, number>) => {
      const next = { ...inputs };
      for (const [k, v] of Object.entries(d)) {
        const key = k as "appreciation" | "rentGrowth" | "spReturn" | "fxDrift";
        const b = BOUNDS[key];
        next[key] = Math.min(b.max, Math.max(b.min, inputs[key] + v));
      }
      return simulate(next);
    };
    return { pess: shift(SCENARIO_DELTAS.pessimistic), opt: shift(SCENARIO_DELTAS.optimistic) };
  }, [inputs]);

  // Second page: the mixed strategy, reached through #combo (works in plain links and the artifact viewer)
  const [view, setView] = useState<"main" | "combo" | "plan" | "stats">("main");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash;
      const next = h === "#combo" ? "combo" : h === "#plan" && withGuide ? "plan" : h === "#stats" && withGuide ? "stats" : "main";
      setView((prev) => {
        if (prev !== next) window.scrollTo({ top: 0 });
        return next;
      });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [withGuide]);

  // Guided path: seeded from the simulator the first time it opens, then kept (hidden) so
  // going back and forth never loses its answers
  const [planSeed, setPlanSeed] = useState<Profile | null>(null);
  // Shared link with a guided plan (?plan=…): open it as it was
  const [planFromUrl] = useState<PlanState | undefined>(() =>
    STANDALONE || typeof window === "undefined" ? undefined : decodePlan(new URLSearchParams(window.location.search).get("plan")),
  );
  useEffect(() => {
    if (planFromUrl && !planSeed) setPlanSeed(planFromUrl.profile);
  }, [planFromUrl, planSeed]);
  const savePlanToUrl = useCallback((state: PlanState) => {
    const url = new URL(window.location.href);
    url.searchParams.set("plan", encodePlan(state));
    window.history.replaceState(null, "", url.toString());
  }, []);
  useEffect(() => {
    if (view === "plan" && !planSeed) setPlanSeed(profileFromInputs(inputs));
  }, [view, planSeed, inputs]);
  const openInSimulator = useCallback((next: SimInputs) => {
    setInputs(next);
    window.location.hash = "";
  }, []);

  const set = useCallback(<K extends keyof SimInputs>(key: K, value: SimInputs[K]) => {
    setInputs((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  // Alpha: anonymous usage counts, and a stats link that only the owner and editors see
  const [canSeeStats, setCanSeeStats] = useState(false);
  useEffect(() => {
    if (!withGuide) return;
    startTracking();
    const c = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
    c?.use("user")
      .then((u) => (u as { canEdit(): Promise<boolean> } | null)?.canEdit())
      .then((ok) => setCanSeeStats(!!ok))
      .catch(() => {});
  }, [withGuide]);

  const share = async () => {
    track({ type: "share" });
    const q = inputsToQuery(inputs);
    const plan = new URLSearchParams(window.location.search).get("plan");
    const all = [q, plan ? `plan=${plan}` : ""].filter(Boolean).join("&");
    const url = `${window.location.origin}${window.location.pathname}${all ? `?${all}` : ""}`;
    const text = [
      `נדל״ן מול סנופי — ${verdictText(result)}`,
      `🏠 קונים דירה: ${formatILS(result.realEstate.netWorth)} נטו`,
      `📈 S&P 500: ${formatILS(result.sp500.netWorth)} נטו`,
      `(הון עצמי ${formatILS(result.realEstate.startCapital)}${result.realEstate.oldHomeNetProceeds > 0 ? " כולל מכירת הדירה הקיימת" : ""}, ${{ single: "דירה יחידה", upgrader: "משפרי דיור", additional: "דירה נוספת" }[inputs.apartmentType]}${inputs.loanEnabled ? `, הלוואה לדירה ${formatILS(inputs.loanAmount)}` : ""}${inputs.spLoanEnabled ? `, הלוואה להשקעה ${formatILS(inputs.spLoanAmount)}` : ""}, ריבית ${inputs.mortgageRate}%, תשואת S&P ${inputs.spReturn}%)`,
      ...(STANDALONE ? [] : [url]),
    ]
      .join("\n")
      .replace(/[\u2066-\u2069]/g, "");
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied("idle"), 2200);
  };


  const copyEmail = async () => {
    if (await copyText(FEEDBACK_EMAIL)) {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2200);
    }
  };

  const shareLabel = copied === "ok" ? "הועתק!" : copied === "fail" ? "ההעתקה נכשלה" : "שיתוף התוצאה";

  const planner = planSeed && (
    <div hidden={view !== "plan"}>
      <Planner
        initialProfile={planSeed}
        onOpenSimulator={openInSimulator}
        freshProfile={() => profileFromInputs(inputs)}
        initialState={planFromUrl}
        onStateChange={STANDALONE ? undefined : savePlanToUrl}
      />
    </div>
  );
  return (
    <>
    {planner}
    {view !== "plan" && (
    <div className="mx-auto max-w-[1180px] pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))] pb-16 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header className="pt-8 pb-6 sm:pt-12 sm:pb-8">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
            נדל״ן מול סנופי
            {withGuide && (
              <span className="rounded-full border border-slate-300 px-2 py-px text-[11px] font-semibold text-slate-600">אלפא</span>
            )}
          </p>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
            title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
        <h1 className="mt-1 max-w-[22ch] text-[28px] font-bold leading-tight text-slate-900 [text-wrap:balance] sm:text-4xl">
          מה משתלם יותר: <span className="whitespace-nowrap text-re">לקנות דירה</span> או <span className="whitespace-nowrap text-sp-ink">להשקיע ב-S&P 500</span>?
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-slate-600 sm:text-base">
          הזיזו את הנתונים וקבלו תשובה מיידית: כמה כסף יישאר לכם בכל מסלול, אחרי מס רכישה, מס שבח, מס על השכירות ומס
          רווחי הון.
        </p>

        <SituationPicker
          inputs={result.inputs}
          set={set}
          onReset={sameInputs(inputs, start) ? undefined : () => setInputs(start)}
          guideHref={withGuide ? "#plan" : undefined}
        />
      </header>

      {view === "stats" ? (
        <StatsView />
      ) : view === "combo" ? (
        <ComboView inputs={result.inputs} result={result} dark={theme === "dark"} />
      ) : (
        <>
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
      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_auto_auto_1fr] lg:items-start lg:gap-8">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <VerdictBanner result={result} breakEven={breakEven} breakEvenRent={breakEvenRentResult} guideLink={withGuide} />
        </div>

        <aside
          aria-label="הנתונים שלכם"
          className="min-w-0 lg:sticky lg:top-6 lg:col-start-1 lg:row-span-6 lg:row-start-1 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:[scrollbar-width:thin]"
        >
          <ControlPanel
            inputs={result.inputs}
            result={result}
            set={set}
            situationLabel={withGuide ? (SITUATIONS.find((x) => x.id === matchSituation(result.inputs))?.title ?? null) : undefined}
          />
        </aside>

        <div className="min-w-0 lg:col-start-2">
          <ScenarioRange pess={scenarios.pess} base={result} opt={scenarios.opt} />
        </div>

        <div className="min-w-0 lg:col-start-2">
          <RiskGauges result={result} />
        </div>

        <div className="min-w-0 lg:col-start-2">
          <StoryCard result={result} />
        </div>

        <div className="min-w-0 lg:col-start-2">
          <GrowthChart result={result} dark={theme === "dark"} />
        </div>

        <div className="min-w-0 space-y-5 lg:col-start-2">
          <Breakdown result={result} />
          <RisksCard />

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
      </>
      )}

      {/* ---------- Feedback ---------- */}
      <footer className="mt-10 flex flex-col items-start gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-slate-800">יש לכם הערה או רעיון לשיפור?</p>
          <p className="mt-0.5 text-[13px] text-slate-500">
            או כתבו לכתובת{" "}
            <span dir="ltr" className="select-all font-medium text-slate-700">
              {FEEDBACK_EMAIL}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("משוב על נדל״ן מול סנופי")}`}
            className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-500"
          >
            <Mail size={16} /> שליחת משוב
          </a>
          <button
            type="button"
            onClick={copyEmail}
            className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:text-slate-900"
          >
            {emailCopied ? <Check size={15} /> : <Copy size={15} />}
            {emailCopied ? "הכתובת הועתקה" : "העתקת הכתובת"}
          </button>
          {canSeeStats && (
            <a href="#stats" className="px-3 py-2 text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
              נתוני שימוש (לנו)
            </a>
          )}
        </div>
      </footer>
    </div>
    )}
    </>
  );
}
