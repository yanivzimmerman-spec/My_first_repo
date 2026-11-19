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

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll planner tests passed");
