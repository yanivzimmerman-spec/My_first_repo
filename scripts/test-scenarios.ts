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

/** Independent: own money at the start = cash + (upgrader) old home price − 2.95%/0.59% fees − its mortgage. */
function expectedStart(inp: SimInputs): number {
  if (inp.apartmentType !== "upgrader") return inp.equity;
  const fee = (inp.useBroker ? 0.025 : 0.005) * 1.18;
  const mortgage = Math.min(inp.oldHomeMortgage, inp.oldHomeValue);
  const prepay = mortgage > 0 ? inp.oldHomePrepayFee : 0;
  return inp.equity + Math.max(0, inp.oldHomeValue * (1 - fee) - mortgage - prepay);
}

/** Independent month-1 rent after vacancy, rent tax (cheaper track), 8% maintenance, ₪150 insurance. */
function rentTaxOf(collected: number, ownRent = 0): number {
  if (collected <= RENT_CEILING) return 0;
  const exempt = Math.max(0, Math.min(RENT_CEILING, 2 * RENT_CEILING - collected));
  const deduction = Math.min(ownRent, 7_500); // s.122(f): up to ₪90K a year
  return Math.min(0.1 * Math.max(0, collected - deduction), 0.1 * (collected - exempt));
}

/**
 * Independent month-1 net rent. oldCollected > 0: another apartment's rent already uses the
 * household ceiling, so the tax is the extra. `owner` holds the month-1 owner costs that don't
 * depend on rent: capex on the new apartment's value and insurance (building + life on the loan).
 */
function expectedNetRent(
  price: number,
  yieldPct: number,
  ownRent: number | "auto",
  living: boolean,
  oldCollected: number,
  owner: { capexAndInsurance: number; vacancyCost: number; managementPct: number },
): number {
  const gross = (price * yieldPct) / 100 / 12;
  if (living) return gross - 0.08 * gross - owner.capexAndInsurance; // saved rent: no vacancy, no tax
  const collected = (gross * 11) / 12;
  const deduction = ownRent === "auto" ? gross : ownRent;
  const tax = oldCollected > 0 ? rentTaxOf(oldCollected + collected) - rentTaxOf(oldCollected) : rentTaxOf(collected, deduction);
  const costs = 0.08 * collected + owner.vacancyCost / 12 + (collected * owner.managementPct) / 100 + owner.capexAndInsurance;
  return collected - tax - costs;
}

/** Closed-form mortgage over its tracks: fixed, variable (rate shift from month 13), CPI-linked. */
function mortgageTracks(inp: SimInputs, L: number) {
  const iM = Math.pow(1 + inp.inflation / 100, 1 / 12) - 1;
  const cpiL = (L * inp.cpiShare) / 100;
  const varL = (L * inp.variableShare) / 100;
  const fixL = L - cpiL - varL;
  const n = inp.mortgageTerm;
  const v12 = spitzerBalance(varL, inp.mortgageRate, n, 12);
  const shocked = inp.rateShock !== 0 && varL > 0;
  const r1 = Math.max(0.1, inp.mortgageRate + inp.rateShock);
  const balance = (k: number) =>
    spitzerBalance(fixL, inp.mortgageRate, n, k) +
    (!shocked || k <= 12 ? spitzerBalance(varL, inp.mortgageRate, n, k) : spitzerBalance(v12, r1, n - 1, k - 12)) +
    spitzerBalance(cpiL, inp.cpiRealRate, n, k) * Math.pow(1 + iM, k);
  const firstPayment =
    spitzerPayment(fixL, inp.mortgageRate, n) + spitzerPayment(varL, inp.mortgageRate, n) + spitzerPayment(cpiL, inp.cpiRealRate, n) * (1 + iM);
  return { balance, firstPayment };
}

const TYPES: ApartmentType[] = ["single", "upgrader", "additional"];
const VEHICLES: SpVehicle[] = ["israeli", "irish"];
const BOOLS = [false, true];
const EQUITY = [0, 200_000, 350_000, 600_000, 1_500_000, 3_000_000]; // 0 → raised to the ₪200K minimum
const YEARS = [5, 15, 30];
// Upgrader: cheap home fully mortgaged (no proceeds, cash topped up to ₪200K), mid home, expensive home above the exemption ceiling
const OLD_HOMES: Partial<SimInputs>[] = [
  { oldHomeValue: 600_000, oldHomeMortgage: 600_000, sellFirst: true },
  { oldHomeValue: 2_000_000, oldHomeMortgage: 500_000, oldHomePrepayFee: 15_000, sellFirst: false },
  { oldHomeValue: 6_000_000, oldHomeMortgage: 0, oldHomePrepayFee: 50_000, sellFirst: true },
  // buy first with the old mortgage above 50% of its value → no bridge possible
  { oldHomeValue: 2_000_000, oldHomeMortgage: 1_500_000, sellFirst: false },
];
const MARKETS: Record<string, Partial<SimInputs>> = {
  low: { autoRate: false, cpiShare: 35, variableShare: 30, rateShock: 2, mortgageRate: 2.5, rentalYield: 2.2, rentGrowth: 1, appreciation: 1, spReturn: 5, spFee: 0.05, inflation: 1 },
  base: {},
  high: { autoRate: false, managementFee: 8, monthsToSell: 4, ageDrag: 0.3, depreciation: true, urbanRenewal: true, renewalYear: 4, fxDrift: -1.5, capexRate: 1, mortgageRate: 7.5, rentalYield: 4.5, rentGrowth: 5, appreciation: 7, spReturn: 12, spFee: 0.5, inflation: 4, ownRentAuto: false, ownRentPaid: 9_000 },
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

/** Old apartment's rent collected over the horizon (live-elsewhere mode). */
function sumOldRent(inp: SimInputs): number {
  let t = 0;
  for (let m = 1; m <= inp.years * 12; m++) {
    const y = Math.floor((m - 1) / 12);
    t += ((inp.oldHomeValue * inp.rentalYield) / 1200) * Math.pow(1 + inp.rentGrowth / 100, y) * (11 / 12);
  }
  return t;
}

/** Total S&P loan payments made within the horizon. */
function sumSpLoanPayments(inp: SimInputs, months: number): number {
  if (!inp.spLoanEnabled) return 0;
  const pmt = spitzerPayment(inp.spLoanAmount, inp.spLoanRate, inp.spLoanTerm);
  const k = Math.min(months, inp.spLoanTerm * 12);
  // last payment may be slightly smaller; principal identity: paid = principal − balance + interest
  return pmt * k;
}

function checkScenario(inp: SimInputs, r: SimResult) {
  const re = r.realEstate;
  const sp = r.sp500;
  const ctx = () => JSON.stringify(inp);
  const start = expectedStart(inp);
  check(near(re.startCapital, start, 0.01) && near(sp.initialInvestment, start, 0.01), "start capital = cash + net old-home proceeds", ctx);
  check(start >= 200_000 - 0.01, "start capital ≥ ₪200K", ctx);
  check(inp.equity + re.oldHomeUsableAtPurchase >= 200_000 - 0.01, "money usable on purchase day ≥ ₪200K", ctx);
  // Buy-first upgrader: only a bridge loan on the old home (all loans on it ≤ 50% of its value) before the sale
  const oldNet = start - inp.equity;
  const usableOld =
    inp.apartmentType === "upgrader" && !inp.sellFirst
      ? Math.min(oldNet, Math.max(0, 0.5 * inp.oldHomeValue - Math.min(inp.oldHomeMortgage, inp.oldHomeValue)))
      : oldNet;
  const later = oldNet - usableOld;
  const cash = inp.equity + usableOld + (inp.loanEnabled ? inp.loanAmount : 0);
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
  const limit = inp.apartmentType === "upgrader" && inp.sellFirst ? MAX_LTV.single : MAX_LTV[inp.apartmentType];
  check(re.ltv <= limit + 1e-9 && re.maxLtv === limit, "LTV within bank limit (upgrader selling first → 75%)", ctx);
  check(re.propertyPrice <= re.maxPrice && re.propertyPrice >= BOUNDS.propertyPrice.min, "price within cap and bounds", ctx);
  check(re.maxPrice === maxAffordablePrice(cash, inp.apartmentType, inp.useBroker, inp.sellFirst), "max price recomputes", ctx);
  check(!re.equityShortfall, "cash covers tax + costs + down payment", ctx);
  if (inp.autoPrice) check(re.propertyPrice === re.maxPrice, "auto mode uses max price", ctx);
  else check(re.propertyPrice === Math.min(inp.propertyPrice, re.maxPrice), "manual price respected unless capped", ctx);

  // 3. Upfront cash conservation
  const unused = Math.max(0, cash - re.purchaseTax - re.closingCosts - re.propertyPrice);
  check(near(re.downPayment + re.purchaseTax + re.closingCosts + unused, cash, 0.01), "upfront cash adds up", ctx);
  check(near(re.oldHomeUsableAtPurchase, usableOld, 0.01) && later >= -0.01, "buy first: only the bridge is usable before the sale", ctx);
  check(near(re.loanAmount, re.propertyPrice - re.downPayment, 0.01), "mortgage = price − down payment", ctx);
  check(near(re.purchaseTax, purchaseTax(re.propertyPrice, inp.apartmentType), 0.01), "purchase tax by type", ctx);
  check(near(re.closingCosts, buyingCosts(re.propertyPrice, inp.useBroker), 0.01), "buying costs", ctx);

  // 4. Mortgage and loan balances match closed form
  const k = Math.min(months, inp.mortgageTerm * 12);
  const tracks = mortgageTracks(inp, re.loanAmount);
  check(near(re.remainingMortgage, tracks.balance(k), 2), "mortgage balance over its tracks (closed form)", ctx);
  if (inp.autoRate) check(inp.mortgageRate === Math.round((4.3 + 0.03 * (inp.mortgageTerm - 10)) * 20) / 20, "auto rate follows the term rule", ctx);
  if (inp.loanEnabled) {
    const kl = Math.min(months, inp.loanTerm * 12);
    check(near(re.extraLoanRemaining, spitzerBalance(inp.loanAmount, inp.loanRate, inp.loanTerm, kl), 2), "loan balance (closed form)", ctx);
  } else {
    check(re.extraLoanPrincipal === 0 && re.extraLoanRemaining === 0, "no loan when disabled", ctx);
  }

  // 4b. Month-1 cash flow, computed independently
  const living = inp.liveInNew && inp.apartmentType !== "additional";
  check(re.livesInNew === living, "living in only for a sole apartment", ctx);
  const both = inp.liveElsewhere && inp.apartmentType === "additional";
  const rentOld = inp.liveInNew && inp.apartmentType === "additional" && !both;
  check(re.rentsOutOld === rentOld, "additional + move in → the old apartment is rented out", ctx);
  check(re.rentsOutBoth === both, "additional + live elsewhere → both apartments rented out", ctx);
  const rentBase = rentOld ? inp.oldHomeValue : re.propertyPrice;
  const oldCollected = both ? ((inp.oldHomeValue * inp.rentalYield) / 1200) * (11 / 12) : 0;
  const value1 = re.propertyPrice * Math.pow(1 + (inp.appreciation - inp.ageDrag) / 100, 1 / 12);
  const owner = {
    capexAndInsurance: ((inp.capexRate / 100) * value1) / 12 + 50 + (100 * re.loanAmount) / 1e6,
    vacancyCost: inp.vacancyOwnerCost,
    managementPct: inp.managementFee,
  };
  const ownRent = inp.apartmentType === "additional" ? 0 : inp.ownRentAuto ? ("auto" as const) : inp.ownRentPaid;
  const expNet = expectedNetRent(rentBase, inp.rentalYield, ownRent, living, oldCollected, owner);
  check(near(re.initialMonthlyRentNet, expNet, 0.01), "month-1 net rent (independent)", ctx);
  const expPmt = tracks.firstPayment;
  const expLoanPmt = inp.loanEnabled ? spitzerPayment(inp.loanAmount, inp.loanRate, inp.loanTerm) : 0;
  check(near(re.initialMonthlyGap, expPmt + expLoanPmt - expNet, 0.01), "month-1 gap = mortgage + loan − net rent", ctx);

  // 4c. S&P loan balance (closed form) and month-1 matching deposits
  if (inp.spLoanEnabled) {
    const ks = Math.min(months, inp.spLoanTerm * 12);
    check(near(sp.loanRemaining, spitzerBalance(inp.spLoanAmount, inp.spLoanRate, inp.spLoanTerm, ks), 2), "S&P loan balance (closed form)", ctx);
  } else {
    check(sp.loanPrincipal === 0 && sp.loanRemaining === 0, "no S&P loan when disabled", ctx);
  }
  const spOut = inp.spLoanEnabled ? spitzerPayment(inp.spLoanAmount, inp.spLoanRate, inp.spLoanTerm) : 0;
  const reOut = expPmt + expLoanPmt - expNet;
  if (inp.cashflowMatching) {
    const own = Math.max(reOut, spOut);
    check(near(re.initialMonthlyOwn, own, 0.01), "month-1 own money = max(apartment outflow, S&P loan payment)", ctx);
    check(near(sp.initialDeposit, own - spOut, 0.01) && near(re.initialSideDeposit, own - reOut, 0.01), "month-1 matching deposits", ctx);
  } else {
    check(sp.initialDeposit === 0 && re.initialSideDeposit === 0, "no matching → no deposits", ctx);
  }

  // 5. Year 0 values
  const p0 = r.points[0];
  const sellDelay0 =
    !living && !rentOld ? inp.monthsToSell * ((re.propertyPrice * inp.rentalYield) / 1200 + inp.vacancyOwnerCost) : 0;
  const re0 = start - re.purchaseTax - re.closingCosts - re.propertyPrice * sellingCostRate(inp.useBroker) - sellDelay0;
  check(near(p0.realEstate, re0, 1), "year 0: apartment = equity − tax − buy/sell costs", ctx);
  check(near(p0.sp500, start, 0.01), "year 0: S&P = start capital", ctx);
  check(r.points.length === inp.years + 1, "one point per year", ctx);

  // 6. Fairness: with matching, both tracks invest the same own cash
  if (inp.cashflowMatching) check(near(re.totalCashInvested, sp.totalCashInvested, 1), "matching → equal cash invested", ctx);
  else if (!inp.spLoanEnabled) check(sp.monthlyContributionsTotal === 0, "no matching → no S&P contributions", ctx);

  // 7. Taxes
  // Living elsewhere with two rentals: the extra tax can exceed 10% of the new rent (it also ends the old
  // rent's exemption), but never 10% of the household's total rent.
  const oldRentTotal = re.rentsOutBoth ? sumOldRent(inp) : 0;
  check(re.totalRentTax <= 0.1 * (re.totalRentGross - re.totalVacancyLoss + oldRentTotal) + 0.01, "rent tax ≤ 10% of the household's rent", ctx);
  check(re.shevachTax >= 0 && re.surtax >= 0 && sp.surtax >= 0 && sp.capitalGainsTax >= 0, "taxes non-negative", ctx);
  const ceil = SHEVACH_SINGLE_CEILING * Math.pow(1 + inp.inflation / 100, Math.max(0, inp.years - 1));
  if (inp.apartmentType !== "additional") {
    if (re.finalPropertyValue <= ceil) check(re.shevachTax === 0 && re.shevachExempt, "sole apt under ceiling → exempt", ctx);
    else check(re.shevachPartial, "sole apt over ceiling → partial", ctx);
  } else {
    check(!re.shevachExempt, "additional apt never exempt", ctx);
  }
  // Notional depreciation lowers the cost basis, so it can push the taxed gain above the nominal gain
  const nominalGain = Math.max(
    0,
    re.finalPropertyValue - re.sellingCosts - re.renewalLevy - re.propertyPrice - re.purchaseTax - re.closingCosts + re.depreciationDeducted,
  );
  check(re.shevachTax <= CAPITAL_GAINS_TAX_RATE * nominalGain + 0.01, "מס שבח ≤ 25% of nominal gain (+ notional depreciation)", ctx);
  check(re.depreciationDeducted === 0 || (inp.depreciation && inp.apartmentType === "additional"), "depreciation only for an additional apartment, when chosen", ctx);
  // Cost basis = own money + borrowed money invested + matching deposits
  const spBasisNominal = start + sp.loanPrincipal + (inp.cashflowMatching ? sp.monthlyContributionsTotal - sumSpLoanPayments(inp, months) : 0);
  check(sp.capitalGainsTax <= CAPITAL_GAINS_TAX_RATE * Math.max(0, sp.grossValue - spBasisNominal) + 0.01 || inp.spVehicle === "irish", "S&P tax ≤ 25% of nominal gain (Israeli fund)", ctx);
  if (inp.spVehicle === "irish" && !inp.cashflowMatching && !inp.spLoanEnabled) {
    // Irish ETF: the cost basis follows the dollar (section 88)
    const basisUsd = start * Math.pow(1 + inp.fxDrift / 100, inp.years);
    check(near(sp.capitalGainsTax, CAPITAL_GAINS_TAX_RATE * Math.max(0, sp.grossValue - basisUsd), 1), "Irish ETF: 25% of the gain over a dollar-indexed basis", ctx);
  }
  const thr = SURTAX_THRESHOLD * Math.pow(1 + inp.inflation / 100, Math.max(0, inp.years - 1));
  if (sp.capitalGainsTax / CAPITAL_GAINS_TAX_RATE <= thr) check(sp.surtax === 0, "no S&P surtax below threshold", ctx);

  // 8. S&P without matching: closed form
  if (!inp.cashflowMatching && !inp.spLoanEnabled) {
    const drag = inp.spVehicle === "israeli" ? 0.0032 : 0.0019;
    const annual = (1 + inp.spReturn / 100) * (1 + inp.fxDrift / 100) * (1 - inp.spFee / 100) - 1 - drag;
    const expected = start * Math.pow(1 + annual, inp.years);
    check(near(sp.grossValue, expected, Math.max(1, expected * 1e-9)), "S&P value (closed form, no matching)", ctx);
  }

  // 9. Net worth identity at the end
  const reNet =
    re.finalPropertyValue - re.sellingCosts - re.renewalLevy - re.sellDelayCost - re.remainingMortgage - re.extraLoanRemaining - re.shevachTax - re.surtax +
    re.sideFundValue - re.sideFundTax + re.idleCash;
  check(near(reNet, re.netWorth, 1), "apartment net worth identity", ctx);
  check(near(sp.grossValue - sp.capitalGainsTax - sp.surtax - sp.loanRemaining, sp.netWorth, 1), "S&P net worth identity", ctx);

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
         for (const spLoanEnabled of BOOLS)
          for (const autoPrice of BOOLS)
            for (const equity of EQUITY)
              for (const years of YEARS)
                for (const [, market] of Object.entries(MARKETS))
                 for (const oldHome of apartmentType === "upgrader" ? OLD_HOMES : [{}])
                  for (const liveInNew of BOOLS)
                   for (const liveElsewhere of apartmentType === "additional" ? BOOLS : [false]) {
                  const inp: SimInputs = {
                    ...DEFAULT_INPUTS,
                    ...market,
                    apartmentType,
                    useBroker,
                    spVehicle,
                    cashflowMatching,
                    loanEnabled,
                    spLoanEnabled,
                    autoPrice,
                    equity,
                    years,
                    mortgageTerm: years === 30 ? 20 : 25, // also cover "mortgage paid off before the end"
                    ...oldHome,
                    liveInNew,
                    liveElsewhere,
                  };
                  const r = simulate(inp);
                  checkScenario(r.inputs, r);
                  scenarios++;
                }

// --- Monotonicity (one input changes, all else fixed, price below every cap) --
// Old home fully mortgaged → no proceeds, so every type starts with the same ₪1.5M.
const base: SimInputs = { ...DEFAULT_INPUTS, autoRate: false, equity: 1_500_000, propertyPrice: 1_500_000, oldHomeValue: 600_000, oldHomeMortgage: 600_000 };
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
