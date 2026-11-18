/* Sanity + fuzz tests for lib/calculator.ts — run with `npm test`. */
import {
  simulate, purchaseTax, spitzerPayment, sanitizeInputs, BOUNDS, DEFAULT_INPUTS,
  type SimInputs,
} from "../lib/calculator.ts";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok  ", msg);
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// Purchase tax
ok(purchaseTax(1_900_000, true) === 0, "first apt below bracket → 0");
ok(near(purchaseTax(2_000_000, true), (2_000_000 - 1_978_745) * 0.035, 0.01), "first apt 2M bracket");
ok(near(purchaseTax(2_000_000, false), 160_000, 0.01), "additional apt 8% from first shekel");
ok(near(purchaseTax(7_000_000, false), 6_055_070 * 0.08 + (7_000_000 - 6_055_070) * 0.1, 0.01), "additional top bracket");

// Spitzer
ok(near(spitzerPayment(1_000_000, 0, 25), 1_000_000 / 300, 1e-6), "0% spitzer");
ok(near(spitzerPayment(1_000_000, 4.8, 25), 5730.06, 0.5), "4.8% / 25y spitzer ≈ 5,730");

// Defaults
const r = simulate(DEFAULT_INPUTS);
ok(r.points.length === DEFAULT_INPUTS.years + 1, "points = years + 1");
ok(r.realEstate.downPayment + r.realEstate.purchaseTax + r.realEstate.closingCosts <= DEFAULT_INPUTS.equity + 0.01, "cash conservation upfront");
ok(r.points[0].sp500 === DEFAULT_INPUTS.equity, "S&P starts at equity");
ok(near(r.realEstate.totalCashInvested, r.sp500.totalCashInvested, 1), "matching → equal cash invested");
console.log("\nDefaults:", {
  price: r.realEstate.propertyPrice, loan: Math.round(r.realEstate.loanAmount),
  pmt: Math.round(r.realEstate.monthlyMortgagePayment), rentNet: Math.round(r.realEstate.initialMonthlyRentNet),
  re: Math.round(r.realEstate.netWorth), sp: Math.round(r.sp500.netWorth), winner: r.winner,
  crossovers: r.crossovers, remaining: Math.round(r.realEstate.remainingMortgage),
}, "\n");

// Mortgage fully paid when horizon >= term
const paid = simulate({ ...DEFAULT_INPUTS, years: 30, mortgageTerm: 20 });
ok(paid.realEstate.remainingMortgage === 0, "mortgage paid off after term");

// Zero-growth S&P with no inflation: no tax, value == contributions
const flat = simulate({ ...DEFAULT_INPUTS, spReturn: 0, spFee: 0, inflation: 0 });
ok(near(flat.sp500.grossValue, flat.sp500.totalCashInvested, 1e-3) && flat.sp500.capitalGainsTax === 0, "flat S&P → no gain, no tax");

// Additional apartment pays shevach; first doesn't
const add = simulate({ ...DEFAULT_INPUTS, isFirstApartment: false, equity: 1_000_000 });
ok(add.realEstate.shevachTax > 0 && !add.realEstate.shevachExempt, "additional apt pays מס שבח");
ok(r.realEstate.shevachTax === 0 && r.realEstate.shevachExempt, "first apt exempt");

// Equity exceeding price → no loan, leftover invested
const rich = simulate({ ...DEFAULT_INPUTS, equity: 3_000_000, propertyPrice: 500_000 });
ok(rich.realEstate.loanAmount === 0 && rich.realEstate.sideFundValue > 0, "unused equity → side fund, no loan");

// Shortfall → flagged, still finite
const poor = simulate({ ...DEFAULT_INPUTS, equity: 200_000, propertyPrice: 5_000_000, isFirstApartment: false });
ok(poor.realEstate.equityShortfall, "shortfall flagged");

// Fuzz: random + extreme inputs never produce NaN/Infinity
const keys = Object.keys(BOUNDS) as (keyof typeof BOUNDS)[];
let bad = 0;
const check = (inp: Partial<SimInputs>) => {
  const s = simulate(inp);
  const nums: number[] = [s.difference, ...Object.values(s.realEstate).filter((v) => typeof v === "number") as number[],
    ...Object.values(s.sp500) as number[], ...s.points.flatMap((p) => [p.realEstate, p.sp500, p.propertyValue, p.mortgageBalance])];
  if (nums.some((n) => !Number.isFinite(n))) { bad++; if (bad < 3) console.error("non-finite for", inp); }
};
for (let i = 0; i < 3000; i++) {
  const inp: Record<string, unknown> = {};
  for (const k of keys) {
    const b = BOUNDS[k];
    const mode = Math.random();
    inp[k] = mode < 0.1 ? b.min : mode < 0.2 ? b.max : b.min + Math.random() * (b.max - b.min);
  }
  inp.autoPrice = Math.random() < 0.5; inp.isFirstApartment = Math.random() < 0.5; inp.cashflowMatching = Math.random() < 0.5;
  check(inp as Partial<SimInputs>);
}
check(sanitizeInputs({ equity: "abc", years: NaN, propertyPrice: Infinity, mortgageRate: -5, spReturn: "1e9" } as never));
check({} as Partial<SimInputs>);
ok(bad === 0, "fuzz: 3000+ random/extreme/garbage inputs, all outputs finite");

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll tests passed");
