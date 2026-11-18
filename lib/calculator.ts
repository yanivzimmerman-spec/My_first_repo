/**
 * Real Estate vs. S&P 500 — Israeli "What-If" calculation engine.
 *
 * Pure, synchronous, dependency-free. Runs month-by-month and snapshots a
 * full after-tax liquidation value at the end of every year, so each chart
 * point answers: "if I sold everything at the end of year t, what would I
 * have in my pocket?"
 *
 * All rates in SimInputs are given in PERCENT (e.g. 4.8 = 4.8%).
 */

// ---------------------------------------------------------------------------
// Constants (Israeli tax rules, 2025 brackets — frozen through 2027)
// ---------------------------------------------------------------------------

/** מס רכישה — דירה יחידה (brackets: [upper bound, rate]) */
export const PURCHASE_TAX_FIRST: ReadonlyArray<readonly [number, number]> = [
  [1_978_745, 0],
  [2_347_040, 0.035],
  [6_055_070, 0.05],
  [20_183_565, 0.08],
  [Infinity, 0.1],
];

/** מס רכישה — דירה נוספת: 8% from the first shekel, 10% above the top bracket */
export const PURCHASE_TAX_ADDITIONAL: ReadonlyArray<readonly [number, number]> = [
  [6_055_070, 0.08],
  [Infinity, 0.1],
];

/** עו״ד, תיווך, שמאי, יועץ משכנתאות */
export const CLOSING_COSTS_RATE = 0.02;
/** עמלת תיווך + עו״ד במכירה */
export const SELLING_COSTS_RATE = 0.01;
/** תקרת פטור חודשית במסלול הפטור על שכר דירה (2025), צמודה למדד */
export const RENT_EXEMPT_CEILING_MONTHLY = 5_654;
/** מסלול 10% על הכנסות שכירות */
export const RENT_FLAT_TAX_RATE = 0.1;
/** מס רווחי הון / מס שבח ריאלי */
export const CAPITAL_GAINS_TAX_RATE = 0.25;
/** דירה יחידה פטורה ממס שבח לאחר 18 חודשי החזקה */
export const SHEVACH_EXEMPT_MONTHS = 18;
/** יחס מימון מקסימלי לפי בנק ישראל */
export const MAX_LTV_FIRST = 0.75;
export const MAX_LTV_ADDITIONAL = 0.5;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

export interface SimInputs {
  equity: number;
  years: number;
  propertyPrice: number;
  autoPrice: boolean;
  isFirstApartment: boolean;
  mortgageRate: number;
  mortgageTerm: number;
  rentalYield: number;
  appreciation: number;
  spReturn: number;
  spFee: number;
  cashflowMatching: boolean;
  inflation: number;
}

type NumericKey = {
  [K in keyof SimInputs]: SimInputs[K] extends number ? K : never;
}[keyof SimInputs];

export interface Bound {
  min: number;
  max: number;
  step: number;
}

export const BOUNDS: Record<NumericKey, Bound> = {
  equity: { min: 200_000, max: 3_000_000, step: 10_000 },
  years: { min: 5, max: 30, step: 1 },
  propertyPrice: { min: 500_000, max: 5_000_000, step: 10_000 },
  mortgageRate: { min: 1, max: 9, step: 0.05 },
  mortgageTerm: { min: 5, max: 30, step: 1 },
  rentalYield: { min: 1, max: 7, step: 0.05 },
  appreciation: { min: -2, max: 10, step: 0.1 },
  spReturn: { min: 0, max: 15, step: 0.1 },
  spFee: { min: 0, max: 2, step: 0.01 },
  inflation: { min: 0, max: 6, step: 0.1 },
};

export const DEFAULT_INPUTS: SimInputs = {
  equity: 600_000,
  years: 15,
  propertyPrice: 2_000_000,
  autoPrice: false,
  isFirstApartment: true,
  mortgageRate: 4.8,
  mortgageTerm: 25,
  rentalYield: 3.2,
  appreciation: 4.0,
  spReturn: 9.5,
  spFee: 0.15,
  cashflowMatching: true,
  inflation: 2.5,
};

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export interface YearPoint {
  year: number;
  /** שווי נטו במסלול הנדל״ן אחרי מכירה, סילוק משכנתא ומסים */
  realEstate: number;
  /** שווי נטו במסלול ה-S&P אחרי מס רווחי הון */
  sp500: number;
  propertyValue: number;
  mortgageBalance: number;
  /** realEstate - sp500 */
  diff: number;
}

export interface RealEstateSummary {
  propertyPrice: number;
  purchaseTax: number;
  closingCosts: number;
  downPayment: number;
  loanAmount: number;
  ltv: number;
  maxLtv: number;
  ltvExceeded: boolean;
  /** Equity doesn't even cover purchase tax + closing costs */
  equityShortfall: boolean;
  monthlyMortgagePayment: number;
  initialMonthlyRentGross: number;
  initialMonthlyRentNet: number;
  /** Mortgage payment − net rent in month 1 (positive = out of pocket) */
  initialMonthlyGap: number;
  totalCashInvested: number;
  outOfPocketContributions: number;
  totalInterestPaid: number;
  totalRentGross: number;
  totalRentTax: number;
  finalPropertyValue: number;
  remainingMortgage: number;
  sellingCosts: number;
  shevachTax: number;
  shevachExempt: boolean;
  /** Rent surpluses (and any unused equity) invested in an index fund */
  sideFundValue: number;
  sideFundTax: number;
  /** Rent surpluses kept as cash when matching is off */
  idleCash: number;
  grossValue: number;
  grossGain: number;
  netWorth: number;
  totalReturnPct: number;
}

export interface SP500Summary {
  initialInvestment: number;
  monthlyContributionsTotal: number;
  totalCashInvested: number;
  grossValue: number;
  grossGain: number;
  capitalGainsTax: number;
  netWorth: number;
  totalReturnPct: number;
  netAnnualReturn: number;
}

export interface Crossover {
  year: number;
  leader: "realEstate" | "sp500";
}

export interface SimResult {
  inputs: SimInputs;
  points: YearPoint[];
  realEstate: RealEstateSummary;
  sp500: SP500Summary;
  winner: "realEstate" | "sp500" | "tie";
  difference: number;
  crossovers: Crossover[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function safeNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce arbitrary (possibly URL-sourced) input into a valid SimInputs. */
export function sanitizeInputs(raw: Partial<Record<keyof SimInputs, unknown>>): SimInputs {
  const out = { ...DEFAULT_INPUTS };
  (Object.keys(BOUNDS) as NumericKey[]).forEach((k) => {
    const b = BOUNDS[k];
    out[k] = clamp(safeNum(raw[k], DEFAULT_INPUTS[k]), b.min, b.max);
  });
  out.years = Math.round(out.years);
  out.mortgageTerm = Math.round(out.mortgageTerm);
  const bool = (v: unknown, d: boolean) =>
    typeof v === "boolean" ? v : v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : d;
  out.autoPrice = bool(raw.autoPrice, DEFAULT_INPUTS.autoPrice);
  out.isFirstApartment = bool(raw.isFirstApartment, DEFAULT_INPUTS.isFirstApartment);
  out.cashflowMatching = bool(raw.cashflowMatching, DEFAULT_INPUTS.cashflowMatching);
  return out;
}

/** Progressive bracket tax. */
export function bracketTax(amount: number, brackets: ReadonlyArray<readonly [number, number]>): number {
  if (!(amount > 0)) return 0;
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of brackets) {
    if (amount <= lower) break;
    tax += (Math.min(amount, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

export function purchaseTax(price: number, isFirstApartment: boolean): number {
  return bracketTax(price, isFirstApartment ? PURCHASE_TAX_FIRST : PURCHASE_TAX_ADDITIONAL);
}

/** Spitzer (annuity) monthly payment. Handles a 0% rate. */
export function spitzerPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.max(1, Math.round(years * 12));
  if (!(principal > 0)) return 0;
  const i = annualRatePct / 100 / 12;
  if (Math.abs(i) < 1e-12) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/** Auto price = equity / 25% down, rounded to ₪10K and kept inside the slider bounds. */
export function autoPropertyPrice(equity: number): number {
  const b = BOUNDS.propertyPrice;
  return clamp(Math.round(equity / 0.25 / 10_000) * 10_000, b.min, b.max);
}

export function effectivePropertyPrice(inputs: SimInputs): number {
  return inputs.autoPrice ? autoPropertyPrice(inputs.equity) : inputs.propertyPrice;
}

/** After-tax value of an index-fund position with an inflation-indexed cost basis. */
function afterRealGainsTax(value: number, indexedBasis: number): { net: number; tax: number } {
  const tax = CAPITAL_GAINS_TAX_RATE * Math.max(0, value - indexedBasis);
  return { net: value - tax, tax };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function simulate(rawInputs: Partial<SimInputs>): SimResult {
  const inputs = sanitizeInputs(rawInputs);
  const {
    equity,
    years,
    isFirstApartment,
    mortgageRate,
    mortgageTerm,
    rentalYield,
    appreciation,
    spReturn,
    spFee,
    cashflowMatching,
    inflation,
  } = inputs;

  const price = effectivePropertyPrice(inputs);
  const totalMonths = years * 12;

  // --- Monthly rates -------------------------------------------------------
  const inflMonthly = Math.pow(1 + inflation / 100, 1 / 12) - 1;
  const spNetAnnual = Math.max(-0.99, (1 + spReturn / 100) * (1 - spFee / 100) - 1);
  const spMonthly = Math.pow(1 + spNetAnnual, 1 / 12) - 1;
  const mortMonthly = mortgageRate / 100 / 12;
  const g = appreciation / 100;

  // --- Upfront real-estate costs -------------------------------------------
  const pTax = purchaseTax(price, isFirstApartment);
  const closing = price * CLOSING_COSTS_RATE;
  const downPaymentRaw = equity - pTax - closing;
  const equityShortfall = downPaymentRaw <= 0;
  const downPayment = Math.max(0, Math.min(price, downPaymentRaw));
  // If equity can't cover costs the shortfall is (unrealistically) financed —
  // flagged in the UI, but the math stays consistent: cash out == equity.
  const loanAmount = Math.max(0, price - downPaymentRaw);
  const unusedEquity = Math.max(0, downPaymentRaw - price);
  const maxLtv = isFirstApartment ? MAX_LTV_FIRST : MAX_LTV_ADDITIONAL;
  const ltv = price > 0 ? loanAmount / price : 0;
  const pmt = spitzerPayment(loanAmount, mortgageRate, mortgageTerm);
  const termMonths = mortgageTerm * 12;
  const costBasis = price + pTax + closing;

  // --- State ---------------------------------------------------------------
  let balance = loanAmount;
  let sp = equity;
  let spBasis = equity; // inflation-indexed cost basis
  let spContrib = 0;
  let side = unusedEquity; // RE-track index fund for rent surpluses
  let sideBasis = unusedEquity;
  let idleCash = 0;
  let outOfPocket = 0;
  let interestPaid = 0;
  let rentGrossTotal = 0;
  let rentTaxTotal = 0;
  let initialRentGross = 0;
  let initialRentNet = 0;
  let initialGap = 0;

  const snapshot = (month: number): YearPoint & {
    sellCosts: number;
    shevach: number;
    shevachExempt: boolean;
    sideTax: number;
    sideNet: number;
    spTax: number;
  } => {
    const t = month / 12;
    const propertyValue = price * Math.pow(1 + g, t);
    const sellCosts = propertyValue * SELLING_COSTS_RATE;
    const shevachExempt = isFirstApartment && month >= SHEVACH_EXEMPT_MONTHS;
    const realGain = propertyValue - sellCosts - costBasis * Math.pow(1 + inflMonthly, month);
    const shevach = shevachExempt ? 0 : CAPITAL_GAINS_TAX_RATE * Math.max(0, realGain);
    const sideRes = afterRealGainsTax(side, sideBasis);
    const spRes = afterRealGainsTax(sp, spBasis);
    const realEstate = propertyValue - sellCosts - balance - shevach + sideRes.net + idleCash;
    return {
      year: Math.round(t),
      realEstate,
      sp500: spRes.net,
      propertyValue,
      mortgageBalance: balance,
      diff: realEstate - spRes.net,
      sellCosts,
      shevach,
      shevachExempt,
      sideTax: sideRes.tax,
      sideNet: sideRes.net,
      spTax: spRes.tax,
    };
  };

  const strip = (s: ReturnType<typeof snapshot>): YearPoint => ({
    year: s.year,
    realEstate: s.realEstate,
    sp500: s.sp500,
    propertyValue: s.propertyValue,
    mortgageBalance: s.mortgageBalance,
    diff: s.diff,
  });

  const points: YearPoint[] = [strip(snapshot(0))];
  let last = snapshot(0);

  for (let m = 1; m <= totalMonths; m++) {
    const yearIdx = Math.floor((m - 1) / 12);

    // 1. Mortgage payment (Spitzer)
    let payment = 0;
    if (balance > 0 && m <= termMonths) {
      const interest = balance * mortMonthly;
      payment = Math.min(pmt, balance + interest);
      balance = balance + interest - payment;
      if (balance < 0.005) balance = 0;
      interestPaid += interest;
    }

    // 2. Rent (re-priced annually off current property value) and rental tax
    const valueAtYearStart = price * Math.pow(1 + g, yearIdx);
    const rentGross = Math.max(0, (valueAtYearStart * rentalYield) / 100 / 12);
    const ceiling = RENT_EXEMPT_CEILING_MONTHLY * Math.pow(1 + inflation / 100, yearIdx);
    const rentTax = rentGross > ceiling ? rentGross * RENT_FLAT_TAX_RATE : 0;
    const rentNet = rentGross - rentTax;
    rentGrossTotal += rentGross;
    rentTaxTotal += rentTax;

    // 3. Grow investment balances; index cost bases to inflation
    sp *= 1 + spMonthly;
    side *= 1 + spMonthly;
    spBasis *= 1 + inflMonthly;
    sideBasis *= 1 + inflMonthly;

    // 4. Cash-flow matching
    const gap = payment - rentNet;
    if (m === 1) {
      initialRentGross = rentGross;
      initialRentNet = rentNet;
      initialGap = gap;
    }
    if (gap > 0) {
      outOfPocket += gap;
      if (cashflowMatching) {
        sp += gap;
        spBasis += gap;
        spContrib += gap;
      }
    } else if (gap < 0) {
      const surplus = -gap;
      if (cashflowMatching) {
        side += surplus;
        sideBasis += surplus;
      } else {
        idleCash += surplus;
      }
    }

    if (m % 12 === 0) {
      last = snapshot(m);
      points.push(strip(last));
    }
  }

  // --- Summaries -----------------------------------------------------------
  const reCash = equity + outOfPocket;
  const reGross = last.propertyValue - balance + side + idleCash;
  const reNet = last.realEstate;
  const realEstate: RealEstateSummary = {
    propertyPrice: price,
    purchaseTax: pTax,
    closingCosts: closing,
    downPayment,
    loanAmount,
    ltv,
    maxLtv,
    ltvExceeded: ltv > maxLtv + 1e-9,
    equityShortfall,
    monthlyMortgagePayment: pmt,
    initialMonthlyRentGross: initialRentGross,
    initialMonthlyRentNet: initialRentNet,
    initialMonthlyGap: initialGap,
    totalCashInvested: reCash,
    outOfPocketContributions: outOfPocket,
    totalInterestPaid: interestPaid,
    totalRentGross: rentGrossTotal,
    totalRentTax: rentTaxTotal,
    finalPropertyValue: last.propertyValue,
    remainingMortgage: balance,
    sellingCosts: last.sellCosts,
    shevachTax: last.shevach,
    shevachExempt: last.shevachExempt,
    sideFundValue: side,
    sideFundTax: last.sideTax,
    idleCash,
    grossValue: reGross,
    grossGain: reGross - reCash,
    netWorth: reNet,
    totalReturnPct: reCash > 0 ? (reNet / reCash - 1) * 100 : 0,
  };

  const spCash = equity + spContrib;
  const sp500: SP500Summary = {
    initialInvestment: equity,
    monthlyContributionsTotal: spContrib,
    totalCashInvested: spCash,
    grossValue: sp,
    grossGain: sp - spCash,
    capitalGainsTax: last.spTax,
    netWorth: last.sp500,
    totalReturnPct: spCash > 0 ? (last.sp500 / spCash - 1) * 100 : 0,
    netAnnualReturn: spNetAnnual * 100,
  };

  const difference = Math.abs(reNet - last.sp500);
  const winner = difference < 1_000 ? "tie" : reNet > last.sp500 ? "realEstate" : "sp500";

  const crossovers: Crossover[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].diff;
    const cur = points[i].diff;
    if (prev !== 0 && cur !== 0 && Math.sign(prev) !== Math.sign(cur)) {
      crossovers.push({ year: points[i].year, leader: cur > 0 ? "realEstate" : "sp500" });
    }
  }

  return { inputs, points, realEstate, sp500, winner, difference, crossovers };
}
