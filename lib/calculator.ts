/**
 * Real Estate vs. S&P 500 — Israeli "What-If" calculation engine.
 *
 * Pure, synchronous, dependency-free. Runs month-by-month and snapshots a
 * full after-tax liquidation value at the end of every year, so each chart
 * point answers: "if I sold everything at the end of year t, what would I
 * have in my pocket?"
 *
 * All rates in SimInputs are given in PERCENT (e.g. 4.8 = 4.8%).
 * Year 1 of the simulation is treated as 2027. Tax thresholds that the law
 * froze through 2027 stay flat in year 1 and are indexed to CPI afterwards.
 *
 * Sources for every rule: reports/Israeli tax rules simulator check.md
 */

// ---------------------------------------------------------------------------
// Constants — Israeli rules as of late 2026
// ---------------------------------------------------------------------------

/** מס רכישה — דירה יחידה / משפר דיור. Amounts of 16.1.2024, frozen until 15.1.2028. */
export const PURCHASE_TAX_SINGLE: ReadonlyArray<readonly [number, number]> = [
  [1_978_745, 0],
  [2_347_040, 0.035],
  [6_055_070, 0.05],
  [20_183_565, 0.08],
  [Infinity, 0.1],
];

/** מס רכישה — דירה נוספת (temporary order, purchases up to 10.2.2027 unless extended). */
export const PURCHASE_TAX_ADDITIONAL: ReadonlyArray<readonly [number, number]> = [
  [6_055_070, 0.08],
  [Infinity, 0.1],
];

/** VAT since 1.1.2025 */
export const VAT = 0.18;
/** Typical broker fee (each side), before VAT */
export const BROKER_RATE = 0.02;
/** Typical lawyer fee (each side), before VAT */
export const LAWYER_RATE = 0.005;
/** Appraiser, mortgage advisor, bank fees, registration — fixed, ₪ */
export const BUY_FIXED_COSTS = 10_000;

/** Landlord running costs */
export const VACANCY_MONTHS_PER_YEAR = 1;
export const MAINTENANCE_RATE = 0.08; // repairs reserve, % of rent collected
export const INSURANCE_MONTHLY = 150; // building + mortgage life insurance, ₪ (indexed)

/** Rental income: monthly exemption ceiling (frozen 2024–2027), 10% track, marginal rate for the taper */
export const RENT_EXEMPT_CEILING_MONTHLY = 5_654;
export const RENT_FLAT_TAX_RATE = 0.1;
export const MARGINAL_TAX_RATE = 0.31;

/** מס שבח / capital gains on real gain */
export const CAPITAL_GAINS_TAX_RATE = 0.25;
/** Sole-apartment exemption needs 18 months of ownership */
export const SHEVACH_EXEMPT_MONTHS = 18;
/** Sole-apartment exemption price ceiling (2024–2027, frozen) */
export const SHEVACH_SINGLE_CEILING = 5_008_000;

/** מס יסף: 3% + 2% on capital income above the threshold (2025–2027, frozen) */
export const SURTAX_RATE = 0.05;
export const SURTAX_THRESHOLD = 721_560;
/** Non-exempt apartment sales at or below this value are excluded from surtax */
export const SURTAX_RE_SALE_THRESHOLD = 5_382_285;

/** Bank of Israel LTV limits (Directive 329) */
export const MAX_LTV = { single: 0.75, upgrader: 0.7, additional: 0.5 } as const;

/** Dividend withholding drag inside the fund, % per year of fund value */
export const DIVIDEND_DRAG = { israeli: 0.0025, irish: 0.0019 } as const;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

export type ApartmentType = "single" | "upgrader" | "additional";
export type SpVehicle = "israeli" | "irish";

export interface SimInputs {
  equity: number;
  years: number;
  propertyPrice: number;
  autoPrice: boolean;
  apartmentType: ApartmentType;
  useBroker: boolean;
  mortgageRate: number;
  mortgageTerm: number;
  rentalYield: number;
  rentGrowth: number;
  appreciation: number;
  spReturn: number;
  spFee: number;
  spVehicle: SpVehicle;
  cashflowMatching: boolean;
  inflation: number;
  loanEnabled: boolean;
  loanAmount: number;
  loanRate: number;
  loanTerm: number;
}

type NumericKey = {
  [K in keyof SimInputs]: SimInputs[K] extends number ? K : never;
}[keyof SimInputs];
type BoolKey = {
  [K in keyof SimInputs]: SimInputs[K] extends boolean ? K : never;
}[keyof SimInputs];

export interface Bound {
  min: number;
  max: number;
  step: number;
}

export const BOUNDS: Record<NumericKey, Bound> = {
  equity: { min: 200_000, max: 3_000_000, step: 10_000 },
  years: { min: 5, max: 30, step: 1 },
  propertyPrice: { min: 300_000, max: 5_000_000, step: 10_000 },
  mortgageRate: { min: 1, max: 9, step: 0.05 },
  mortgageTerm: { min: 5, max: 30, step: 1 },
  rentalYield: { min: 1, max: 7, step: 0.05 },
  rentGrowth: { min: -2, max: 8, step: 0.1 },
  appreciation: { min: -2, max: 10, step: 0.1 },
  spReturn: { min: 0, max: 15, step: 0.1 },
  spFee: { min: 0, max: 2, step: 0.01 },
  inflation: { min: 0, max: 6, step: 0.1 },
  loanAmount: { min: 10_000, max: 1_500_000, step: 10_000 },
  loanRate: { min: 2, max: 15, step: 0.1 },
  loanTerm: { min: 1, max: 20, step: 1 },
};

export const DEFAULT_INPUTS: SimInputs = {
  equity: 600_000,
  years: 15,
  propertyPrice: 2_000_000,
  autoPrice: false,
  apartmentType: "single",
  useBroker: true,
  mortgageRate: 4.8,
  mortgageTerm: 25,
  rentalYield: 3.2,
  rentGrowth: 3.0,
  appreciation: 4.0,
  spReturn: 9.5,
  spFee: 0.15,
  spVehicle: "israeli",
  cashflowMatching: true,
  inflation: 2.5,
  loanEnabled: false,
  loanAmount: 200_000,
  loanRate: 7.5,
  loanTerm: 10,
};

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export interface YearPoint {
  year: number;
  /** שווי נטו במסלול הנדל״ן אחרי מכירה, סילוק משכנתא והלוואה ומסים */
  realEstate: number;
  /** שווי נטו במסלול ה-S&P אחרי מס רווחי הון ומס יסף */
  sp500: number;
  propertyValue: number;
  mortgageBalance: number;
  /** realEstate - sp500 */
  diff: number;
}

export interface RealEstateSummary {
  apartmentType: ApartmentType;
  propertyPrice: number;
  purchaseTax: number;
  closingCosts: number;
  downPayment: number;
  /** Mortgage principal */
  loanAmount: number;
  ltv: number;
  maxLtv: number;
  ltvExceeded: boolean;
  /** Highest price the bank would finance with the available cash */
  maxPrice: number;
  /** The chosen price was above maxPrice and was lowered to it */
  priceCapped: boolean;
  /** Cash can't cover costs + down payment (should never happen: price is capped) */
  equityShortfall: boolean;
  monthlyMortgagePayment: number;
  /** Supplementary down-payment loan */
  extraLoanPrincipal: number;
  extraLoanPayment: number;
  extraLoanInterestPaid: number;
  extraLoanRemaining: number;
  initialMonthlyRentGross: number;
  initialMonthlyRentNet: number;
  /** Mortgage + loan payments − net rent in month 1 (positive = out of pocket) */
  initialMonthlyGap: number;
  netYieldPct: number;
  totalCashInvested: number;
  outOfPocketContributions: number;
  totalInterestPaid: number;
  totalRentGross: number;
  totalVacancyLoss: number;
  totalOwnershipCosts: number;
  totalRentTax: number;
  finalPropertyValue: number;
  remainingMortgage: number;
  sellingCosts: number;
  shevachTax: number;
  shevachExempt: boolean;
  /** Part of the gain above the sole-apartment ceiling was taxed */
  shevachPartial: boolean;
  surtax: number;
  sideFundValue: number;
  sideFundTax: number;
  idleCash: number;
  grossValue: number;
  grossGain: number;
  netWorth: number;
  totalReturnPct: number;
}

export interface SP500Summary {
  vehicle: SpVehicle;
  initialInvestment: number;
  monthlyContributionsTotal: number;
  totalCashInvested: number;
  grossValue: number;
  grossGain: number;
  capitalGainsTax: number;
  surtax: number;
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

const BOOL_KEYS: BoolKey[] = ["autoPrice", "useBroker", "cashflowMatching", "loanEnabled"];

/** Coerce arbitrary (possibly URL-sourced) input into a valid SimInputs. */
export function sanitizeInputs(raw: Partial<Record<keyof SimInputs | "isFirstApartment", unknown>>): SimInputs {
  const out = { ...DEFAULT_INPUTS };
  (Object.keys(BOUNDS) as NumericKey[]).forEach((k) => {
    const b = BOUNDS[k];
    out[k] = clamp(safeNum(raw[k], DEFAULT_INPUTS[k]), b.min, b.max);
  });
  out.years = Math.round(out.years);
  out.mortgageTerm = Math.round(out.mortgageTerm);
  out.loanTerm = Math.round(out.loanTerm);
  const bool = (v: unknown, d: boolean) =>
    typeof v === "boolean" ? v : v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : d;
  BOOL_KEYS.forEach((k) => {
    out[k] = bool(raw[k], DEFAULT_INPUTS[k]);
  });
  const t = raw.apartmentType;
  if (t === "single" || t === "upgrader" || t === "additional") out.apartmentType = t;
  else if (raw.isFirstApartment !== undefined) {
    // legacy share links
    out.apartmentType = bool(raw.isFirstApartment, true) ? "single" : "additional";
  }
  const v = raw.spVehicle;
  if (v === "israeli" || v === "irish") out.spVehicle = v;
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

/** Upgraders pay single-apartment rates (assuming they sell the old home within the deadline). */
export function purchaseTax(price: number, type: ApartmentType): number {
  return bracketTax(price, type === "additional" ? PURCHASE_TAX_ADDITIONAL : PURCHASE_TAX_SINGLE);
}

export function buyingCosts(price: number, useBroker: boolean): number {
  const pct = ((useBroker ? BROKER_RATE : 0) + LAWYER_RATE) * (1 + VAT);
  return price * pct + BUY_FIXED_COSTS;
}

export function sellingCostRate(useBroker: boolean): number {
  return ((useBroker ? BROKER_RATE : 0) + LAWYER_RATE) * (1 + VAT);
}

/** Spitzer (annuity) monthly payment. Handles a 0% rate. */
export function spitzerPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.max(1, Math.round(years * 12));
  if (!(principal > 0)) return 0;
  const i = annualRatePct / 100 / 12;
  if (Math.abs(i) < 1e-12) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/**
 * Monthly rental tax: the cheaper of the exemption track (full exemption up to
 * the ceiling, tapering to zero at twice the ceiling, remainder at the marginal
 * rate) and the 10% track on gross rent.
 */
export function monthlyRentTax(rent: number, ceiling: number): number {
  if (!(rent > ceiling)) return 0;
  const exempt = Math.max(0, Math.min(ceiling, 2 * ceiling - rent));
  const exemptionTrack = MARGINAL_TAX_RATE * (rent - exempt);
  return Math.min(RENT_FLAT_TAX_RATE * rent, exemptionTrack);
}

/** Surtax on capital income above the (indexed) threshold. */
export function surtax(capitalIncome: number, threshold: number): number {
  return SURTAX_RATE * Math.max(0, capitalIncome - threshold);
}

/**
 * The most expensive property the bank would finance with this cash.
 * Cash must cover purchase tax + buying costs + the minimum down payment
 * (25% single, 30% upgrader, 50% additional). Rounded down to the slider step.
 */
export function maxAffordablePrice(cash: number, type: ApartmentType, useBroker = true): number {
  const b = BOUNDS.propertyPrice;
  const maxLtv = MAX_LTV[type];
  const fits = (p: number) => cash - purchaseTax(p, type) - buyingCosts(p, useBroker) >= (1 - maxLtv) * p - 1e-6;
  if (fits(b.max)) return b.max;
  let lo = 0;
  let hi = b.max;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const stepped = Math.floor(lo / b.step) * b.step;
  return clamp(stepped, b.min, b.max);
}

/** Cash available for the purchase: equity plus the optional down-payment loan. */
export function purchaseCash(inputs: SimInputs): number {
  return inputs.equity + (inputs.loanEnabled ? inputs.loanAmount : 0);
}

/** Price used in the simulation: the user's choice (or the maximum in auto mode), never above the bank limit. */
export function effectivePropertyPrice(inputs: SimInputs): number {
  const cap = maxAffordablePrice(purchaseCash(inputs), inputs.apartmentType, inputs.useBroker);
  return inputs.autoPrice ? cap : Math.min(inputs.propertyPrice, cap);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function simulate(rawInputs: Partial<SimInputs>): SimResult {
  const inputs = sanitizeInputs(rawInputs);
  const {
    equity,
    years,
    apartmentType,
    useBroker,
    mortgageRate,
    mortgageTerm,
    rentalYield,
    rentGrowth,
    appreciation,
    spReturn,
    spFee,
    spVehicle,
    cashflowMatching,
    inflation,
  } = inputs;

  const cash = purchaseCash(inputs);
  const maxPrice = maxAffordablePrice(cash, apartmentType, useBroker);
  const price = effectivePropertyPrice(inputs);
  const totalMonths = years * 12;

  // --- Rates -----------------------------------------------------------------
  const inflMonthly = Math.pow(1 + inflation / 100, 1 / 12) - 1;
  const spNetAnnual = Math.max(-0.99, (1 + spReturn / 100) * (1 - spFee / 100) - 1 - DIVIDEND_DRAG[spVehicle]);
  const spMonthly = Math.pow(1 + spNetAnnual, 1 / 12) - 1;
  // Israeli tracking funds: cost basis indexed to CPI. Irish ETFs: indexed to
  // USD/ILS, assumed flat, so the nominal gain is taxed.
  const basisMonthly = spVehicle === "israeli" ? inflMonthly : 0;
  const mortMonthly = mortgageRate / 100 / 12;
  const g = appreciation / 100;
  /** Frozen-through-2027 thresholds: flat in year 1, CPI-indexed after. */
  const thresholdIndex = (tYears: number) => Math.pow(1 + inflation / 100, Math.max(0, tYears - 1));

  // --- Upfront ---------------------------------------------------------------
  const pTax = purchaseTax(price, apartmentType);
  const closing = buyingCosts(price, useBroker);
  const downPaymentRaw = cash - pTax - closing;
  const equityShortfall = downPaymentRaw <= 0;
  const downPayment = Math.max(0, Math.min(price, downPaymentRaw));
  const loanAmount = Math.max(0, price - downPaymentRaw);
  const unusedCash = Math.max(0, downPaymentRaw - price);
  const maxLtv = MAX_LTV[apartmentType];
  const ltv = price > 0 ? loanAmount / price : 0;
  const pmt = spitzerPayment(loanAmount, mortgageRate, mortgageTerm);
  const termMonths = mortgageTerm * 12;
  const costBasis = price + pTax + closing;
  const sellRate = sellingCostRate(useBroker);

  const extraPrincipal = inputs.loanEnabled ? inputs.loanAmount : 0;
  const extraPmt = spitzerPayment(extraPrincipal, inputs.loanRate, inputs.loanTerm);
  const extraMonthly = inputs.loanRate / 100 / 12;
  const extraTermMonths = inputs.loanTerm * 12;

  // --- State -----------------------------------------------------------------
  let balance = loanAmount;
  let extraBalance = extraPrincipal;
  let sp = equity;
  let spBasis = equity;
  let spContrib = 0;
  let side = unusedCash; // RE-track index fund for rent surpluses / unused cash
  let sideBasis = unusedCash;
  let idleCash = 0;
  let outOfPocket = 0;
  let interestPaid = 0;
  let extraInterest = 0;
  let rentGrossTotal = 0;
  let vacancyTotal = 0;
  let ownershipTotal = 0;
  let rentTaxTotal = 0;
  let initialRentGross = 0;
  let initialRentNet = 0;
  let initialGap = 0;

  const snapshot = (month: number) => {
    const t = month / 12;
    const idx = thresholdIndex(t);
    const propertyValue = price * Math.pow(1 + g, t);
    const sellCosts = propertyValue * sellRate;
    const realGain = Math.max(0, propertyValue - sellCosts - costBasis * Math.pow(1 + inflMonthly, month));

    // מס שבח
    let taxableGain = realGain;
    let shevachExempt = false;
    let shevachPartial = false;
    if (apartmentType !== "additional" && month >= SHEVACH_EXEMPT_MONTHS) {
      const ceiling = SHEVACH_SINGLE_CEILING * idx;
      if (propertyValue <= ceiling) {
        taxableGain = 0;
        shevachExempt = true;
      } else {
        taxableGain = realGain * ((propertyValue - ceiling) / propertyValue);
        shevachPartial = true;
      }
    }
    const shevach = CAPITAL_GAINS_TAX_RATE * taxableGain;

    // Index funds
    const sideGain = Math.max(0, side - sideBasis);
    const sideTax = CAPITAL_GAINS_TAX_RATE * sideGain;
    const spGain = Math.max(0, sp - spBasis);
    const spTax = CAPITAL_GAINS_TAX_RATE * spGain;

    // מס יסף (sale in a single year, no other income assumed)
    const threshold = SURTAX_THRESHOLD * idx;
    const reSaleInSurtax = taxableGain > 0 && propertyValue > SURTAX_RE_SALE_THRESHOLD * idx;
    const reSurtax = surtax((reSaleInSurtax ? taxableGain : 0) + sideGain, threshold);
    const spSurtax = surtax(spGain, threshold);

    const realEstate =
      propertyValue - sellCosts - balance - extraBalance - shevach - reSurtax + (side - sideTax) + idleCash;
    const sp500 = sp - spTax - spSurtax;
    return {
      point: {
        year: Math.round(t),
        realEstate,
        sp500,
        propertyValue,
        mortgageBalance: balance,
        diff: realEstate - sp500,
      } as YearPoint,
      sellCosts,
      shevach,
      shevachExempt,
      shevachPartial,
      sideTax,
      spTax,
      reSurtax,
      spSurtax,
    };
  };

  let last = snapshot(0);
  const points: YearPoint[] = [last.point];

  for (let m = 1; m <= totalMonths; m++) {
    const yearIdx = Math.floor((m - 1) / 12);

    // 1. Mortgage (Spitzer)
    let payment = 0;
    if (balance > 0 && m <= termMonths) {
      const interest = balance * mortMonthly;
      payment = Math.min(pmt, balance + interest);
      balance = balance + interest - payment;
      if (balance < 0.005) balance = 0;
      interestPaid += interest;
    }

    // 2. Down-payment loan (Spitzer)
    let extraPayment = 0;
    if (extraBalance > 0 && m <= extraTermMonths) {
      const interest = extraBalance * extraMonthly;
      extraPayment = Math.min(extraPmt, extraBalance + interest);
      extraBalance = extraBalance + interest - extraPayment;
      if (extraBalance < 0.005) extraBalance = 0;
      extraInterest += interest;
    }

    // 3. Rent: grows yearly; one vacant month a year; tax; landlord costs
    const rentGross = Math.max(0, ((price * rentalYield) / 100 / 12) * Math.pow(1 + rentGrowth / 100, yearIdx));
    const collected = rentGross * (1 - VACANCY_MONTHS_PER_YEAR / 12);
    const ceiling = RENT_EXEMPT_CEILING_MONTHLY * thresholdIndex(yearIdx + 1);
    const rentTax = monthlyRentTax(collected, ceiling);
    const ownership = collected * MAINTENANCE_RATE + INSURANCE_MONTHLY * Math.pow(1 + inflation / 100, yearIdx);
    const rentNet = collected - rentTax - ownership;
    rentGrossTotal += rentGross;
    vacancyTotal += rentGross - collected;
    ownershipTotal += ownership;
    rentTaxTotal += rentTax;

    // 4. Grow funds; index cost bases
    sp *= 1 + spMonthly;
    side *= 1 + spMonthly;
    spBasis *= 1 + basisMonthly;
    sideBasis *= 1 + basisMonthly;

    // 5. Cash-flow matching
    const gap = payment + extraPayment - rentNet;
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
      points.push(last.point);
    }
  }

  // --- Summaries -------------------------------------------------------------
  const reCash = equity + outOfPocket;
  const reGross = last.point.propertyValue - balance - extraBalance + side + idleCash;
  const reNet = last.point.realEstate;
  const realEstate: RealEstateSummary = {
    apartmentType,
    propertyPrice: price,
    purchaseTax: pTax,
    closingCosts: closing,
    downPayment,
    loanAmount,
    ltv,
    maxLtv,
    ltvExceeded: ltv > maxLtv + 1e-9,
    maxPrice,
    priceCapped: !inputs.autoPrice && inputs.propertyPrice > maxPrice,
    equityShortfall,
    monthlyMortgagePayment: pmt,
    extraLoanPrincipal: extraPrincipal,
    extraLoanPayment: extraPmt,
    extraLoanInterestPaid: extraInterest,
    extraLoanRemaining: extraBalance,
    initialMonthlyRentGross: initialRentGross,
    initialMonthlyRentNet: initialRentNet,
    initialMonthlyGap: initialGap,
    netYieldPct: price > 0 ? ((initialRentNet * 12) / price) * 100 : 0,
    totalCashInvested: reCash,
    outOfPocketContributions: outOfPocket,
    totalInterestPaid: interestPaid,
    totalRentGross: rentGrossTotal,
    totalVacancyLoss: vacancyTotal,
    totalOwnershipCosts: ownershipTotal,
    totalRentTax: rentTaxTotal,
    finalPropertyValue: last.point.propertyValue,
    remainingMortgage: balance,
    sellingCosts: last.sellCosts,
    shevachTax: last.shevach,
    shevachExempt: last.shevachExempt,
    shevachPartial: last.shevachPartial,
    surtax: last.reSurtax,
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
    vehicle: spVehicle,
    initialInvestment: equity,
    monthlyContributionsTotal: spContrib,
    totalCashInvested: spCash,
    grossValue: sp,
    grossGain: sp - spCash,
    capitalGainsTax: last.spTax,
    surtax: last.spSurtax,
    netWorth: last.point.sp500,
    totalReturnPct: spCash > 0 ? (last.point.sp500 / spCash - 1) * 100 : 0,
    netAnnualReturn: spNetAnnual * 100,
  };

  const difference = Math.abs(reNet - last.point.sp500);
  const winner = difference < 1_000 ? "tie" : reNet > last.point.sp500 ? "realEstate" : "sp500";

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
