/* Legal guardrails: texts describe calculations, no product names, no identifiers in usage counts,
 * rules carry sources and dates. Run with `npm test`. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RULES, staleRules, additionalTaxOrderExpired } from "../lib/rules.ts";
import { applyEvent, CARD_IDS } from "../lib/track.ts";
import { advisorPrompt, basics, DEFAULT_PROFILE } from "../lib/plan.ts";
import { SOURCES } from "../lib/sources.ts";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok  ", msg);
};

// Every user-facing source file
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(f)) files.push(p);
  }
};
walk(new URL("../components", import.meta.url).pathname);
walk(new URL("../lib", import.meta.url).pathname);
const text = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // code without comments

// 1. No body, fund, broker, bank or product names; no AI product names
const names = /ChatGPT|Gemini|Claude\b|Vanguard|iShares|Blackrock|BlackRock|SPDR|Invesco|הראל|מגדל|כלל ביטוח|מיטב|אלטשולר|פסגות|אקסלנס|הפניקס|לאומי|הפועלים|דיסקונט|מזרחי|טפחות|אינטראקטיב|IBKR|Interactive Brokers/;
const offenders = files.filter((f) => !f.endsWith("track.ts") && !f.endsWith("StatsView.tsx") && !f.endsWith("Simulator.tsx") && !f.endsWith("Flow.tsx") && names.test(text(f)));
ok(offenders.length === 0, `no product, body or AI-product names in the interface ${offenders.join(", ")}`);
// window.claude (the platform API) is code, not text: checked separately
const appText = ["Simulator.tsx", "Flow.tsx"].map((n) => text(join(new URL("../components", import.meta.url).pathname, n)).replace(/claude\??\.use|window as unknown as \{ claude[^}]*\}/g, ""));
ok(appText.every((t) => !names.test(t)), "no names in the two app shells");

// 2. No recommending phrases
const recommending = /הכי משתלם|המשתלם ביותר|שווה לשקול|מה כדאי לעשות עם הכסף|התוכנית שלכם, לפי הסדר|למשל בקרן מחקה|לחסוך כל חודש בקרן|להמשיך להפקיד לקרן|ותציע תוכנית|תוכנית פעולה לשנה/;
const rec = files.filter((f) => recommending.test(text(f)));
ok(rec.length === 0, `no recommending phrases ${rec.join(", ")}`);

// 3. AI prompt role and asks
const prompt = advisorPrompt(DEFAULT_PROFILE, basics(DEFAULT_PROFILE), null, {});
ok(prompt.startsWith("אתה עוזר שמסביר מושגים, אפשרויות ופשרות"), "AI prompt: explains, helps prepare for a licensee");
ok(!/מתכנן פיננסי ויועץ השקעות ותיק|סדר עדיפויות: מה עושים קודם|תוכנית פעולה לשנה/.test(prompt), "AI prompt: no advisor role, no priorities, no action plan");
ok(prompt.includes("אל תמליץ על גוף או מוצר מסוים בשם") && prompt.includes("תאתגר אותן") && prompt.includes("אם אתה לא בטוח במספר עדכני"), "AI prompt keeps the rules");
ok(prompt.includes("רשימת שאלות לשאול בעל רישיון"), "AI prompt asks for questions for a licensee");

// 4. Usage counts: no identifier, only fixed names and counters
const trackSrc = text(new URL("../lib/track.ts", import.meta.url).pathname);
ok(!/user\.id\(|\.me\(\)|email|profile/.test(trackSrc), "usage counts never read the account id, email or profile");
const s0 = { first: "2026-11-20", last: "2026-11-20", visits: 1, cards: {}, guideCard: 0, guideLink: 0, maxStep: 0, steps: {}, promptCopy: 0, planCopy: 0, planLink: 0, toSimulator: 0, share: 0, combo: 0 };
const evil = applyEvent(s0, { type: "card", id: "₪1,250,000 my name" }, new Set());
ok(Object.keys(evil.cards).length === 0, "a card name that isn't one of the six is never stored");
ok(CARD_IDS.length === 6 && applyEvent(s0, { type: "card", id: "upgrade" }, new Set()).cards.upgrade === 1, "the six card names are counted");

// 5. Rules: value, source, date; staleness and the temporary order
ok(RULES.every((r) => r.title && r.value && /^\d{4}-\d{2}-\d{2}$/.test(r.checked)), "every rule has a title, value and check date");
ok(RULES.every((r) => r.sources.every((s) => s in SOURCES)), "every rule's sources exist");
ok(staleRules(new Date("2027-06-01")).length === 0 && staleRules(new Date("2027-12-01")).length === RULES.length, "rules turn stale a year after their check");
ok(!additionalTaxOrderExpired(new Date("2027-02-10T12:00:00")) && additionalTaxOrderExpired(new Date("2027-02-11T00:00:01")), "temporary order ends after 10.2.2027");

// 6. Share texts end with the note; disclaimer exists; contact email in one place
const shareEnding = "סימולציה לפי הנחות. לא ייעוץ.";
ok(readFileSync(new URL("../lib/config.ts", import.meta.url), "utf8").includes(shareEnding), "share ending defined once");
for (const f of ["Simulator.tsx", "Flow.tsx", "plan/Planner.tsx"])
  ok(text(join(new URL("../components", import.meta.url).pathname, f)).includes("SHARE_ENDING"), `${f}: copied text ends with the note`);
ok(files.filter((f) => /yanivzimmerman|@gmail\.com/.test(readFileSync(f, "utf8"))).every((f) => f.endsWith("config.ts")), "contact email only in lib/config.ts");

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll legal guardrail checks passed");
