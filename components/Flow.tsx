// Legal guardrails (no affiliate links, no contact collection, no financial data on a server): see lib/config.ts
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Moon, Sun, Share2, Check, Mail, Compass } from "lucide-react";
import { useTheme } from "@/lib/theme";
import {
  DEFAULT_INPUTS,
  BOUNDS,
  breakEvenAppreciation,
  breakEvenRent,
  simulate,
  type SimInputs,
} from "@/lib/calculator";
import { SCENARIO_DELTAS, SITUATIONS, matchSituation, situationInputs } from "@/lib/presets";
import { profileFromInputs, type Profile } from "@/lib/plan";
import { track, startTracking, PRIVACY_NOTE } from "@/lib/track";
import { formatILS } from "@/lib/format";
import SituationPicker from "./SituationPicker";
import VerdictBanner, { VerdictDetails, verdictText } from "./VerdictBanner";
import ScenarioRange from "./ScenarioRange";
import RiskGauges from "./RiskGauges";
import StoryCard from "./StoryCard";
import GrowthChart from "./GrowthChart";
import Breakdown from "./Breakdown";
import RisksCard from "./RisksCard";
import Sensitivity from "./Sensitivity";
import ComboView from "./ComboView";
import ControlPanel, { type PanelSection } from "./ControlPanel";
import Planner from "./plan/Planner";
import StatsView from "./StatsView";
import Disclaimer from "./Disclaimer";
import { InfoPageView, InfoLinks, INFO_PAGES, type InfoPage } from "./InfoPages";
import { CONTACT_EMAIL as FEEDBACK_EMAIL, SHARE_ENDING } from "@/lib/config";

const START: SimInputs = { ...DEFAULT_INPUTS, ...situationInputs(SITUATIONS[0]) };
type QView = "money" | "home" | "market" | "extras";
type View = "pick" | QView | "result" | "plan" | "stats" | InfoPage;

/** The questions, one screen each; every option of the full simulator is asked along the way. */
const QUESTIONS: { view: QView; name: string; title: string; intro: string; sections: PanelSection[] }[] = [
  {
    view: "money",
    name: "הכסף",
    title: "כמה כסף יש לכם, ולכמה זמן?",
    intro: "מילאנו מספרים של משפחה טיפוסית במצב שבחרתם. שנו אותם לשלכם.",
    sections: ["situation", "money"],
  },
  {
    view: "home",
    name: "הדירה",
    title: "הדירה והמשכנתא",
    intro: "מחיר, משכנתא, שכר דירה ועליית מחירים. הריבית נקבעת לפי אורך המשכנתא, ואפשר לשנות.",
    sections: ["apartment"],
  },
  {
    view: "market",
    name: "התחזית",
    title: "מה אתם מצפים מהשוק?",
    intro: "בחרו כמה אתם שמרנים. אפשר גם לכוונן את תשואת המדד ואת שער הדולר.",
    sections: ["risk", "sp"],
  },
  {
    view: "extras",
    name: "תוספות",
    title: "רוצים להוסיף משהו?",
    intro: "הלוואות, מסלולי משכנתא, התחדשות עירונית ובדיקת הבנק. כל תוספת נפתחת רק אם תבחרו בה. אפשר גם לדלג.",
    sections: ["addons", "advanced"],
  },
];
const ORDER: View[] = ["pick", ...QUESTIONS.map((q) => q.view), "result"];
const STAGES = ["המצב", ...QUESTIONS.map((q) => q.name), "התוצאה"];

const VIEW_OF: Record<string, View> = { "": "pick", "#result": "result", "#plan": "plan", "#stats": "stats" };
for (const q of QUESTIONS) VIEW_OF[`#${q.view}`] = q.view;
for (const p of INFO_PAGES) VIEW_OF[`#${p.id}`] = p.id;
const isInfo = (v: View): v is InfoPage => INFO_PAGES.some((p) => p.id === v);

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

/** One closed-by-default section of the result screen. */
function Fold({ title, hint, children, onOpen }: { title: string; hint?: string; children: ReactNode; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right sm:px-6"
      >
        <span>
          <span className="block text-[15.5px] font-semibold text-slate-900">{title}</span>
          {hint && <span className="mt-0.5 block text-[13px] text-slate-500">{hint}</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && <div className="space-y-5 border-t border-slate-100 px-3 py-4 sm:px-4">{children}</div>}
    </section>
  );
}

/**
 * Step-by-step version (test environment): pick your situation → a few numbers → the answer,
 * with everything else in closed sections. Same engine and numbers as the full simulator.
 */
export default function Flow() {
  const [inputs, setInputs] = useState<SimInputs>(START);
  const [theme, toggleTheme] = useTheme();
  const [view, setView] = useState<View>("pick");
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [canSeeStats, setCanSeeStats] = useState(false);

  // Screens live in the address (#basics, #result…), so the back button walks back through them
  useEffect(() => {
    const read = () => {
      const next = VIEW_OF[window.location.hash] ?? "pick";
      setTrail((t) => t.slice(0, -1));
      setView((prev) => {
        if (prev !== next) window.scrollTo({ top: 0 });
        return next;
      });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  // Navigation works from state alone (the claude.ai viewer may ignore address changes);
  // the address follows when it can, so the browser's back button also works where allowed
  const [trail, setTrail] = useState<View[]>([]);
  const [furthest, setFurthest] = useState(0);
  const go = (v: View, record = true) => {
    if (v === view) return;
    if (record) setTrail((t) => [...t, view]);
    setView(v);
    window.scrollTo({ top: 0 });
    try {
      const hash = v === "pick" ? "" : `#${v}`;
      if (window.location.hash !== hash) window.history.pushState(null, "", hash || window.location.pathname + window.location.search);
    } catch {
      /* address not writable here: state navigation still works */
    }
  };
  const back = () => {
    const prev = trail[trail.length - 1] ?? ORDER[Math.max(0, ORDER.indexOf(view) - 1)] ?? "pick";
    setTrail((t) => t.slice(0, -1));
    go(prev, false);
  };

  useEffect(() => {
    startTracking();
    const c = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
    c?.use("user")
      .then((u) => (u as { canEdit(): Promise<boolean> } | null)?.canEdit())
      .then((ok) => setCanSeeStats(!!ok))
      .catch(() => {});
  }, []);

  const set = useCallback(<K extends keyof SimInputs>(key: K, value: SimInputs[K]) => {
    setInputs((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const result = useMemo(() => simulate(inputs), [inputs]);
  const onResult = view === "result";
  const breakEven = useMemo(() => (onResult ? breakEvenAppreciation(inputs) : { value: null, below: false }), [inputs, onResult]);
  const breakEvenR = useMemo(() => (onResult ? breakEvenRent(inputs) : { value: null, below: false }), [inputs, onResult]);
  const scenarios = useMemo(() => {
    if (!onResult) return null;
    const shift = (d: Record<string, number>) => {
      const next = { ...inputs };
      for (const [k, v] of Object.entries(d)) {
        const key = k as "appreciation" | "rentGrowth" | "spReturn" | "fxDrift";
        next[key] = Math.min(BOUNDS[key].max, Math.max(BOUNDS[key].min, inputs[key] + v));
      }
      return simulate(next);
    };
    return { pess: shift(SCENARIO_DELTAS.pessimistic), opt: shift(SCENARIO_DELTAS.optimistic) };
  }, [inputs, onResult]);

  const situation = SITUATIONS.find((x) => x.id === matchSituation(result.inputs));
  const x = result.inputs;
  const re = result.realEstate;

  // Guided path: seeded the first time it opens, kept while hidden
  const [planSeed, setPlanSeed] = useState<Profile | null>(null);
  useEffect(() => {
    if (view === "plan" && !planSeed) setPlanSeed(profileFromInputs(inputs));
  }, [view, planSeed, inputs]);

  const share = async () => {
    track({ type: "share" });
    const text = [
      `נדל״ן מול סנופי: ${verdictText(result)}`,
      `🏠 קונים דירה: ${formatILS(re.netWorth)} נטו`,
      `📈 S&P 500: ${formatILS(result.sp500.netWorth)} נטו`,
      `(${situation?.title ?? "מצב מותאם"}, הון ${formatILS(re.startCapital)}, דירה ב-${formatILS(re.propertyPrice)})`,
      SHARE_ENDING,
    ]
      .join("\n")
      .replace(/[⁦-⁩]/g, "");
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied("idle"), 2200);
  };

  // Screen readers and keyboard users: after moving to a new screen, focus its heading
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (!moved) {
      setMoved(true);
      return;
    }
    const h = document.querySelector<HTMLElement>("main h1:not([hidden]), main h2");
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const stageIndex = Math.max(0, ORDER.indexOf(view));
  useEffect(() => {
    if (ORDER.includes(view)) setFurthest((f) => Math.max(f, stageIndex));
  }, [view, stageIndex]);
  const backButton = (label: string) => (
    <button
      type="button"
      onClick={back}
      className="mb-3 inline-flex items-center gap-1 text-[14px] font-semibold text-slate-600 hover:text-slate-900"
    >
      → {label}
    </button>
  );

  return (
    <>
      <Disclaimer show={view === "result" || view === "plan"} />
      {planSeed && (
        <div hidden={view !== "plan"}>
          <Planner
            initialProfile={planSeed}
            onOpenSimulator={(next) => {
              setInputs(next);
              go("result");
            }}
            freshProfile={() => profileFromInputs(inputs)}
            onExit={back}
            onPage={(p) => go(p)}
          />
        </div>
      )}
      {view !== "plan" && (
        <div className="mx-auto max-w-[780px] pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))] pb-16 sm:px-6">
          <header className="pt-8 pb-5 sm:pt-12">
            <div className="flex items-center justify-between gap-3">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  go("pick");
                }}
                className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 hover:text-slate-900"
              >
                נדל״ן מול סנופי
                <span className="rounded-full border border-slate-300 px-2 py-px text-[11px] font-semibold text-slate-600">טסט</span>
              </a>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
            {view !== "stats" && !isInfo(view) && (
              <nav aria-label="שלבים" className="mt-5">
                <ol className="grid grid-cols-6 gap-1">
                  {STAGES.map((name, i) => {
                    const reachable = i <= furthest;
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          disabled={!reachable}
                          onClick={() => go(ORDER[i])}
                          aria-current={i === stageIndex ? "step" : undefined}
                          className="block w-full text-right disabled:cursor-default"
                        >
                          <span className={`block h-1.5 rounded-full ${i <= stageIndex ? "bg-slate-900" : "bg-slate-200"}`} />
                          <span className={`mt-1.5 block truncate text-[11.5px] sm:text-[12.5px] ${i === stageIndex ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                            {name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
          </header>

          <main>
            {view === "stats" && <StatsView onBack={back} />}
            {isInfo(view) && <InfoPageView page={view} onBack={back} />}

            {/* ---------- 1. Situation ---------- */}
            {view === "pick" && (
              <section>
                <h1 className="text-[28px] font-bold leading-tight text-slate-900 [text-wrap:balance] sm:text-4xl">
                  <span className="text-re">דירה</span> או <span className="text-sp-ink">S&P 500</span>: מה יוצא בחישוב?
                </h1>
                <p className="mt-2 text-[15px] text-slate-600">בחרו את המצב שלכם, ונחשב יחד, צעד אחר צעד, לפי הנתונים וההנחות שלכם.</p>
                <SituationPicker
                  inputs={result.inputs}
                  set={set}
                  guideHref="#plan"
                  onGuide={() => go("plan")}
                  onPick={() => go("money")}
                />
              </section>
            )}

            {/* ---------- 2–5. The questions, one screen each ---------- */}
            {QUESTIONS.map((q, qi) =>
              view !== q.view ? null : (
                <div key={q.view}>
                  {backButton("חזרה")}
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="px-5 pt-5 sm:px-6 sm:pt-6">
                      <p className="text-[13px] font-semibold text-slate-500">
                        שאלה {qi + 1} מתוך {QUESTIONS.length} · {situation?.title ?? "מצב מותאם"}
                      </p>
                      <h1 className="mt-1 text-2xl font-bold text-slate-900">{q.title}</h1>
                      <p className="mt-1 text-[14px] leading-relaxed text-slate-600">{q.intro}</p>
                    </div>
                    <div className="[&>div]:rounded-none [&>div]:border-0">
                      <ControlPanel
                        inputs={result.inputs}
                        result={result}
                        set={set}
                        situationLabel={situation?.title ?? null}
                        sections={q.sections}
                      />
                    </div>
                  </section>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => go(qi + 1 < QUESTIONS.length ? QUESTIONS[qi + 1].view : "result")}
                      className="rounded-full bg-slate-900 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-slate-700"
                    >
                      {qi + 1 < QUESTIONS.length ? `הבא: ${QUESTIONS[qi + 1].name} ←` : "הצג תוצאה ←"}
                    </button>
                    {qi + 1 < QUESTIONS.length && (
                      <button type="button" onClick={() => go("result")} className="px-2 py-2 text-[14px] text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
                        דלגו לתוצאה, השאר כמו שהוא
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}

            {/* ---------- 3. The answer, details folded ---------- */}
            {view === "result" && scenarios && (
              <div className="space-y-3">
                {backButton("חזרה")}
                <VerdictBanner result={result} breakEven={breakEven} breakEvenRent={breakEvenR} details={false} onRules={() => go("rules")} />
                <Fold title="למה זה יצא ככה?" hint="מה הכריע, ומה צריך לקרות כדי שזה יתהפך">
                  <div className="px-2">
                    <VerdictDetails result={result} breakEven={breakEven} breakEvenRent={breakEvenR} comboLink={false} framed={false} />
                  </div>
                </Fold>
                <Fold title="מה הופך את התוצאה?" hint="עליית מחירים, תשואת המדד וריבית: מאיזה ערך המסלול השני מוביל">
                  <Sensitivity inputs={result.inputs} />
                </Fold>
                <Fold title="ומה אם השוק יהיה קשה יותר?" hint="טווח בין תרחיש פסימי לאופטימי">
                  <ScenarioRange pess={scenarios.pess} base={result} opt={scenarios.opt} />
                </Fold>
                <Fold title="כמה סיכון בכל מסלול?">
                  <RiskGauges result={result} />
                </Fold>
                <Fold title="איך זה מתפתח לאורך השנים?" hint="גרף וסיפור במספרים">
                  <StoryCard result={result} />
                  <GrowthChart result={result} dark={theme === "dark"} />
                </Fold>
                <Fold title="שילוב: חלק בדירה וחלק במדד" onOpen={() => track({ type: "combo" })}>
                  <ComboView inputs={result.inputs} result={result} dark={theme === "dark"} embedded />
                </Fold>
                <Fold title="הפירוט המלא" hint="מסים, עלויות, ריבית, ומה לא נכלל">
                  <Breakdown result={result} />
                  <RisksCard />
                </Fold>
                <Fold title="לשנות נתונים והנחות" hint="ריבית, שכירות, תשואות, הלוואות ועוד">
                  <ControlPanel inputs={result.inputs} result={result} set={set} situationLabel={situation?.title ?? null} />
                </Fold>

                <section className="mt-5 rounded-2xl bg-slate-900 p-5 text-white sm:p-7">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <Compass size={19} aria-hidden /> ומה עכשיו?
                  </h2>
                  <p className="mt-1 text-[14px] leading-relaxed text-slate-300">
                    הבסיס שהחישוב שם בצד, סיכום מסודר של החישוב, ושאלות להכנה לפגישה עם בעל רישיון.
                  </p>
                  <a
                    href="#plan"
                    onClick={(e) => {
                      e.preventDefault();
                      track({ type: "guideLink" });
                      go("plan");
                    }}
                    className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-[14.5px] font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    למסלול המודרך ←
                  </a>
                </section>

                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <button
                    type="button"
                    onClick={share}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-[14px] font-semibold text-slate-700 hover:border-slate-500"
                  >
                    {copied === "ok" ? <Check size={15} /> : <Share2 size={15} />}
                    {copied === "ok" ? "הועתק!" : copied === "fail" ? "ההעתקה נכשלה" : "שיתוף התוצאה"}
                  </button>
                  <button type="button" onClick={() => go("pick")} className="px-3 py-2 text-[14px] text-slate-600 hover:text-slate-900">
                    בחירת מצב אחר
                  </button>
                  <button type="button" onClick={() => go("money")} className="px-3 py-2 text-[14px] text-slate-600 hover:text-slate-900">
                    לעבור שוב על השאלות
                  </button>
                </div>
              </div>
            )}
          </main>

          <footer className="mt-12 space-y-3 border-t border-slate-200 pt-5 text-[12px] leading-relaxed text-slate-500">
            <p>
              סימולציה לצורכי המחשה בלבד, על הנחות קבועות ומפושטות שבחרתם. היא לא ייעוץ השקעות, ייעוץ מס או ייעוץ משכנתאות,
              ולא מתחשבת בכל הצרכים שלכם.
            </p>
            <p>{PRIVACY_NOTE}</p>
            <InfoLinks onOpen={(p) => go(p)} />
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("משוב על נדל״ן מול סנופי")}`} className="inline-flex items-center gap-1.5 hover:text-slate-900">
                <Mail size={13} /> שליחת משוב
              </a>
              {canSeeStats && (
                <a
                  href="#stats"
                  onClick={(e) => {
                    e.preventDefault();
                    go("stats");
                  }}
                  className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
                  נתוני שימוש (לנו)
                </a>
              )}
            </p>
          </footer>
        </div>
      )}
    </>
  );
}

