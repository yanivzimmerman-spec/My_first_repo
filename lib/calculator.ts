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
export const MAINTENANCE_RATE = 0.08; // routine repairs, % of rent collected
/** Building insurance, ₪ a month, CPI-indexed (owner, every mode) */
export const BUILDING_INSURANCE_MONTHLY = 50;
/** Mortgage life insurance: ₪ a month per ₪1M of balance (shrinks with the loan, ends at payoff) */
export const LIFE_INSURANCE_PER_MILLION = 100;

/** Urban renewal (optional): betterment levy share of the uplift, years without income while building */
export const RENEWAL_LEVY_RATE = 0.25;
export const RENEWAL_BUILD_YEARS = 3;

/** Notional depreciation the Tax Authority deducts for rented years (contested in court) */
export const DEPRECIATION_RATE = 0.02;
export const BUILDING_SHARE_OF_PRICE = 2 / 3;

/**
 * Rule of thumb: longer mortgages cost more. Blended rate ≈ 4.3% at 10 years,
 * +0.03 points per extra year (≈ 4.75% at 25, 4.9% at 30), rounded to 0.05.
 * CPI-linked tracks run about 1.45 points lower in real terms.
 */
export function rateForTerm(termYears: number): number {
  return Math.round((4.3 + 0.03 * (termYears - 10)) * 20) / 20;
}
export const CPI_REAL_RATE_GAP = 1.45;

/** Rental income: monthly exemption ceiling (frozen 2024–2027), 10% track, marginal rate for the taper */
export const RENT_EXEMPT_CEILING_MONTHLY = 5_654;
export const RENT_FLAT_TAX_RATE = 0.1;
/** Rent above the tapered exemption is taxed at 10% (Knesset Research Center example; confirmed by the user) */
export const TAPER_REMAINDER_RATE = 0.1;
/** s.122(f): sole-apartment owner living in a rental deducts rent paid, up to ₪90K a year, on the 10% track */
export const OWN_RENT_DEDUCTION_CAP_MONTHLY = 90_000 / 12;

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
export const SURTAX_RE_SALE_THRESHOLD = 5_385_285;

/**
 * Bank of Israel payment-to-income (Directive 329, sections 5–6): no housing
 * loan above 50% of disposable income; above 40% banks treat it as high risk.
 */
export const PTI_MAX = 0.5;
export const PTI_WARN = 0.4;

/**
 * Bank of Israel LTV limits (Directive 329 §2): 75% when the buyer owns no
 * other apartment, 70% for a replacement buyer who still owns the old one and
 * undertakes to sell it, 50% otherwise.
 */
export const MAX_LTV = { single: 0.75, upgrader: 0.7, additional: 0.5 } as const;

/** An upgrader who sells first owns nothing at purchase, so the 75% limit applies. */
export function maxLtvFor(type: ApartmentType, sellFirst: boolean): number {
  return type === "upgrader" && sellFirst ? MAX_LTV.single : MAX_LTV[type];
}

/**
 * Dividend withholding drag inside the fund, per year of fund value
 * (~1.27% S&P yield × 25% US withholding for an Israeli fund, × 15% for an Irish UCITS ETF).
 */
export const DIVIDEND_DRAG = { israeli: 0.0032, irish: 0.0019 } as const;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

export type ApartmentType = "single" | "upgrader" | "additional";
export type SpVehicle = "israeli" | "irish";

export interface SimInputs {
  equity: number;
  /** Upgrader only: value of the apartment being sold, and the mortgage left on it */
  oldHomeValue: number;
  oldHomeMortgage: number;
  /** Early-repayment fee on the old mortgage, ₪ (0 on prime tracks) */
  oldHomePrepayFee: number;
  /** Upgrader sells the old home before buying (owns nothing at purchase → 75% LTV) */
  sellFirst: boolean;
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
  spLoanEnabled: boolean;
  spLoanAmount: number;
  spLoanRate: number;
  spLoanTerm: number;
  /**
   * Monthly rent the owner pays for their own home (0 = not living in a rental).
   * A sole-apartment owner may deduct it, up to ₪90K a year, on the 10% track (s.122(f)).
   */
  ownRentPaid: number;
  /**
   * Single / upgrader: the buyer lives in the new apartment instead of renting it out.
   * The rent they would otherwise pay is saved (no vacancy, no rent tax); in the S&P
   * track they live in a rental.
   */
  liveInNew: boolean;
  /**
   * Additional apartment: the owner lives elsewhere and rents out BOTH apartments.
   * The old one is rented out in both tracks, so only the extra rent tax caused by
   * the new apartment's rent (the household shares one exemption ceiling) differs.
   */
  liveElsewhere: boolean;
  /** Sole apartment rented out while living in a rental: assume own rent ≈ the rent received */
  ownRentAuto: boolean;
  /** USD/ILS change per year (%): shekel return of the S&P = (1 + USD return)(1 + drift) − 1 */
  fxDrift: number;
  /** Mortgage rate follows the term by rule of thumb */
  autoRate: boolean;
  /** Mortgage tracks: % CPI-linked (real rate) and % variable (rate can shift from year 2) */
  cpiShare: number;
  cpiRealRate: number;
  variableShare: number;
  rateShock: number;
  /** Owner costs */
  capexRate: number;
  vacancyOwnerCost: number;
  managementFee: number;
  /** Sale-side options */
  depreciation: boolean;
  ageDrag: number;
  monthsToSell: number;
  urbanRenewal: boolean;
  renewalUplift: number;
  renewalYear: number;
  /** Optional bank-approval check: household's net monthly income */
  incomeCheck: boolean;
  monthlyIncome: number;
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
  equity: { min: 0, max: 3_000_000, step: 10_000 },
  oldHomeValue: { min: 500_000, max: 8_000_000, step: 10_000 },
  oldHomeMortgage: { min: 0, max: 8_000_000, step: 10_000 },
  oldHomePrepayFee: { min: 0, max: 300_000, step: 1_000 },
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
  spLoanAmount: { min: 10_000, max: 1_500_000, step: 10_000 },
  spLoanRate: { min: 2, max: 15, step: 0.1 },
  spLoanTerm: { min: 1, max: 20, step: 1 },
  monthlyIncome: { min: 5_000, max: 100_000, step: 500 },
  ownRentPaid: { min: 0, max: 20_000, step: 100 },
  fxDrift: { min: -3, max: 2, step: 0.1 },
  cpiShare: { min: 0, max: 100, step: 5 },
  cpiRealRate: { min: 0.5, max: 6, step: 0.05 },
  variableShare: { min: 0, max: 65, step: 5 },
  rateShock: { min: -2, max: 4, step: 0.25 },
  capexRate: { min: 0, max: 2, step: 0.1 },
  vacancyOwnerCost: { min: 0, max: 3_000, step: 50 },
  managementFee: { min: 0, max: 15, step: 1 },
  ageDrag: { min: 0, max: 1, step: 0.05 },
  monthsToSell: { min: 0, max: 12, step: 1 },
  renewalUplift: { min: 0, max: 60, step: 5 },
  renewalYear: { min: 4, max: 30, step: 1 },
};

export const DEFAULT_INPUTS: SimInputs = {
  equity: 600_000,
  oldHomeValue: 2_000_000,
  oldHomeMortgage: 500_000,
  oldHomePrepayFee: 0,
  sellFirst: true,
  years: 15,
  propertyPrice: 2_000_000,
  autoPrice: false,
  apartmentType: "single",
  useBroker: true,
  mortgageRate: 4.75, // = rateForTerm(25)
  mortgageTerm: 25,
  rentalYield: 3.2,
  rentGrowth: 3.0,
  appreciation: 4.0,
  spReturn: 9.5,
  spFee: 0.15,
  spVehicle: "israeli",
  cashflowMatching: true,
  inflation: 2.0,
  loanEnabled: false,
  loanAmount: 200_000,
  loanRate: 8,
  loanTerm: 7,
  spLoanEnabled: false,
  spLoanAmount: 200_000,
  spLoanRate: 6.5,
  spLoanTerm: 10,
  ownRentPaid: 0,
  ownRentAuto: true,
  fxDrift: -0.5,
  autoRate: true,
  cpiShare: 0,
  cpiRealRate: 3.3,
  variableShare: 0,
  rateShock: 0,
  capexRate: 0.5,
  vacancyOwnerCost: 900,
  managementFee: 0,
  depreciation: false,
  ageDrag: 0,
  monthsToSell: 0,
  urbanRenewal: false,
  renewalUplift: 20,
  renewalYear: 10,
  liveInNew: false,
  liveElsewhere: false,
  incomeCheck: false,
  monthlyIncome: 25_000,
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
  /** The buyer lives in the new apartment (rent saved instead of rent received) */
  livesInNew: boolean;
  /** Additional apartment: moves into the new one and rents out the old one */
  rentsOutOld: boolean;
  /** Additional apartment, living elsewhere: both apartments rented out */
  rentsOutBoth: boolean;
  /** Own money at the start (cash + net proceeds from the old home) */
  startCapital: number;
  oldHomeNetProceeds: number;
  /** Part of the old-home money usable on purchase day (all of it when selling first) */
  oldHomeUsableAtPurchase: number;
  oldHomeSellingCosts: number;
  /** Old home value is above the sole-apartment exemption ceiling (partial tax not modelled) */
  oldHomeAboveCeiling: boolean;
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
  /** Month-1 housing payments ÷ income (null when the check is off) */
  paymentToIncome: number | null;
  initialMonthlyRentGross: number;
  initialMonthlyRentNet: number;
  /** Mortgage + loan payments − net rent in month 1 (positive = out of pocket) */
  initialMonthlyGap: number;
  /** Own money added per month in month 1 (same in both tracks when matching is on) */
  initialMonthlyOwn: number;
  /** Month-1 deposit into the apartment track's index fund (matching) */
  initialSideDeposit: number;
  netYieldPct: number;
  totalCashInvested: number;
  outOfPocketContributions: number;
  totalInterestPaid: number;
  totalRentGross: number;
  totalVacancyLoss: number;
  /** All owner costs: maintenance, vacancy costs, management, capex, insurance, rent while rebuilding */
  totalOwnershipCosts: number;
  totalMaintenance: number;
  totalVacancyCosts: number;
  totalManagement: number;
  totalCapex: number;
  totalInsurance: number;
  renewalIncomeLost: number;
  renewalLevy: number;
  sellDelayCost: number;
  depreciationDeducted: number;
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
  loanPrincipal: number;
  loanPayment: number;
  loanInterestPaid: number;
  loanRemaining: number;
  /** Month-1 deposit into the fund (matching) */
  initialDeposit: number;
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

const BOOL_KEYS: BoolKey[] = ["ownRentAuto", "autoRate", "depreciation", "urbanRenewal", "liveElsewhere", "liveInNew", "sellFirst", "autoPrice", "useBroker", "cashflowMatching", "loanEnabled", "spLoanEnabled", "incomeCheck"];

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
  out.spLoanTerm = Math.round(out.spLoanTerm);
  out.monthsToSell = Math.round(out.monthsToSell);
  out.renewalYear = Math.round(out.renewalYear);
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
  // Mortgage rate by term (rule of thumb) unless set by hand; tracks can't exceed 100%
  if (out.autoRate) {
    out.mortgageRate = rateForTerm(out.mortgageTerm);
    out.cpiRealRate = Math.max(BOUNDS.cpiRealRate.min, out.mortgageRate - CPI_REAL_RATE_GAP);
  }
  out.variableShare = Math.min(out.variableShare, 100 - out.cpiShare);
  // Money usable on purchase day is at least ₪200K, so the cheapest apartment is always
  // affordable within the bank limit (a buy-first upgrader may have no bridge at all).
  out.oldHomeMortgage = Math.min(out.oldHomeMortgage, out.oldHomeValue);
  out.equity = Math.max(out.equity, MIN_START_CAPITAL - oldHomeUsableAtPurchase(out));
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
export function monthlyRentTax(rent: number, ceiling: number, ownRentDeduction = 0): number {
  if (!(rent > ceiling)) return 0;
  const exempt = Math.max(0, Math.min(ceiling, 2 * ceiling - rent));
  const exemptionTrack = TAPER_REMAINDER_RATE * (rent - exempt);
  const deduction = Math.min(Math.max(0, ownRentDeduction), OWN_RENT_DEDUCTION_CAP_MONTHLY);
  const flatTrack = RENT_FLAT_TAX_RATE * Math.max(0, rent - deduction);
  return Math.min(flatTrack, exemptionTrack);
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
export function maxAffordablePrice(cash: number, type: ApartmentType, useBroker = true, sellFirst = false): number {
  const b = BOUNDS.propertyPrice;
  const maxLtv = maxLtvFor(type, sellFirst);
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

/** Minimum starting capital (cash + net proceeds from selling the old home). */
export const MIN_START_CAPITAL = 200_000;

/**
 * Upgraders sell their current apartment: sale price − broker/lawyer fees − the
 * mortgage left on it. Assumed exempt from מס שבח (sole apartment) and sold at
 * the same time as the purchase. Zero for the other apartment types.
 */
export function oldHomeProceeds(inputs: SimInputs): { net: number; sellingCosts: number } {
  if (inputs.apartmentType !== "upgrader") return { net: 0, sellingCosts: 0 };
  const sellingCosts = inputs.oldHomeValue * sellingCostRate(inputs.useBroker);
  const mortgage = Math.min(inputs.oldHomeMortgage, inputs.oldHomeValue);
  const prepay = mortgage > 0 ? inputs.oldHomePrepayFee : 0;
  return { net: Math.max(0, inputs.oldHomeValue - sellingCosts - mortgage - prepay), sellingCosts };
}

/** The user's own money at the start, the same in both tracks. */
export function startCapital(inputs: SimInputs): number {
  return inputs.equity + oldHomeProceeds(inputs).net;
}

/**
 * Money from the old home that can be used on purchase day. Selling first: all of it.
 * Buying first: until the sale only a bridge loan on the old home is allowed, with all
 * loans on it capped at 50% of its value (Directive 329 Q&A 2.6); the rest arrives at
 * the sale and is invested in the apartment track's index fund.
 */
export function oldHomeUsableAtPurchase(inputs: SimInputs): number {
  const { net } = oldHomeProceeds(inputs);
  if (inputs.apartmentType !== "upgrader" || inputs.sellFirst) return net;
  const bridge = Math.max(0, 0.5 * inputs.oldHomeValue - Math.min(inputs.oldHomeMortgage, inputs.oldHomeValue));
  return Math.min(net, bridge);
}

/**
 * Sole apartment / upgrader living in the new apartment: the rent they'd pay is saved
 * (no vacancy, no rent tax). In the S&P track they live in a rental.
 */
export function livesInNew(inputs: SimInputs): boolean {
  return inputs.liveInNew && inputs.apartmentType !== "additional";
}

/**
 * Additional apartment, "keep the old one and rent it out": the owner moves into the
 * new apartment and rents out the old one (value = oldHomeValue). Tax-wise still an
 * additional apartment. In the S&P track they keep living in the old apartment, so the
 * old home itself is the same in both tracks; only its rent differs.
 */
export function rentsOutOld(inputs: SimInputs): boolean {
  return inputs.liveInNew && inputs.apartmentType === "additional" && !inputs.liveElsewhere;
}

/** Additional apartment, living elsewhere: both apartments are rented out. */
export function rentsOutBoth(inputs: SimInputs): boolean {
  return inputs.liveElsewhere && inputs.apartmentType === "additional";
}

/** Value the rent is based on: the old apartment when it's the one rented out. */
export function rentBaseValue(inputs: SimInputs, price: number): number {
  return rentsOutOld(inputs) ? inputs.oldHomeValue : price;
}

/** Cash available for the purchase: own money (usable on the day) plus the optional down-payment loan. */
export function purchaseCash(inputs: SimInputs): number {
  return inputs.equity + oldHomeUsableAtPurchase(inputs) + (inputs.loanEnabled ? inputs.loanAmount : 0);
}

/**
 * Payment-to-income per Directive 329 annex A: the new mortgage payment divided by
 * disposable income = net income − other loans with more than 18 months left − rent the
 * buyer pays when not living in the purchased apartment. Expected rent from the new
 * apartment is not counted (banks recognise only part of it, case by case).
 * Returns 10 (a clear fail) when disposable income is zero or negative.
 */
export function paymentToIncome(inputs: SimInputs, mortgagePayment: number, otherLoanPayment: number): number {
  const otherLoans = inputs.loanEnabled && inputs.loanTerm * 12 > 18 ? otherLoanPayment : 0;
  // Rent paid elsewhere reduces disposable income whenever the buyer doesn't live in the purchased apartment
  const livesInPurchased = livesInNew(inputs) || rentsOutOld(inputs);
  const livesInOwnOld = inputs.apartmentType === "additional" && !inputs.liveInNew && !inputs.liveElsewhere;
  const rentPaid = livesInPurchased || livesInOwnOld ? 0 : inputs.ownRentPaid;
  const disposable = inputs.monthlyIncome - otherLoans - rentPaid;
  return disposable > 0 ? mortgagePayment / disposable : 10;
}

/** Price used in the simulation: the user's choice (or the maximum in auto mode), never above the bank limit. */
export function effectivePropertyPrice(inputs: SimInputs): number {
  const cap = maxAffordablePrice(purchaseCash(inputs), inputs.apartmentType, inputs.useBroker, inputs.sellFirst);
  return inputs.autoPrice ? cap : Math.min(inputs.propertyPrice, cap);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function simulate(rawInputs: Partial<SimInputs>): SimResult {
  const inputs = sanitizeInputs(rawInputs);
  const old = oldHomeProceeds(inputs);
  const equity = startCapital(inputs); // own money at the start, both tracks
  const {
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
  const maxPrice = maxAffordablePrice(cash, apartmentType, useBroker, inputs.sellFirst);
  const price = effectivePropertyPrice(inputs);
  const totalMonths = years * 12;

  // --- Rates -----------------------------------------------------------------
  const inflMonthly = Math.pow(1 + inflation / 100, 1 / 12) - 1;
  // S&P in shekels: the dollar return converted at the USD/ILS drift
  const fx = inputs.fxDrift / 100;
  const spNetAnnual = Math.max(-0.99, (1 + spReturn / 100) * (1 + fx) * (1 - spFee / 100) - 1 - DIVIDEND_DRAG[spVehicle]);
  const spMonthly = Math.pow(1 + spNetAnnual, 1 / 12) - 1;
  // Cost basis: Israeli tracking fund → CPI; Irish ETF → the dollar rate (section 88)
  const basisMonthly = spVehicle === "israeli" ? inflMonthly : Math.pow(1 + fx, 1 / 12) - 1;
  // Building-age drag lowers the apartment's growth below the market index
  const g = (appreciation - inputs.ageDrag) / 100;
  // Optional urban renewal: value jumps at the renewal year after a construction period
  const renewal = inputs.urbanRenewal && inputs.renewalYear <= years;
  const renewalMonth = inputs.renewalYear * 12;
  const upliftAmount = renewal ? price * Math.pow(1 + g, inputs.renewalYear) * (inputs.renewalUplift / 100) : 0;
  const valueAt = (month: number) =>
    price * Math.pow(1 + g, month / 12) * (renewal && month >= renewalMonth ? 1 + inputs.renewalUplift / 100 : 1);
  const underConstruction = (m: number) => renewal && m > renewalMonth - RENEWAL_BUILD_YEARS * 12 && m <= renewalMonth;
  /** Frozen-through-2027 thresholds: flat in year 1, CPI-indexed after. */
  const thresholdIndex = (tYears: number) => Math.pow(1 + inflation / 100, Math.max(0, tYears - 1));

  // --- Upfront ---------------------------------------------------------------
  const pTax = purchaseTax(price, apartmentType);
  const closing = buyingCosts(price, useBroker);
  const downPaymentRaw = cash - pTax - closing;
  const equityShortfall = downPaymentRaw <= 0;
  const downPayment = Math.max(0, Math.min(price, downPaymentRaw));
  const loanAmount = Math.max(0, price - downPaymentRaw);
  // Old-home money that arrives only after the sale (buy-first upgrader) + cash beyond the price
  const laterOldHomeCash = old.net - oldHomeUsableAtPurchase(inputs);
  const unusedCash = Math.max(0, downPaymentRaw - price) + laterOldHomeCash;
  const maxLtv = maxLtvFor(apartmentType, inputs.sellFirst);
  const ltv = price > 0 ? loanAmount / price : 0;
  const termMonths = mortgageTerm * 12;
  // Mortgage tracks: fixed nominal, variable (rate may shift from year 2), CPI-linked (real rate)
  const cpiLoan = (loanAmount * inputs.cpiShare) / 100;
  const varLoan = (loanAmount * inputs.variableShare) / 100;
  const fixedLoan = loanAmount - cpiLoan - varLoan;
  const fixedPmt = spitzerPayment(fixedLoan, mortgageRate, mortgageTerm);
  let varRate = mortgageRate;
  let varPmt = spitzerPayment(varLoan, mortgageRate, mortgageTerm);
  const cpiRealPmt = spitzerPayment(cpiLoan, inputs.cpiRealRate, mortgageTerm);
  const costBasis = price + pTax + closing;
  const sellRate = sellingCostRate(useBroker);

  const extraPrincipal = inputs.loanEnabled ? inputs.loanAmount : 0;
  const extraPmt = spitzerPayment(extraPrincipal, inputs.loanRate, inputs.loanTerm);
  const extraMonthly = inputs.loanRate / 100 / 12;
  const extraTermMonths = inputs.loanTerm * 12;

  const spLoanPrincipal = inputs.spLoanEnabled ? inputs.spLoanAmount : 0;
  const spLoanPmt = spitzerPayment(spLoanPrincipal, inputs.spLoanRate, inputs.spLoanTerm);
  const spLoanMonthly = inputs.spLoanRate / 100 / 12;
  const spLoanTermMonths = inputs.spLoanTerm * 12;

  // --- State -----------------------------------------------------------------
  let fixedBal = fixedLoan;
  let varBal = varLoan;
  let cpiRealBal = cpiLoan;
  let cpiIndex = 1;
  const mortgageBalance = () => fixedBal + varBal + cpiRealBal * cpiIndex;
  let balance = loanAmount;
  let firstPayment = 0;
  let extraBalance = extraPrincipal;
  let sp = equity + spLoanPrincipal; // borrowed money is invested on day one
  let spBasis = equity + spLoanPrincipal;
  let spContrib = 0; // own money added monthly to the S&P track
  let spLoanBalance = spLoanPrincipal;
  let spLoanInterest = 0;
  let side = unusedCash; // RE-track index fund for rent surpluses / unused cash
  let sideBasis = unusedCash;
  let idleCash = 0;
  let outOfPocket = 0;
  let interestPaid = 0;
  let extraInterest = 0;
  let rentGrossTotal = 0;
  let vacancyTotal = 0;
  let ownershipTotal = 0;
  let maintenanceTotal = 0;
  let vacancyCostTotal = 0;
  let managementTotal = 0;
  let capexTotal = 0;
  let insuranceTotal = 0;
  let renewalIncomeLost = 0;
  let rentTaxTotal = 0;
  let initialRentGross = 0;
  let initialRentNet = 0;
  let initialGap = 0;
  let initialOwn = 0;
  let initialSideDeposit = 0;
  let initialSpDeposit = 0;

  const snapshot = (month: number) => {
    const t = month / 12;
    const idx = thresholdIndex(t);
    const propertyValue = valueAt(month);
    const sellCosts = propertyValue * sellRate;
    const levy = renewal && month >= renewalMonth ? RENEWAL_LEVY_RATE * upliftAmount : 0;
    // Notional depreciation on a rented additional apartment (optional; contested in court)
    const depreciation =
      inputs.depreciation && apartmentType === "additional" && !rentsOutOld(inputs)
        ? Math.min(1, DEPRECIATION_RATE * t) * BUILDING_SHARE_OF_PRICE * price
        : 0;
    const realGain = Math.max(
      0,
      propertyValue - sellCosts - levy - (costBasis * Math.pow(1 + inflMonthly, month) - depreciation),
    );
    // Months on the market: a rented-out new apartment stands empty and the owner pays its upkeep
    const sellingNewRented = !livesInNew(inputs) && !rentsOutOld(inputs);
    const rentNow =
      ((price * rentalYield) / 1200) * Math.pow(1 + rentGrowth / 100, Math.max(0, Math.ceil(t) - 1));
    const sellDelay = sellingNewRented
      ? inputs.monthsToSell * (rentNow + inputs.vacancyOwnerCost * Math.pow(1 + inflation / 100, Math.max(0, Math.ceil(t) - 1)))
      : 0;

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
      propertyValue - sellCosts - levy - sellDelay - balance - extraBalance - shevach - reSurtax + (side - sideTax) + idleCash;
    const sp500 = sp - spTax - spSurtax - spLoanBalance;
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
      levy,
      sellDelay,
      depreciation,
    };
  };

  let last = snapshot(0);
  const points: YearPoint[] = [last.point];

  for (let m = 1; m <= totalMonths; m++) {
    const yearIdx = Math.floor((m - 1) / 12);

    // 1. Mortgage tracks (Spitzer each)
    const balanceAtStart = mortgageBalance();
    let payment = 0;
    if (m <= termMonths) {
      if (fixedBal > 0) {
        const it = (fixedBal * mortgageRate) / 1200;
        const p = Math.min(fixedPmt, fixedBal + it);
        fixedBal = fixedBal + it - p;
        if (fixedBal < 0.005) fixedBal = 0;
        interestPaid += it;
        payment += p;
      }
      if (varBal > 0) {
        if (m === 13 && inputs.rateShock !== 0) {
          varRate = Math.max(0.1, mortgageRate + inputs.rateShock);
          varPmt = spitzerPayment(varBal, varRate, (termMonths - 12) / 12);
        }
        const it = (varBal * varRate) / 1200;
        const p = Math.min(varPmt, varBal + it);
        varBal = varBal + it - p;
        if (varBal < 0.005) varBal = 0;
        interestPaid += it;
        payment += p;
      }
      if (cpiRealBal > 0) {
        // CPI-linked: a real annuity whose payment and balance rise with the index
        const before = cpiRealBal * cpiIndex;
        cpiIndex *= 1 + inflMonthly;
        const it = (cpiRealBal * inputs.cpiRealRate) / 1200;
        const pReal = Math.min(cpiRealPmt, cpiRealBal + it);
        cpiRealBal = cpiRealBal + it - pReal;
        if (cpiRealBal < 1e-9) cpiRealBal = 0;
        const pNominal = pReal * cpiIndex;
        payment += pNominal;
        interestPaid += pNominal - (before - cpiRealBal * cpiIndex); // interest + linkage
      }
    }
    balance = mortgageBalance();
    if (m === 1) firstPayment = payment;

    // 2. Down-payment loan (Spitzer)
    let extraPayment = 0;
    if (extraBalance > 0 && m <= extraTermMonths) {
      const interest = extraBalance * extraMonthly;
      extraPayment = Math.min(extraPmt, extraBalance + interest);
      extraBalance = extraBalance + interest - extraPayment;
      if (extraBalance < 0.005) extraBalance = 0;
      extraInterest += interest;
    }

    // 2b. S&P loan (Spitzer)
    let spLoanPayment = 0;
    if (spLoanBalance > 0 && m <= spLoanTermMonths) {
      const interest = spLoanBalance * spLoanMonthly;
      spLoanPayment = Math.min(spLoanPmt, spLoanBalance + interest);
      spLoanBalance = spLoanBalance + interest - spLoanPayment;
      if (spLoanBalance < 0.005) spLoanBalance = 0;
      spLoanInterest += interest;
    }

    // 3. Rent: grows yearly; one vacant month a year; tax; landlord costs
    const rentBase = rentBaseValue(inputs, price);
    const growth = Math.pow(1 + rentGrowth / 100, yearIdx);
    const cpiYear = Math.pow(1 + inflation / 100, yearIdx);
    // Living in it: the saved rent counts in full, with no vacancy and no rent tax
    const living = livesInNew(inputs);
    // During an urban-renewal rebuild the new apartment yields nothing; if the owner lives in it
    // while renting out the old one, they rent elsewhere meanwhile.
    const building = underConstruction(m);
    const newApartmentIdle = building && !rentsOutOld(inputs);
    const rentGross = newApartmentIdle ? 0 : Math.max(0, ((rentBase * rentalYield) / 100 / 12) * growth);
    const collected = living ? rentGross : rentGross * (1 - VACANCY_MONTHS_PER_YEAR / 12);
    const rentElsewhereWhileBuilding = building && rentsOutOld(inputs) ? ((price * rentalYield) / 1200) * growth : 0;
    if (building) renewalIncomeLost += newApartmentIdle ? ((rentBase * rentalYield) / 1200) * growth : rentElsewhereWhileBuilding;
    const ceiling = RENT_EXEMPT_CEILING_MONTHLY * thresholdIndex(yearIdx + 1);
    // Rent-paid deduction (10% track): sole-apartment owner living in a rental. By default their
    // own rent is assumed ≈ the market rent of the apartment they rent out (rule of thumb).
    const ownRent = apartmentType === "additional" ? 0 : inputs.ownRentAuto ? rentGross : inputs.ownRentPaid;
    let rentTax = living ? 0 : monthlyRentTax(collected, ceiling, ownRent);
    if (rentsOutBoth(inputs)) {
      // The old apartment's rent uses the household's exemption first (it's rented in both
      // tracks); the new apartment adds only the extra tax on the combined rent.
      const oldCollected =
        ((inputs.oldHomeValue * rentalYield) / 100 / 12) *
        Math.pow(1 + rentGrowth / 100, yearIdx) *
        (1 - VACANCY_MONTHS_PER_YEAR / 12);
      rentTax = monthlyRentTax(oldCollected + collected, ceiling) - monthlyRentTax(oldCollected, ceiling);
    }
    // Owner costs
    const maintenance = collected * MAINTENANCE_RATE;
    const rentedApartmentIdle = living || newApartmentIdle; // nothing rented out this month
    const vacancyCost = rentedApartmentIdle ? 0 : ((inputs.vacancyOwnerCost * VACANCY_MONTHS_PER_YEAR) / 12) * cpiYear;
    const management = living ? 0 : (collected * inputs.managementFee) / 100;
    const capex = building ? 0 : ((inputs.capexRate / 100) * valueAt(m)) / 12;
    const insurance = BUILDING_INSURANCE_MONTHLY * cpiYear + (LIFE_INSURANCE_PER_MILLION * balanceAtStart) / 1e6;
    const ownership = maintenance + vacancyCost + management + capex + insurance + rentElsewhereWhileBuilding;
    const rentNet = collected - rentTax - ownership;
    rentGrossTotal += rentGross;
    vacancyTotal += rentGross - collected;
    ownershipTotal += ownership;
    maintenanceTotal += maintenance;
    vacancyCostTotal += vacancyCost;
    managementTotal += management;
    capexTotal += capex;
    insuranceTotal += insurance;
    rentTaxTotal += rentTax;

    // 4. Grow funds; index cost bases
    sp *= 1 + spMonthly;
    side *= 1 + spMonthly;
    spBasis *= 1 + basisMonthly;
    sideBasis *= 1 + basisMonthly;

    // 5. Cash flow. Each track has its own monthly outflow:
    //    apartment = mortgage + loan − net rent (negative = surplus); S&P = its loan payment.
    //    With matching, both investors put in the same own money P = max(both outflows);
    //    whoever pays less invests the difference in an index fund.
    const reOut = payment + extraPayment - rentNet;
    const spOut = spLoanPayment;
    let own: number;
    let sideDeposit = 0;
    let spDeposit = 0;
    if (cashflowMatching) {
      own = Math.max(reOut, spOut);
      sideDeposit = own - reOut;
      spDeposit = own - spOut;
      side += sideDeposit;
      sideBasis += sideDeposit;
      sp += spDeposit;
      spBasis += spDeposit;
      outOfPocket += own;
      spContrib += own;
    } else {
      own = Math.max(0, reOut);
      if (reOut > 0) outOfPocket += reOut;
      else idleCash += -reOut;
      spContrib += spOut;
    }
    if (m === 1) {
      initialRentGross = rentGross;
      initialRentNet = rentNet;
      initialGap = reOut;
      initialOwn = cashflowMatching ? own : Math.max(0, reOut);
      initialSideDeposit = sideDeposit;
      initialSpDeposit = spDeposit;
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
    livesInNew: livesInNew(inputs),
    rentsOutOld: rentsOutOld(inputs),
    rentsOutBoth: rentsOutBoth(inputs),
    startCapital: equity,
    oldHomeNetProceeds: old.net,
    oldHomeUsableAtPurchase: oldHomeUsableAtPurchase(inputs),
    oldHomeSellingCosts: old.sellingCosts,
    oldHomeAboveCeiling: apartmentType === "upgrader" && inputs.oldHomeValue > SHEVACH_SINGLE_CEILING,
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
    monthlyMortgagePayment: firstPayment,
    extraLoanPrincipal: extraPrincipal,
    extraLoanPayment: extraPmt,
    extraLoanInterestPaid: extraInterest,
    extraLoanRemaining: extraBalance,
    paymentToIncome: inputs.incomeCheck ? paymentToIncome(inputs, firstPayment, extraPmt) : null,
    initialMonthlyRentGross: initialRentGross,
    initialMonthlyRentNet: initialRentNet,
    initialMonthlyGap: initialGap,
    initialMonthlyOwn: initialOwn,
    initialSideDeposit,
    netYieldPct: rentBaseValue(inputs, price) > 0 ? ((initialRentNet * 12) / rentBaseValue(inputs, price)) * 100 : 0,
    totalCashInvested: reCash,
    outOfPocketContributions: outOfPocket,
    totalInterestPaid: interestPaid,
    totalRentGross: rentGrossTotal,
    totalVacancyLoss: vacancyTotal,
    totalOwnershipCosts: ownershipTotal,
    totalMaintenance: maintenanceTotal,
    totalVacancyCosts: vacancyCostTotal,
    totalManagement: managementTotal,
    totalCapex: capexTotal,
    totalInsurance: insuranceTotal,
    renewalIncomeLost,
    renewalLevy: last.levy,
    sellDelayCost: last.sellDelay,
    depreciationDeducted: last.depreciation,
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
    loanPrincipal: spLoanPrincipal,
    loanPayment: spLoanPmt,
    loanInterestPaid: spLoanInterest,
    loanRemaining: spLoanBalance,
    initialDeposit: initialSpDeposit,
    initialInvestment: equity,
    monthlyContributionsTotal: spContrib,
    totalCashInvested: spCash,
    grossValue: sp,
    grossGain: sp - spLoanBalance - spCash,
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

/**
 * Generic break-even: the value of one input at which both tracks end equal.
 * The gap (apartment − S&P) rises with the input; bisection within the slider range.
 * Both tracks are re-simulated, since the S&P track's monthly deposits follow the
 * apartment's cash flow (e.g., the renovation reserve grows with the property's value).
 */
function breakEven(inputs: SimInputs, key: "appreciation" | "rentalYield"): { value: number | null; below: boolean } {
  const gap = (v: number) => {
    const r = simulate({ ...inputs, [key]: v });
    return r.realEstate.netWorth - r.sp500.netWorth;
  };
  const LO = BOUNDS[key].min;
  const HI = BOUNDS[key].max;
  if (gap(LO) >= 0) return { value: null, below: true }; // the apartment wins even at the minimum
  if (gap(HI) < 0) return { value: null, below: false }; // the S&P wins even at the maximum
  let lo = LO;
  let hi = HI;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return { value: hi, below: false };
}

/** Yearly price growth at which both tracks end equal (null outside −2%…10%). */
export function breakEvenAppreciation(inputs: SimInputs): { value: number | null; below: boolean } {
  return breakEven(inputs, "appreciation");
}

/**
 * Monthly rent (first year, in ₪) at which both tracks end equal; in live-in mode,
 * the rent saved. Null when outside the slider's 1%–7% yield range.
 */
export function breakEvenRent(inputs: SimInputs): { value: number | null; below: boolean } {
  const r = breakEven(inputs, "rentalYield");
  if (r.value === null) return r;
  const x = sanitizeInputs(inputs);
  const base = rentBaseValue(x, effectivePropertyPrice(x));
  return { value: (base * r.value) / 1200, below: false };
}
