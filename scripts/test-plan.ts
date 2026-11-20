/* Tests for the planner draft (lib/plan.ts) — run with `npm test`. */
import { basics, decisionInputs, priceRange, leverage, monthsToMinimum, advisorPrompt, ADVISOR_QUESTIONS, DEFAULT_PROFILE, COMFORTABLE_PTI, type Profile } from "../lib/plan.ts";
import { breakEvenAppreciation } from "../lib/calculator.ts";
import { simulate, maxAffordablePrice, purchaseCash, spitzerPayment } from "../lib/calculator.ts";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok  ", msg);
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const P = (x: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, ...x });

// The basics, by hand: 200K + 400K − 6×17K cushion − 40K debt at 9% − 25% of 100K gain = 433K
{
  const b = basics(P());
  ok(b.cushion === 102_000, "cushion = 6 months of spending");
  ok(b.debtPayoff === 40_000 && b.debtKept === 0, "a 9% loan is repaid first");
  ok(b.saleTax === 25_000, "25% tax on the unrealised gain when selling the portfolio");
  ok(b.available === 433_000, "money left to invest = 433K");
  ok(b.monthlySaving === 7_000, "saving 7K a month");
  ok(!b.shortfall, "enough for an apartment");
}
ok(basics(P({ debtRate: 4 })).debtPayoff === 0 && basics(P({ debtRate: 4 })).available === 473_000, "a cheap loan is kept and its money stays invested");
ok(near(basics(P({ debtRate: 4 })).existingPayments, spitzerPayment(40_000, 4, 5), 0.01), "a kept loan's payment counts against the mortgage budget");
ok(basics(P({ useHishtalmut: true })).available === 553_000, "keren hishtalmut is added only when chosen");
ok(basics(P({ bigExpense: 100_000 })).available === 333_000, "money for a big expense is set aside");
ok(basics(P({ cash: 50_000, investments: 0, investmentsGain: 0 })).available === 0, "never negative");
{
  const b = basics(P({ cash: 100_000, investments: 0, investmentsGain: 0 }));
  ok(b.cushion === 100_000 && b.setAsideGap === 2_000, "100K on hand: all of it to the cushion, 2K still missing");
  ok(b.debtPayoff === 0 && b.debtKept === 40_000 && b.existingPayments > 0, "nothing left to repay the loan, so it stays and its payment counts");
  const c = basics(P({ cash: 120_000, investments: 0, investmentsGain: 0 }));
  ok(c.debtPayoff === 18_000 && c.debtKept === 22_000 && c.available === 0, "after the cushion, the rest goes to the expensive loan");
}
ok(basics(P({ cash: 150_000, investments: 0, investmentsGain: 0, debt: 0 })).shortfall, "48K left → not enough for an apartment yet");
ok(basics(P({ cash: 0, investments: 0, investmentsGain: 0, debt: 0, home: "own", homePlan: "live" })).shortfall === false, "upgraders can use the old home's equity");
ok(basics(P({ investmentsGain: 900_000 })).saleTax === 100_000, "gain can't exceed the portfolio");

// Mapping to the engine
ok(decisionInputs(P(), basics(P()), 1_500_000).apartmentType === "single" && decisionInputs(P(), basics(P()), 1_500_000).liveInNew, "no home + live → sole apartment, living in it");
ok(!decisionInputs(P({ homePlan: "invest" }), basics(P()), 1_500_000).liveInNew, "no home + invest → rent it out");
{
  const p = P({ home: "own", homePlan: "live" });
  const x = decisionInputs(p, basics(p), 3_000_000);
  ok(x.apartmentType === "upgrader" && x.oldHomeValue === 2_000_000 && x.oldHomeMortgage === 500_000 && x.sellFirst, "own + live → upgrader selling the old home");
}
{
  const p = P({ home: "own", homePlan: "invest" });
  const x = decisionInputs(p, basics(p), 1_500_000);
  ok(x.apartmentType === "additional" && !x.liveInNew && !x.liveElsewhere, "own + invest → additional apartment, staying at home");
  ok(basics(p).existingPayments > 0, "keeping the home keeps its mortgage payment");
}
ok(decisionInputs(P({ risk: 0 }), basics(P()), 1_500_000).spReturn === 7 && decisionInputs(P({ risk: 4 }), basics(P()), 1_500_000).appreciation === 6, "risk level sets the assumptions");

// Price: within the bank limit and the comfortable payment
for (const x of [P(), P({ income: 12_000 }), P({ income: 60_000 }), P({ home: "own", homePlan: "live" }), P({ home: "own", homePlan: "invest", cash: 900_000 }), P({ homePlan: "invest" })]) {
  const b = basics(x);
  const r = priceRange(x, b);
  const inp = decisionInputs(x, b, r.suggested);
  const cap = maxAffordablePrice(purchaseCash(inp), inp.apartmentType, inp.useBroker, inp.sellFirst);
  const pay = simulate(inp).realEstate.monthlyMortgagePayment;
  const label = `${x.home}/${x.homePlan} income ${x.income}`;
  ok(r.suggested <= cap && r.bankCap === cap, `${label}: price ${r.suggested / 1000}K within the bank limit ${cap / 1000}K`);
  ok(r.suggested === 300_000 || pay <= r.paymentBudget + 1, `${label}: payment ${Math.round(pay)} within the comfortable budget ${Math.round(r.paymentBudget)}`);
  if (r.limitedBy === "income" && r.suggested > 300_000) {
    const more = simulate({ ...inp, propertyPrice: r.suggested + 20_000 }).realEstate.monthlyMortgagePayment;
    ok(more > r.paymentBudget, `${label}: 20K more would break the budget (tight bound)`);
  }
}
ok(priceRange(P({ income: 12_000 }), basics(P({ income: 12_000 }))).limitedBy === "income", "low income → price limited by income");
ok(priceRange(P({ income: 60_000 }), basics(P({ income: 60_000 }))).limitedBy === "bank", "high income → price limited by the bank");
ok(priceRange(P({ income: 30_000 }), basics(P({ income: 30_000 }))).suggested >= priceRange(P({ income: 15_000 }), basics(P({ income: 15_000 }))).suggested, "more income never lowers the price");
ok(near(priceRange(P(), basics(P())).paymentBudget, COMFORTABLE_PTI * 24_000, 0.01), "budget = 30% of income when there are no other loans");

// Leverage numbers
{
  const p = P();
  const b = basics(p);
  const r = simulate(decisionInputs(p, b, priceRange(p, b).suggested));
  const l = leverage(r, p, b);
  ok(near(l.exposure, r.realEstate.propertyPrice / r.realEstate.startCapital, 1e-9), "exposure = price ÷ own money");
  ok(near(l.aptDropLoss, 0.15 * l.exposure, 1e-9), "15% price fall × leverage");
  ok(near(l.spDropLoss, 0.35, 1e-9), "no S&P loan → a 35% fall costs 35%");
  ok(l.pti <= COMFORTABLE_PTI + 0.001, "loan payments within 30% of income");
}
ok(monthsToMinimum(basics(P({ cash: 150_000, investments: 0, investmentsGain: 0, debt: 0 }))) === Math.ceil((200_000 - 48_000) / 7_000), "months to the minimum at today's saving");
ok(monthsToMinimum(basics(P({ cash: 150_000, investments: 0, investmentsGain: 0, debt: 0, expenses: 24_000 }))) === Infinity, "not saving → never");

// The AI advisor prompt
{
  const p = P();
  const b = basics(p);
  const price = priceRange(p, b).suggested;
  const inputs = decisionInputs(p, b, price);
  const result = simulate(inputs);
  const decision = { price, result, lev: leverage(result, p, b), be: breakEvenAppreciation(inputs) };
  const empty = advisorPrompt(p, b, decision, {});
  ok(empty.includes("₪24,000") && empty.includes("₪433,000") && empty.includes("₪400,000"), "prompt carries the household's numbers");
  ok(empty.includes(`${(result.realEstate.netWorth / 1e6).toFixed(2)}M`) && empty.includes(`${(result.sp500.netWorth / 1e6).toFixed(2)}M`), "prompt carries both results");
  ok(ADVISOR_QUESTIONS.every((q) => empty.includes(q.ask)), "unanswered: the AI is asked to ask every advisor question");
  ok(empty.includes("שאל 3–4 שאלות בכל פעם"), "the AI asks before advising");
  ok(!/[\u2066-\u2069]|NaN|undefined|Infinity/.test(empty), "plain text, no broken values");
  const answered = advisorPrompt(p, b, decision, { age: "30–40", drop: "מחכה בסבלנות", note: "צפויה ירושה" });
  ok(answered.includes("גיל: 30–40.") && !answered.includes(ADVISOR_QUESTIONS[0].ask), "an answered question moves from 'ask me' to the data");
  ok(answered.includes("צפויה ירושה"), "free note included");
  const short = P({ cash: 150_000, investments: 0, investmentsGain: 0, debt: 0 });
  ok(advisorPrompt(short, basics(short), null, {}).includes("עוד לא מספיק להון עצמי"), "no decision → says there isn't enough for an apartment yet");
}

// Fuzz: random households through the whole flow
{
  const { PROFILE_BOUNDS } = await import("../lib/plan.ts");
  let bad = 0;
  const rnd = (b: { min: number; max: number; step: number }) => {
    const m = Math.random();
    const v = m < 0.1 ? b.min : m < 0.2 ? b.max : b.min + Math.random() * (b.max - b.min);
    return Math.round(v / b.step) * b.step;
  };
  for (let i = 0; i < 400; i++) {
    const p: Profile = {
      ...DEFAULT_PROFILE,
      cash: rnd(PROFILE_BOUNDS.cash), investments: rnd(PROFILE_BOUNDS.investments), hishtalmut: rnd(PROFILE_BOUNDS.hishtalmut),
      homeValue: rnd(PROFILE_BOUNDS.homeValue), homeMortgage: rnd(PROFILE_BOUNDS.homeMortgage), debt: rnd(PROFILE_BOUNDS.debt),
      debtRate: rnd(PROFILE_BOUNDS.debtRate), income: rnd(PROFILE_BOUNDS.income), expenses: rnd(PROFILE_BOUNDS.expenses),
      years: rnd(PROFILE_BOUNDS.years), bigExpense: rnd(PROFILE_BOUNDS.bigExpense), cushionMonths: rnd(PROFILE_BOUNDS.cushionMonths),
      home: Math.random() < 0.5 ? "none" : "own", homePlan: Math.random() < 0.5 ? "live" : "invest",
      useHishtalmut: Math.random() < 0.5, risk: Math.floor(Math.random() * 5),
    };
    p.investmentsGain = Math.round(Math.random() * p.investments);
    const b = basics(p);
    let decision = null;
    if (!b.shortfall) {
      const range = priceRange(p, b);
      const inputs = decisionInputs(p, b, range.suggested);
      const result = simulate(inputs);
      const re = result.realEstate;
      const nums = [range.suggested, range.bankCap, re.netWorth, result.sp500.netWorth, re.monthlyMortgagePayment];
      if (nums.some((n) => !Number.isFinite(n)) || re.ltv > re.maxLtv + 1e-9 || re.equityShortfall || range.suggested > range.bankCap || re.priceCapped) {
        bad++; if (bad < 4) console.error("bad decision", p, range, re.ltv, re.maxLtv);
      }
      decision = { price: range.suggested, result, lev: leverage(result, p, b), be: breakEvenAppreciation(inputs) };
    }
    const text = advisorPrompt(p, b, decision, {});
    if (/NaN|undefined|Infinity/.test(text)) { bad++; if (bad < 4) console.error("bad prompt", p); }
  }
  ok(bad === 0, "fuzz: 400 random households, finite numbers, price within the bank limit, clean prompt");
}

// Mix in the prompt
{
  const p = P(); const b = basics(p); const price = priceRange(p, b).suggested;
  const inputs = decisionInputs(p, b, price); const result = simulate(inputs);
  const d = { price, result, lev: leverage(result, p, b), be: breakEvenAppreciation(inputs) };
  const top = Math.max(result.realEstate.netWorth, result.sp500.netWorth);
  ok(advisorPrompt(p, b, { ...d, bestMix: { share: 40, value: top + 50_000, price: 900_000 } }, {}).includes("שילוב: 40% מהכסף לדירה"), "a winning mix appears in the prompt");
  ok(!advisorPrompt(p, b, { ...d, bestMix: { share: 40, value: top - 1, price: 900_000 } }, {}).includes("שילוב:"), "a mix that doesn't win is left out");
}

// Seeding the guided path from the simulator
{
  const { profileFromInputs } = await import("../lib/plan.ts");
  const { DEFAULT_INPUTS } = await import("../lib/calculator.ts");
  const { SITUATIONS, situationInputs } = await import("../lib/presets.ts");
  const want: Record<string, [string, string]> = {
    firstHome: ["none", "live"], firstInvest: ["none", "invest"], upgrade: ["own", "live"],
    secondInvest: ["own", "invest"], moveRentOld: ["own", "invest"], twoRentals: ["own", "invest"],
  };
  for (const sit of SITUATIONS) {
    const x = { ...DEFAULT_INPUTS, ...situationInputs(sit) } as typeof DEFAULT_INPUTS;
    const pr = profileFromInputs(x);
    ok(pr.home === want[sit.id][0] && pr.homePlan === want[sit.id][1] && pr.cash === x.equity && pr.years === x.years, `${sit.id} → guided path: ${pr.home}/${pr.homePlan}, same money and years`);
  }
  const up = profileFromInputs({ ...DEFAULT_INPUTS, apartmentType: "upgrader", oldHomeValue: 2_500_000, oldHomeMortgage: 300_000 });
  ok(up.homeValue === 2_500_000 && up.homeMortgage === 300_000, "upgrader's old home carries over");
  ok(profileFromInputs({ ...DEFAULT_INPUTS, appreciation: 6, rentGrowth: 4, spReturn: 11, fxDrift: 0 }).risk === 4, "risk level carries over");
  // Guided result opened in the simulator gives the same answer
  const p = P(); const b = basics(p); const inputs = decisionInputs(p, b, priceRange(p, b).suggested);
  ok(simulate(inputs).difference === simulate({ ...inputs }).difference, "the simulator gets exactly the guided path's inputs");
}

// Shared plan link
{
  const { encodePlan, decodePlan } = await import("../lib/plan.ts");
  const state = { profile: P({ cash: 345_000, home: "own", homePlan: "invest", risk: 3 }), answers: { age: "30–40", note: "בדיקה ✓" }, step: 4 };
  const back = decodePlan(encodePlan(state));
  ok(JSON.stringify(back) === JSON.stringify(state), "plan → link → plan, unchanged (Hebrew included)");
  ok(decodePlan("not-base64!!") === undefined && decodePlan(null) === undefined, "a broken link opens nothing, no crash");
  const evil = decodePlan(Buffer.from(JSON.stringify({ profile: { cash: 1e15, home: "x", risk: 99 }, answers: { age: "<script>" }, step: 42 })).toString("base64url"));
  ok(evil!.profile.cash === 3_000_000 && evil!.profile.home === "none" && evil!.profile.risk === 2 && evil!.answers.age === undefined && evil!.step === 0, "values from a link are clamped and validated");
}

// Usage counts
{
  const { applyEvent, buildReport } = await import("../lib/track.ts");
  const base: import("../lib/track.ts").VisitorSummary = { first: "a", last: "a", visits: 1, cards: {}, guideCard: 0, guideLink: 0, maxStep: 0, steps: {}, promptCopy: 0, planCopy: 0, planLink: 0, toSimulator: 0, share: 0, combo: 0 };
  const seen = new Set<number>();
  let v = base;
  for (const e of [{ type: "card", id: "upgrade" }, { type: "card", id: "upgrade" }, { type: "guideCard" }, { type: "step", step: 1 }, { type: "step", step: 2 }, { type: "step", step: 1 }, { type: "step", step: 4 }, { type: "promptCopy" }] as const)
    v = applyEvent(v, e as never, seen);
  ok(v.cards.upgrade === 2 && v.guideCard === 1 && v.maxStep === 4 && v.steps["1"] === 1 && v.promptCopy === 1, "events add up; a step counts once per visit");
  ok(base.cards && Object.keys(base.cards).length === 0, "summary is not mutated in place");
  const r = buildReport([v, { ...base, cards: { firstHome: 1 } }, { ...base, maxStep: 6, guideLink: 1 }]);
  ok(r.visitors === 3 && r.usedCards === 2 && r.openedGuide === 2 && r.viaCard === 1 && r.viaLink === 1, "report: entry points");
  ok(JSON.stringify(r.funnel) === JSON.stringify([2, 2, 2, 2, 1, 1]), "report: funnel by highest step");
  ok(buildReport([]).visitors === 0, "empty report");
}

// No sensitive data in the usage counts
{
  const { applyEvent } = await import("../lib/track.ts");
  const keys = Object.keys(applyEvent({ first: "2026-01-01", last: "2026-01-01", visits: 1, cards: {}, guideCard: 0, guideLink: 0, maxStep: 0, steps: {}, promptCopy: 0, planCopy: 0, planLink: 0, toSimulator: 0, share: 0, combo: 0 }, { type: "promptCopy" }, new Set()));
  ok(keys.every((k) => ["first", "last", "visits", "cards", "guideCard", "guideLink", "maxStep", "steps", "promptCopy", "planCopy", "planLink", "toSimulator", "share", "combo"].includes(k)), "usage record holds counters and dates only: no amounts, answers or names");
  const src = (await import("node:fs")).readFileSync(new URL("../lib/track.ts", import.meta.url), "utf8");
  ok(!/profile|answers|equity|income|cash|note/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/PRIVACY_NOTE[\s\S]*?;/, "")), "the tracker never touches financial data or answers");
}

// Living elsewhere while our apartment is rented out (guided path → simulator)
{
  const { rentsOutBothHomes, situationText, profileFromInputs, hishtalmutWithdrawalCost } = await import("../lib/plan.ts");
  const { DEFAULT_INPUTS } = await import("../lib/calculator.ts");
  const home = P({ home: "own", homePlan: "invest", cash: 1_400_000, investments: 0, investmentsGain: 0, debt: 0 });
  const away = { ...home, livesNow: "elsewhere" as const, housingCost: 4_500, oldHomeRent: 5_200 };
  const xHome = decisionInputs(home, basics(home), 1_700_000);
  const xAway = decisionInputs(away, basics(away), 1_700_000);
  ok(!xHome.liveElsewhere && xAway.liveElsewhere && rentsOutBothHomes(away), "lives elsewhere → liveElsewhere, like the two-rentals card");
  ok(xAway.ownRentPaid === 4_500 && !xAway.ownRentAuto && xAway.oldHomeRent === 5_200, "housing cost and the rent received carry over");
  ok(simulate(xAway).realEstate.totalRentTax > simulate(xHome).realEstate.totalRentTax, "renting out both apartments brings the shared-ceiling tax");
  ok(situationText(away).includes("מושכרת") && situationText(away).includes("4,500"), "situation sentence describes it");
  const r = simulate(xAway);
  const prompt = advisorPrompt(away, basics(away), { price: 1_700_000, result: r, lev: leverage(r, away, basics(away)), be: breakEvenAppreciation(xAway) }, {});
  ok(prompt.includes("מושכרת") && prompt.includes("להמשיך לגור במקום אחר"), "AI prompt describes living elsewhere");
  const back = profileFromInputs({ ...DEFAULT_INPUTS, apartmentType: "additional", liveElsewhere: true, ownRentAuto: false, ownRentPaid: 3_000, oldHomeRent: 4_800 });
  ok(back.livesNow === "elsewhere" && back.housingCost === 3_000 && back.oldHomeRent === 4_800, "two-rentals in the simulator → lives elsewhere in the guided path");
  // keren hishtalmut joins as a tax-free part of the S&P track
  const k = P({ useHishtalmut: true });
  const xk = decisionInputs(k, basics(k), 1_500_000);
  ok(xk.hishtalmutAmount === 120_000, "keren used → hishtalmutAmount");
  ok(hishtalmutWithdrawalCost(k) > 0 && hishtalmutWithdrawalCost(P({ hishtalmut: 0 })) === 0, "withdrawal cost shown only when there is a keren");
  const kb = profileFromInputs({ ...DEFAULT_INPUTS, equity: 500_000, hishtalmutAmount: 100_000 });
  ok(kb.cash === 400_000 && kb.hishtalmut === 100_000 && kb.useHishtalmut, "simulator keren → guided path keren");
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll planner tests passed");
