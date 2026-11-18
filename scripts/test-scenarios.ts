/*
 * Scenario matrix test: every combination of the simulator's options, checked
 * against invariants and closed-form results. Run with `npm run test:scenarios`.
 */
import {
  simulate,
  purchaseTax,
  buyingCosts,
  sellingCostRate,
  maxAffordablePrice,
  spitzerPayment,
  BOUNDS,
  DEFAULT_INPUTS,
  type SimInputs,
  type ApartmentType,
  type SpVehicle,
  type SimResult,
} from "../lib/calculator.ts";

// Legal values hard-coded here on purpose (not imported), so a wrong constant in the engine fails.
const MAX_LTV: Record<ApartmentType, number> = { single: 0.75, upgrader: 0.7, additional: 0.5 };
const CAPITAL_GAINS_TAX_RATE = 0.25;
const SHEVACH_SINGLE_CEILING = 5_008_000;
const SURTAX_THRESHOLD = 721_560;
const RENT_CEILING = 5_654;

/** Independent month-1 rent after vacancy, rent tax (cheaper track), 8% maintenance, ₪150 insurance. */
function expectedNetRent(price: number, yieldPct: number): number {
  const gross = (price * yieldPct) / 100 / 12;
  const collected = (gross * 11) / 12;
  let tax = 0;
  if (collected > RENT_CEILING) {
    const exempt = Math.max(0, Math.min(RENT_CEILING, 2 * RENT_CEILING - collected));
    tax = Math.min(0.1 * collected, 0.31 * (collected - exempt));
  }
  return collected - tax - 0.08 * collected - 150;
}

const TYPES: ApartmentType[] = ["single", "upgrader", "additional"];
const VEHICLES: SpVehicle[] = ["israeli", "irish"];
const BOOLS = [false, true];
const EQUITY = [200_000, 350_000, 600_000, 1_500_000, 3_000_000];
const YEARS = [5, 15, 30];
const MARKETS: Record<string, Partial<SimInputs>> = {
  low: { mortgageRate: 2.5, rentalYield: 2.2, rentGrowth: 1, appreciation: 1, spReturn: 5, spFee: 0.05, inflation: 1 },
  base: {},
  high: { mortgageRate: 7.5, rentalYield: 4.5, rentGrowth: 5, appreciation: 7, spReturn: 12, spFee: 0.5, inflation: 4 },
};

const failures = new Map<string, { count: number; example: string }>();
let checks = 0;
function check(cond: boolean, rule: string, ctx: () => string) {
  checks++;
  if (cond) return;
  const f = failures.get(rule);
  if (f) f.count++;
  else failures.set(rule, { count: 1, example: ctx() });
}
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

/** Closed-form Spitzer balance after k payments (k ≤ n). */
function spitzerBalance(P: number, ratePct: number, years: number, k: number): number {
  const n = years * 12;
  if (k >= n || P <= 0) return 0;
  const i = ratePct / 100 / 12;
  if (i === 0) return P * (1 - k / n);
  const pmt = spitzerPayment(P, ratePct, years);
  return P * Math.pow(1 + i, k) - (pmt * (Math.pow(1 + i, k) - 1)) / i;
}

function checkScenario(inp: SimInputs, r: SimResult) {
  const re = r.realEstate;
  const sp = r.sp500;
  const ctx = () => JSON.stringify(inp);
  const cash = inp.equity + (inp.loanEnabled ? inp.loanAmount : 0);
  const months = inp.years * 12;

  // 1. Everything finite
  const nums = [
    r.difference,
    ...Object.values(re).filter((v) => typeof v === "number"),
    ...Object.values(sp).filter((v) => typeof v === "number"),
    ...r.points.flatMap((p) => [p.realEstate, p.sp500, p.propertyValue, p.mortgageBalance, p.diff]),
  ] as number[];
  check(nums.every(Number.isFinite), "all outputs finite", ctx);

  // 2. Bank limits and price bounds
  check(re.ltv <= MAX_LTV[inp.apartmentType] + 1e-9, "LTV within bank limit", ctx);
  check(re.propertyPrice <= re.maxPrice && re.propertyPrice >= BOUNDS.propertyPrice.min, "price within cap and bounds", ctx);
  check(re.maxPrice === maxAffordablePrice(cash, inp.apartmentType, inp.useBroker), "max price recomputes", ctx);
  check(!re.equityShortfall, "cash covers tax + costs + down payment", ctx);
  if (inp.autoPrice) check(re.propertyPrice === re.maxPrice, "auto mode uses max price", ctx);
  else check(re.propertyPrice === Math.min(inp.propertyPrice, re.maxPrice), "manual price respected unless capped", ctx);

  // 3. Upfront cash conservation
  const unused = Math.max(0, cash - re.purchaseTax - re.closingCosts - re.propertyPrice);
  check(near(re.downPayment + re.purchaseTax + re.closingCosts + unused, cash, 0.01), "upfront cash adds up", ctx);
  check(near(re.loanAmount, re.propertyPrice - re.downPayment, 0.01), "mortgage = price − down payment", ctx);
  check(near(re.purchaseTax, purchaseTax(re.propertyPrice, inp.apartmentType), 0.01), "purchase tax by type", ctx);
  check(near(re.closingCosts, buyingCosts(re.propertyPrice, inp.useBroker), 0.01), "buying costs", ctx);

  // 4. Mortgage and loan balances match closed form
  const k = Math.min(months, inp.mortgageTerm * 12);
  check(near(re.remainingMortgage, spitzerBalance(re.loanAmount, inp.mortgageRate, inp.mortgageTerm, k), 2), "mortgage balance (closed form)", ctx);
  if (inp.loanEnabled) {
    const kl = Math.min(months, inp.loanTerm * 12);
    check(near(re.extraLoanRemaining, spitzerBalance(inp.loanAmount, inp.loanRate, inp.loanTerm, kl), 2), "loan balance (closed form)", ctx);
  } else {
    check(re.extraLoanPrincipal === 0 && re.extraLoanRemaining === 0, "no loan when disabled", ctx);
  }

  // 4b. Month-1 cash flow, computed independently
  const expNet = expectedNetRent(re.propertyPrice, inp.rentalYield);
  check(near(re.initialMonthlyRentNet, expNet, 0.01), "month-1 net rent (independent)", ctx);
  const expPmt = spitzerPayment(re.loanAmount, inp.mortgageRate, inp.mortgageTerm);
  const expLoanPmt = inp.loanEnabled ? spitzerPayment(inp.loanAmount, inp.loanRate, inp.loanTerm) : 0;
  check(near(re.initialMonthlyGap, expPmt + expLoanPmt - expNet, 0.01), "month-1 gap = mortgage + loan − net rent", ctx);

  // 5. Year 0 values
  const p0 = r.points[0];
  const re0 = inp.equity - re.purchaseTax - re.closingCosts - re.propertyPrice * sellingCostRate(inp.useBroker);
  check(near(p0.realEstate, re0, 1), "year 0: apartment = equity − tax − buy/sell costs", ctx);
  check(near(p0.sp500, inp.equity, 0.01), "year 0: S&P = equity", ctx);
  check(r.points.length === inp.years + 1, "one point per year", ctx);

  // 6. Fairness: with matching, both tracks invest the same own cash
  if (inp.cashflowMatching) check(near(re.totalCashInvested, sp.totalCashInvested, 1), "matching → equal cash invested", ctx);
  else check(sp.monthlyContributionsTotal === 0, "no matching → no S&P contributions", ctx);

  // 7. Taxes
  check(re.totalRentTax <= 0.1 * (re.totalRentGross - re.totalVacancyLoss) + 0.01, "rent tax ≤ 10% of rent collected", ctx);
  check(re.shevachTax >= 0 && re.surtax >= 0 && sp.surtax >= 0 && sp.capitalGainsTax >= 0, "taxes non-negative", ctx);
  const ceil = SHEVACH_SINGLE_CEILING * Math.pow(1 + inp.inflation / 100, Math.max(0, inp.years - 1));
  if (inp.apartmentType !== "additional") {
    if (re.finalPropertyValue <= ceil) check(re.shevachTax === 0 && re.shevachExempt, "sole apt under ceiling → exempt", ctx);
    else check(re.shevachPartial, "sole apt over ceiling → partial", ctx);
  } else {
    check(!re.shevachExempt, "additional apt never exempt", ctx);
  }
  const nominalGain = Math.max(0, re.finalPropertyValue - re.sellingCosts - re.propertyPrice - re.purchaseTax - re.closingCosts);
  check(re.shevachTax <= CAPITAL_GAINS_TAX_RATE * nominalGain + 0.01, "מס שבח ≤ 25% of nominal gain", ctx);
  check(sp.capitalGainsTax <= CAPITAL_GAINS_TAX_RATE * Math.max(0, sp.grossValue - sp.totalCashInvested) + 0.01 || inp.spVehicle === "irish", "S&P tax ≤ 25% of nominal gain (Israeli fund)", ctx);
  if (inp.spVehicle === "irish") {
    check(near(sp.capitalGainsTax, CAPITAL_GAINS_TAX_RATE * Math.max(0, sp.grossValue - sp.totalCashInvested), 1), "Irish ETF: 25% of nominal gain", ctx);
  }
  const thr = SURTAX_THRESHOLD * Math.pow(1 + inp.inflation / 100, Math.max(0, inp.years - 1));
  if (sp.capitalGainsTax / CAPITAL_GAINS_TAX_RATE <= thr) check(sp.surtax === 0, "no S&P surtax below threshold", ctx);

  // 8. S&P without matching: closed form
  if (!inp.cashflowMatching) {
    const drag = inp.spVehicle === "israeli" ? 0.0025 : 0.0019;
    const annual = (1 + inp.spReturn / 100) * (1 - inp.spFee / 100) - 1 - drag;
    const expected = inp.equity * Math.pow(1 + annual, inp.years);
    check(near(sp.grossValue, expected, Math.max(1, expected * 1e-9)), "S&P value (closed form, no matching)", ctx);
  }

  // 9. Net worth identity at the end
  const reNet =
    re.finalPropertyValue - re.sellingCosts - re.remainingMortgage - re.extraLoanRemaining - re.shevachTax - re.surtax +
    re.sideFundValue - re.sideFundTax + re.idleCash;
  check(near(reNet, re.netWorth, 1), "apartment net worth identity", ctx);
  check(near(sp.grossValue - sp.capitalGainsTax - sp.surtax, sp.netWorth, 1), "S&P net worth identity", ctx);

  // 10. Winner / crossovers consistent
  const d = re.netWorth - sp.netWorth;
  const w = Math.abs(d) < 1000 ? "tie" : d > 0 ? "realEstate" : "sp500";
  check(r.winner === w && near(r.difference, Math.abs(d), 0.01), "winner consistent", ctx);
  for (const c of r.crossovers) {
    const i = r.points.findIndex((p) => p.year === c.year);
    check(i > 0 && Math.sign(r.points[i].diff) !== Math.sign(r.points[i - 1].diff), "crossover is a real sign change", ctx);
  }
}

// --- Full matrix -------------------------------------------------------------
let scenarios = 0;
for (const apartmentType of TYPES)
  for (const useBroker of BOOLS)
    for (const spVehicle of VEHICLES)
      for (const cashflowMatching of BOOLS)
        for (const loanEnabled of BOOLS)
          for (const autoPrice of BOOLS)
            for (const equity of EQUITY)
              for (const years of YEARS)
                for (const [, market] of Object.entries(MARKETS)) {
                  const inp: SimInputs = {
                    ...DEFAULT_INPUTS,
                    ...market,
                    apartmentType,
                    useBroker,
                    spVehicle,
                    cashflowMatching,
                    loanEnabled,
                    autoPrice,
                    equity,
                    years,
                    mortgageTerm: years === 30 ? 20 : 25, // also cover "mortgage paid off before the end"
                  };
                  const r = simulate(inp);
                  checkScenario(r.inputs, r);
                  scenarios++;
                }

// --- Monotonicity (one input changes, all else fixed, price below every cap) --
const base: SimInputs = { ...DEFAULT_INPUTS, equity: 1_500_000, propertyPrice: 1_500_000 };
function mono(rule: string, key: keyof SimInputs, lo: number, hi: number, pick: (r: SimResult) => number, dir: 1 | -1) {
  for (const apartmentType of TYPES)
    for (const cashflowMatching of BOOLS) {
      const a = pick(simulate({ ...base, apartmentType, cashflowMatching, [key]: lo }));
      const b = pick(simulate({ ...base, apartmentType, cashflowMatching, [key]: hi }));
      check(dir * (b - a) > 0, rule, () => `${apartmentType} matching=${cashflowMatching} ${key}: ${lo}→${hi}: ${a.toFixed(0)}→${b.toFixed(0)}`);
    }
}
mono("higher appreciation → apartment worth more", "appreciation", 2, 6, (r) => r.realEstate.netWorth, 1);
mono("higher rent → apartment worth more", "rentalYield", 2.5, 4.5, (r) => r.realEstate.netWorth, 1);
mono("higher mortgage rate → apartment worth less", "mortgageRate", 3, 7, (r) => r.realEstate.netWorth, -1);
mono("higher S&P return → S&P worth more", "spReturn", 6, 11, (r) => r.sp500.netWorth, 1);
mono("higher fee → S&P worth less", "spFee", 0.05, 1, (r) => r.sp500.netWorth, -1);
for (const apartmentType of TYPES) {
  const withB = simulate({ ...base, apartmentType, useBroker: true }).realEstate.netWorth;
  const noB = simulate({ ...base, apartmentType, useBroker: false }).realEstate.netWorth;
  check(noB > withB, "no broker → apartment worth more", () => apartmentType);
}
const upg = simulate({ ...base, apartmentType: "upgrader" }).realEstate;
const add = simulate({ ...base, apartmentType: "additional" }).realEstate;
check(upg.purchaseTax < add.purchaseTax && upg.netWorth > add.netWorth, "upgrader beats investor at same price (lower tax, exempt sale)", () => "");

// --- Report -------------------------------------------------------------------
console.log(`Scenarios: ${scenarios} · checks: ${checks.toLocaleString()}`);
if (failures.size) {
  for (const [rule, f] of failures) console.error(`FAIL ×${f.count}: ${rule}\n   e.g. ${f.example}`);
  process.exit(1);
}
console.log("All scenario checks passed");
