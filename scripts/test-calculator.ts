/* Sanity + fuzz tests for lib/calculator.ts — run with `npm test`. */
import {
  simulate, purchaseTax, spitzerPayment, sanitizeInputs, maxAffordablePrice, buyingCosts, sellingCostRate,
  monthlyRentTax, surtax, breakEvenAppreciation, purchaseCash, paymentToIncome, BOUNDS, DEFAULT_INPUTS,
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
ok(near(monthlyRentTax(6_000, 5_654), 0.1 * (6_000 - (2 * 5_654 - 6_000)), 0.01), "rent in taper → 10% on the part above the tapered exemption");
ok(near(monthlyRentTax(12_000, 5_654), 1_200, 0.01), "rent above 2× ceiling → 10% track");
ok(near(monthlyRentTax(10_000, 5_654, 6_000), 400, 0.01), "₪90K rule: 10% of (rent − own rent paid)");
ok(near(monthlyRentTax(10_000, 5_654, 9_000), 250, 0.01), "₪90K rule: deduction capped at ₪7,500 a month");
{
  const rich = { ...DEFAULT_INPUTS, equity: 3_000_000, propertyPrice: 4_000_000, rentalYield: 4, ownRentPaid: 6_000 };
  ok(simulate({ ...rich, apartmentType: "single" }).realEstate.totalRentTax < simulate({ ...rich, ownRentPaid: 0 }).realEstate.totalRentTax, "living in a rental lowers the rent tax on a sole apartment");
  ok(simulate({ ...rich, apartmentType: "additional" }).realEstate.totalRentTax === simulate({ ...rich, apartmentType: "additional", ownRentPaid: 0 }).realEstate.totalRentTax, "no rent-paid deduction for an additional apartment");
}

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
const upg = simulate({ ...DEFAULT_INPUTS, apartmentType: "upgrader", sellFirst: false, equity: 1_000_000, propertyPrice: 2_500_000 });
ok(upg.realEstate.shevachExempt && upg.realEstate.maxLtv === 0.7, "upgrader buying first: exempt on sale, 70% LTV");
ok(simulate({ ...DEFAULT_INPUTS, apartmentType: "upgrader", sellFirst: true }).realEstate.maxLtv === 0.75, "upgrader selling first owns nothing at purchase → 75% LTV");
{
  const fee = simulate({ ...DEFAULT_INPUTS, apartmentType: "upgrader", equity: 0, oldHomeValue: 2_000_000, oldHomeMortgage: 500_000, oldHomePrepayFee: 15_000 });
  ok(near(fee.realEstate.oldHomeNetProceeds, 2_000_000 * (1 - 0.0295) - 500_000 - 15_000, 0.01), "early-repayment fee comes off the sale proceeds");
}
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

// Upgrader: the old home's sale joins the starting money, in both tracks
{
  const u = simulate({ ...DEFAULT_INPUTS, apartmentType: "upgrader", equity: 0, oldHomeValue: 2_000_000, oldHomeMortgage: 500_000 });
  const proceeds = 2_000_000 * (1 - 0.0295) - 500_000;
  ok(near(u.realEstate.oldHomeNetProceeds, proceeds, 0.01), "old home: ₪2M − 2.95% fees − ₪500K mortgage = ₪1.441M");
  ok(near(u.realEstate.startCapital, proceeds, 0.01) && near(u.points[0].sp500, proceeds, 0.01), "proceeds are the starting money in both tracks");
  const none = simulate({ ...DEFAULT_INPUTS, apartmentType: "single", oldHomeValue: 2_000_000, oldHomeMortgage: 0 });
  ok(none.realEstate.oldHomeNetProceeds === 0, "old home ignored unless upgrader");
  const under = simulate({ ...DEFAULT_INPUTS, apartmentType: "upgrader", equity: 0, oldHomeValue: 600_000, oldHomeMortgage: 600_000 });
  ok(near(under.realEstate.startCapital, 200_000, 0.01), "fully mortgaged old home → cash raised to the ₪200K minimum");
}

// Buy-first upgrader: before the sale only a bridge loan (all loans on the old home ≤ 50% of its value)
{
  const base = { ...DEFAULT_INPUTS, apartmentType: "upgrader" as const, equity: 600_000, oldHomeValue: 2_000_000, oldHomeMortgage: 500_000, autoPrice: true };
  const buyFirst = simulate({ ...base, sellFirst: false });
  const sellFirst = simulate({ ...base, sellFirst: true });
  ok(near(purchaseCash({ ...base, sellFirst: false }), 600_000 + 500_000, 0.01), "buy first: savings + bridge of 50%×₪2M − ₪500K = ₪1.1M usable");
  ok(buyFirst.realEstate.maxPrice < sellFirst.realEstate.maxPrice, "buy first can afford less than sell first");
  ok(near(buyFirst.points[0].sp500, sellFirst.points[0].sp500, 0.01), "both start with the same own money");
  ok(buyFirst.realEstate.sideFundValue > 0, "old-home money arriving after the sale is invested");
}

// Payment-to-income per Directive 329 annex: mortgage ÷ (income − other loans > 18 months − rent paid)
{
  const inp = { ...DEFAULT_INPUTS, incomeCheck: true, monthlyIncome: 25_000, loanEnabled: true, loanAmount: 200_000, loanRate: 8, loanTerm: 7 };
  const loanPmt = spitzerPayment(200_000, 8, 7);
  ok(near(paymentToIncome(inp, 9_500, loanPmt), 9_500 / (25_000 - loanPmt), 1e-9), "PTI: other loan reduces income, not added to payment");
  ok(near(paymentToIncome({ ...inp, ownRentPaid: 6_000 }, 9_500, loanPmt), 9_500 / (25_000 - loanPmt - 6_000), 1e-9), "PTI: rent paid elsewhere reduces disposable income");
  ok(paymentToIncome({ ...inp, monthlyIncome: 5_000, ownRentPaid: 6_000 }, 9_500, loanPmt) === 10, "PTI: no disposable income → clear fail");
}

// Living in the new apartment: rent saved in full, no vacancy, no rent tax
{
  const rentOut = simulate({ ...DEFAULT_INPUTS, equity: 3_000_000, propertyPrice: 5_000_000, rentalYield: 4 });
  const liveIn = simulate({ ...DEFAULT_INPUTS, equity: 3_000_000, propertyPrice: 5_000_000, rentalYield: 4, liveInNew: true });
  ok(liveIn.realEstate.livesInNew && liveIn.realEstate.totalRentTax === 0 && liveIn.realEstate.totalVacancyLoss === 0, "living in: no rent tax, no vacant months");
  ok(liveIn.realEstate.initialMonthlyRentNet > rentOut.realEstate.initialMonthlyRentNet, "living in: saved rent is worth more than rent received after vacancy and tax");
  ok(!simulate({ ...DEFAULT_INPUTS, apartmentType: "additional", liveInNew: true }).realEstate.livesInNew, "living in is not an option for an additional apartment");
}

// Keep the old apartment and rent it out, move into the new one (still an additional apartment)
{
  const k = simulate({ ...DEFAULT_INPUTS, apartmentType: "additional", liveInNew: true, equity: 1_000_000, propertyPrice: 1_600_000, oldHomeValue: 2_500_000, rentalYield: 3 });
  ok(k.realEstate.rentsOutOld && !k.realEstate.livesInNew, "keep & rent old: flagged, not the sole-apartment living mode");
  ok(near(k.realEstate.initialMonthlyRentGross, (2_500_000 * 3) / 1200, 0.01), "rent comes from the old apartment's value");
  ok(near(k.realEstate.purchaseTax, 1_600_000 * 0.08, 0.01) && k.realEstate.maxLtv === 0.5, "still additional-apartment tax (8%) and 50% LTV");
  ok(k.realEstate.oldHomeNetProceeds === 0, "the old apartment is not sold");
  ok(!k.realEstate.shevachExempt, "selling the new apartment while owning the old one is not exempt");
}

// Keep the old apartment, live elsewhere, rent out both: the household shares one exemption ceiling
{
  const base = { ...DEFAULT_INPUTS, apartmentType: "additional" as const, equity: 1_000_000, propertyPrice: 1_600_000, rentalYield: 3.5 };
  const stay = simulate(base);
  const both = simulate({ ...base, liveElsewhere: true, oldHomeValue: 2_500_000 });
  ok(both.realEstate.rentsOutBoth && !both.realEstate.rentsOutOld, "live elsewhere: both apartments rented out");
  ok(near(both.realEstate.initialMonthlyRentGross, stay.realEstate.initialMonthlyRentGross, 0.01), "the new apartment's own rent is unchanged");
  ok(stay.realEstate.totalRentTax === 0 && both.realEstate.totalRentTax > 0, "the old apartment's rent uses the exemption, so the new rent is taxed");
  const coll = (1_600_000 * 3.5) / 1200 * 11 / 12;
  const oldColl = (5_000_000 * 3.5) / 1200 * 11 / 12; // ₪13,368 a month: alone above twice the ceiling
  ok(near(monthlyRentTax(oldColl + coll, 5_654) - monthlyRentTax(oldColl, 5_654), 0.1 * coll, 0.01), "above twice the ceiling, the extra tax is 10% of the new rent");
}

// Loan to invest in the S&P
const spl = simulate({ ...DEFAULT_INPUTS, spLoanEnabled: true, spLoanAmount: 300_000 });
ok(near(spl.points[0].sp500, DEFAULT_INPUTS.equity, 0.01), "S&P loan: year 0 net worth = own equity (loan offsets)");
ok(spl.sp500.grossValue > simulate(DEFAULT_INPUTS).sp500.grossValue, "S&P loan: portfolio bigger");
ok(near(spl.realEstate.totalCashInvested, spl.sp500.totalCashInvested, 1), "S&P loan + matching: equal own cash in both tracks");
const spl2 = simulate({ ...DEFAULT_INPUTS, equity: 3_000_000, propertyPrice: 1_000_000, spLoanEnabled: true });
ok(spl2.realEstate.initialSideDeposit > 0, "when the S&P loan costs more than the apartment, the apartment track invests the difference");

// Break-even appreciation
const be = breakEvenAppreciation(DEFAULT_INPUTS);
ok(be.value !== null, "break-even exists for defaults");
if (be.value !== null) {
  const atBe = simulate({ ...DEFAULT_INPUTS, appreciation: be.value });
  ok(Math.abs(atBe.realEstate.netWorth - atBe.sp500.netWorth) < 50, `at ${be.value.toFixed(2)}% appreciation both tracks end equal`);
}

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

// "Why it came out this way": both gains + the biggest cost, winner's gain first
{
  const { topReasons } = await import("../lib/insights.ts");
  const d = simulate(DEFAULT_INPUTS);
  const rs = topReasons(d);
  ok(rs.length === 3, "three reasons");
  ok(rs[0].favors === (d.winner === "sp500" ? "sp500" : "realEstate"), "winner's gain listed first");
  const txt = rs.map((x) => x.text((n) => String(Math.round(n)))).join(" ");
  ok(!/NaN|undefined|Infinity/.test(txt), "reasons text has no broken numbers");
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll tests passed");
