/* Sanity + fuzz tests for lib/calculator.ts — run with `npm test`. */
import {
  simulate, purchaseTax, spitzerPayment, sanitizeInputs, maxAffordablePrice, buyingCosts, sellingCostRate,
  monthlyRentTax, surtax, BOUNDS, DEFAULT_INPUTS,
  type SimInputs,
} from "../lib/calculator.ts";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok  ", msg);
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// Purchase tax
ok(purchaseTax(1_900_000, "single") === 0, "single apt below bracket → 0");
ok(near(purchaseTax(2_000_000, "single"), (2_000_000 - 1_978_745) * 0.035, 0.01), "single apt 2M bracket");
ok(purchaseTax(3_000_000, "upgrader") === purchaseTax(3_000_000, "single"), "upgrader pays single-apartment rates");
ok(near(purchaseTax(3_000_000, "single"), 45_538, 50), "₪3M single/upgrader ≈ ₪45.5K (research figure)");
ok(near(purchaseTax(2_000_000, "additional"), 160_000, 0.01), "additional apt 8% from first shekel");
ok(near(purchaseTax(7_000_000, "additional"), 6_055_070 * 0.08 + (7_000_000 - 6_055_070) * 0.1, 0.01), "additional top bracket");

// Buying / selling costs (broker 2% + lawyer 0.5%, +18% VAT, + ₪10K fixed)
ok(near(buyingCosts(2_000_000, true), 2_000_000 * 0.025 * 1.18 + 10_000, 0.01), "buying costs with broker = 2.95% + ₪10K");
ok(near(buyingCosts(2_000_000, false), 2_000_000 * 0.005 * 1.18 + 10_000, 0.01), "buying costs without broker");
ok(near(sellingCostRate(true), 0.0295, 1e-9), "selling costs 2.95% with broker");

// Rental tax tracks
ok(monthlyRentTax(5_654, 5_654) === 0, "rent at ceiling → exempt");
ok(near(monthlyRentTax(6_000, 5_654), Math.min(600, 0.31 * (6_000 - (2 * 5_654 - 6_000))), 0.01), "rent in taper → cheaper of 10% and taper");
ok(near(monthlyRentTax(12_000, 5_654), 1_200, 0.01), "rent above 2× ceiling → 10% track");

// Surtax
ok(surtax(700_000, 721_560) === 0 && near(surtax(1_000_000, 721_560), 0.05 * 278_440, 0.01), "surtax 5% above ₪721,560");

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
const flat = simulate({ ...DEFAULT_INPUTS, spReturn: 0, spFee: 0, inflation: 0, spVehicle: "israeli" });
ok(flat.sp500.grossValue <= flat.sp500.totalCashInvested && flat.sp500.capitalGainsTax === 0, "0% S&P return (minus dividend drag) → no gain, no tax");

// Additional apartment pays shevach; first doesn't
const add = simulate({ ...DEFAULT_INPUTS, apartmentType: "additional", equity: 1_000_000 });
ok(add.realEstate.shevachTax > 0 && !add.realEstate.shevachExempt, "additional apt pays מס שבח");
const upg = simulate({ ...DEFAULT_INPUTS, apartmentType: "upgrader", equity: 1_000_000, propertyPrice: 2_500_000 });
ok(upg.realEstate.shevachExempt && upg.realEstate.maxLtv === 0.7, "upgrader: exempt on sale, 70% LTV");
ok(r.realEstate.shevachTax === 0 && r.realEstate.shevachExempt, "first apt exempt");

// Equity exceeding price → no loan, leftover invested
const rich = simulate({ ...DEFAULT_INPUTS, equity: 3_000_000, propertyPrice: 500_000 });
ok(rich.realEstate.loanAmount === 0 && rich.realEstate.sideFundValue > 0, "unused equity → side fund, no loan");

// Bank financing limits are enforced (50% additional / 75% single)
ok(maxAffordablePrice(350_000, "additional") === 550_000, "₪350K, additional apt → max ₪550K (50% down + 8% tax + 2.95% costs + ₪10K)");
ok(maxAffordablePrice(1_000_000, "upgrader") > maxAffordablePrice(1_000_000, "additional"), "upgrader (70% LTV) can buy more than investor (50%)");
const capped = simulate({ ...DEFAULT_INPUTS, equity: 350_000, apartmentType: "additional", propertyPrice: 2_000_000 });
ok(capped.realEstate.propertyPrice === 550_000 && capped.realEstate.priceCapped, "₪2M choice is capped to ₪550K");
ok(capped.realEstate.ltv <= 0.5 + 1e-9, `additional apt LTV ≤ 50% (got ${(capped.realEstate.ltv * 100).toFixed(1)}%)`);
const single = simulate({ ...DEFAULT_INPUTS, equity: 350_000, apartmentType: "single", propertyPrice: 5_000_000 });
ok(single.realEstate.ltv <= 0.75 + 1e-9 && single.realEstate.propertyPrice > 1_000_000, "single apt LTV ≤ 75%");
const auto = simulate({ ...DEFAULT_INPUTS, equity: 1_000_000, apartmentType: "additional", autoPrice: true });
ok(auto.realEstate.propertyPrice === maxAffordablePrice(1_000_000, "additional"), "auto mode buys the max the bank allows");

// Down-payment loan
const withLoan = simulate({ ...DEFAULT_INPUTS, equity: 350_000, apartmentType: "additional", propertyPrice: 5_000_000, loanEnabled: true, loanAmount: 200_000 });
ok(withLoan.realEstate.propertyPrice === maxAffordablePrice(550_000, "additional"), "loan adds to cash for the purchase");
ok(withLoan.realEstate.extraLoanPayment > 0 && near(withLoan.realEstate.initialMonthlyGap, withLoan.realEstate.monthlyMortgagePayment + withLoan.realEstate.extraLoanPayment - withLoan.realEstate.initialMonthlyRentNet, 0.01), "loan payment counts in the monthly gap");
ok(withLoan.realEstate.extraLoanRemaining === 0, "10-year loan repaid within 15 years");
ok(near(withLoan.realEstate.totalCashInvested, withLoan.sp500.totalCashInvested, 1), "with loan + matching, both tracks still invest the same own cash");

// Sole-apartment exemption ceiling & foreign ETF indexation
const big = simulate({ ...DEFAULT_INPUTS, equity: 3_000_000, propertyPrice: 5_000_000, years: 15 });
ok(big.realEstate.shevachPartial && big.realEstate.shevachTax > 0, "single apt sold above ₪5.008M ceiling (indexed) → partial מס שבח");
const isr = simulate({ ...DEFAULT_INPUTS, spVehicle: "israeli" });
const irl = simulate({ ...DEFAULT_INPUTS, spVehicle: "irish" });
ok(irl.sp500.capitalGainsTax > isr.sp500.capitalGainsTax, "Irish ETF (USD-indexed, flat FX) pays more tax than CPI-indexed Israeli fund");
const rich2 = simulate({ ...DEFAULT_INPUTS, equity: 3_000_000, years: 30 });
ok(rich2.sp500.surtax > 0, "large S&P gain triggers מס יסף");
ok(!simulate({ ...DEFAULT_INPUTS, equity: 200_000, propertyPrice: 5_000_000, apartmentType: "additional" }).realEstate.equityShortfall, "equity always covers costs + down payment");

// Fuzz: random + extreme inputs never produce NaN/Infinity
const keys = Object.keys(BOUNDS) as (keyof typeof BOUNDS)[];
let bad = 0;
const check = (inp: Partial<SimInputs>) => {
  const s = simulate(inp);
  const nums: number[] = [s.difference, ...Object.values(s.realEstate).filter((v) => typeof v === "number") as number[],
    ...(Object.values(s.sp500).filter((v) => typeof v === "number") as number[]), ...s.points.flatMap((p) => [p.realEstate, p.sp500, p.propertyValue, p.mortgageBalance])];
  if (nums.some((n) => !Number.isFinite(n))) { bad++; if (bad < 3) console.error("non-finite for", inp); }
  if (s.realEstate.ltv > s.realEstate.maxLtv + 1e-9 || s.realEstate.equityShortfall) { bad++; if (bad < 3) console.error("LTV over limit for", inp); }
};
for (let i = 0; i < 3000; i++) {
  const inp: Record<string, unknown> = {};
  for (const k of keys) {
    const b = BOUNDS[k];
    const mode = Math.random();
    inp[k] = mode < 0.1 ? b.min : mode < 0.2 ? b.max : b.min + Math.random() * (b.max - b.min);
  }
  inp.autoPrice = Math.random() < 0.5; inp.apartmentType = ["single", "upgrader", "additional"][Math.floor(Math.random() * 3)]; inp.spVehicle = Math.random() < 0.5 ? "israeli" : "irish"; inp.useBroker = Math.random() < 0.5; inp.loanEnabled = Math.random() < 0.5; inp.cashflowMatching = Math.random() < 0.5;
  check(inp as Partial<SimInputs>);
}
check(sanitizeInputs({ equity: "abc", years: NaN, propertyPrice: Infinity, mortgageRate: -5, spReturn: "1e9" } as never));
check({} as Partial<SimInputs>);
ok(bad === 0, "fuzz: 3000+ random/extreme/garbage inputs, all finite, LTV never over the bank limit");

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll tests passed");
