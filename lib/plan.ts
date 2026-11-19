/**
 * "Before the advisor" planner (draft, test environment only).
 *
 * Takes what the household has today, applies the basic order of priorities (safety cushion,
 * expensive debt, tax-sheltered savings), and hands the money that is left to the Snoopy
 * engine to compare an apartment with the S&P 500. Pure functions; the UI lives in
 * components/plan.
 */
import {
  simulate,
  sanitizeInputs,
  maxAffordablePrice,
  purchaseCash,
  spitzerPayment,
  rateForTerm,
  DEFAULT_INPUTS,
  BOUNDS,
  MIN_START_CAPITAL,
  type SimInputs,
  type SimResult,
} from "./calculator.ts";
import { RISK_PROFILES } from "./presets.ts";

export type HomeStatus = "none" | "own";
/** none: "live" = buy to live in, "invest" = buy to rent out and keep renting.
 *  own:  "live" = upgrade (sell and buy a bigger one), "invest" = keep it and buy another to rent out. */
export type HomePlan = "live" | "invest";

export interface Profile {
  /** Current account + deposits */
  cash: number;
  /** Stocks and funds outside pension savings */
  investments: number;
  /** Unrealised gain inside those investments (taxed 25% when sold) */
  investmentsGain: number;
  /** Keren hishtalmut that is already liquid */
  hishtalmut: number;
  useHishtalmut: boolean;
  home: HomeStatus;
  homeValue: number;
  homeMortgage: number;
  /** Other loans (car, consumer, overdraft) */
  debt: number;
  debtRate: number;
  /** Household net income per month */
  income: number;
  /** Household spending per month, including today's rent or mortgage */
  expenses: number;
  years: number;
  /** Money needed in the next three years (wedding, car, renovation) */
  bigExpense: number;
  homePlan: HomePlan;
  /** Index into RISK_PROFILES */
  risk: number;
  cushionMonths: number;
}

export const DEFAULT_PROFILE: Profile = {
  cash: 200_000,
  investments: 400_000,
  investmentsGain: 100_000,
  hishtalmut: 120_000,
  useHishtalmut: false,
  home: "none",
  homeValue: 2_000_000,
  homeMortgage: 500_000,
  debt: 40_000,
  debtRate: 9,
  income: 24_000,
  expenses: 17_000,
  years: 15,
  bigExpense: 0,
  homePlan: "live",
  risk: 2,
  cushionMonths: 6,
};

export const PROFILE_BOUNDS = {
  cash: { min: 0, max: 3_000_000, step: 10_000 },
  investments: { min: 0, max: 5_000_000, step: 10_000 },
  investmentsGain: { min: 0, max: 5_000_000, step: 10_000 },
  hishtalmut: { min: 0, max: 2_000_000, step: 10_000 },
  homeValue: BOUNDS.oldHomeValue,
  homeMortgage: BOUNDS.oldHomeMortgage,
  debt: { min: 0, max: 1_000_000, step: 5_000 },
  debtRate: { min: 0, max: 20, step: 0.5 },
  income: { min: 5_000, max: 100_000, step: 500 },
  expenses: { min: 3_000, max: 80_000, step: 500 },
  years: BOUNDS.years,
  bigExpense: { min: 0, max: 1_000_000, step: 10_000 },
  cushionMonths: { min: 3, max: 12, step: 1 },
} as const;

/** Rule of thumb: a loan above this rate costs more than investing is expected to earn, after tax and risk. */
export const EXPENSIVE_DEBT_RATE = 6;
/** Capital gains tax on selling existing investments (real gain; simplified to the nominal gain). */
export const CAPITAL_GAINS_TAX = 0.25;
/** Rule of thumb for a comfortable mortgage: all loan payments up to 30% of net income (banks allow up to 50%). */
export const COMFORTABLE_PTI = 0.3;
/** Term assumed for the payments on the existing mortgage and on cheap loans that are kept. */
const EXISTING_MORTGAGE_YEARS = 20;
const KEPT_LOAN_YEARS = 5;

export interface Basics {
  monthlySaving: number;
  cushion: number;
  bigExpense: number;
  /** Expensive debt repaid first; 0 when the debt is cheap and kept */
  debtPayoff: number;
  debtKept: number;
  /** Tax on the gain when the investments are sold to free the money */
  saleTax: number;
  hishtalmutUsed: number;
  /** Own money left to put to work (before the old home, for upgraders) */
  available: number;
  /** Not enough for the minimum down payment and costs */
  shortfall: boolean;
  /** Monthly payments that stay: existing mortgage (when kept) + cheap loans kept */
  existingPayments: number;
}

export function basics(p: Profile): Basics {
  const monthlySaving = p.income - p.expenses;
  const cushion = Math.max(0, p.cushionMonths * p.expenses);
  const expensive = p.debt > 0 && p.debtRate >= EXPENSIVE_DEBT_RATE;
  const debtPayoff = expensive ? p.debt : 0;
  const debtKept = expensive ? 0 : p.debt;
  const saleTax = p.investments > 0 ? CAPITAL_GAINS_TAX * Math.min(p.investmentsGain, p.investments) : 0;
  const hishtalmutUsed = p.useHishtalmut ? p.hishtalmut : 0;
  const total = p.cash + p.investments + hishtalmutUsed;
  const available = Math.max(0, total - cushion - p.bigExpense - debtPayoff - saleTax);

  const keepsHome = p.home === "own" && p.homePlan === "invest";
  const mortgagePayment = keepsHome
    ? spitzerPayment(Math.min(p.homeMortgage, p.homeValue), rateForTerm(EXISTING_MORTGAGE_YEARS), EXISTING_MORTGAGE_YEARS)
    : 0;
  const keptLoanPayment = spitzerPayment(debtKept, p.debtRate, KEPT_LOAN_YEARS);

  // Upgraders also have the old home's equity; everyone else needs the minimum in cash
  const oldHomeEquity = p.home === "own" && p.homePlan === "live" ? Math.max(0, p.homeValue - p.homeMortgage) : 0;
  return {
    monthlySaving,
    cushion,
    bigExpense: p.bigExpense,
    debtPayoff,
    debtKept,
    saleTax,
    hishtalmutUsed,
    available,
    shortfall: available + oldHomeEquity < MIN_START_CAPITAL,
    existingPayments: mortgagePayment + keptLoanPayment,
  };
}

/** Engine inputs for the household, at a given apartment price (manual price). */
export function decisionInputs(p: Profile, b: Basics, propertyPrice: number): SimInputs {
  const risk = RISK_PROFILES[Math.min(RISK_PROFILES.length - 1, Math.max(0, Math.round(p.risk)))].values;
  const own = p.home === "own";
  const apartmentType = !own ? "single" : p.homePlan === "live" ? "upgrader" : "additional";
  return sanitizeInputs({
    ...DEFAULT_INPUTS,
    ...risk,
    apartmentType,
    liveInNew: p.homePlan === "live",
    liveElsewhere: false,
    oldHomeValue: own ? p.homeValue : DEFAULT_INPUTS.oldHomeValue,
    oldHomeMortgage: own ? Math.min(p.homeMortgage, p.homeValue) : DEFAULT_INPUTS.oldHomeMortgage,
    sellFirst: true,
    equity: Math.min(BOUNDS.equity.max, b.available),
    years: p.years,
    autoPrice: false,
    propertyPrice,
    incomeCheck: true,
    monthlyIncome: Math.min(BOUNDS.monthlyIncome.max, Math.max(BOUNDS.monthlyIncome.min, p.income)),
  });
}

export interface PriceRange {
  /** Highest price the bank would finance with this money */
  bankCap: number;
  /** Highest price whose mortgage payment keeps all loans within COMFORTABLE_PTI of income */
  comfortable: number;
  /** The suggested price: the lower of the two */
  suggested: number;
  limitedBy: "bank" | "income";
  /** Monthly room for a new mortgage payment */
  paymentBudget: number;
}

export function priceRange(p: Profile, b: Basics): PriceRange {
  const step = BOUNDS.propertyPrice.step;
  const base = decisionInputs(p, b, BOUNDS.propertyPrice.min);
  const bankCap = maxAffordablePrice(purchaseCash(base), base.apartmentType, base.useBroker, base.sellFirst);
  const paymentBudget = COMFORTABLE_PTI * p.income - b.existingPayments;
  const pay = (price: number) => simulate({ ...base, propertyPrice: price }).realEstate.monthlyMortgagePayment;

  let comfortable: number;
  if (pay(bankCap) <= paymentBudget) comfortable = bankCap;
  else if (paymentBudget <= 0 || pay(BOUNDS.propertyPrice.min) > paymentBudget) comfortable = BOUNDS.propertyPrice.min;
  else {
    let lo = BOUNDS.propertyPrice.min;
    let hi = bankCap;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (pay(mid) <= paymentBudget) lo = mid;
      else hi = mid;
    }
    comfortable = Math.max(BOUNDS.propertyPrice.min, Math.floor(lo / step) * step);
  }
  const suggested = Math.min(bankCap, comfortable);
  return { bankCap, comfortable, suggested, limitedBy: comfortable < bankCap ? "income" : "bank", paymentBudget };
}

export interface Leverage {
  /** Apartment value per shekel of own money */
  exposure: number;
  /** Share of own money lost if apartment prices fall 15% */
  aptDropLoss: number;
  /** Share of own money lost in a 35% stock market fall */
  spDropLoss: number;
  /** All loan payments ÷ net income */
  pti: number;
  /** Extra money per month from the household's pocket (same in both tracks) */
  monthlyFromPocket: number;
}

export function leverage(r: SimResult, p: Profile, b: Basics): Leverage {
  const re = r.realEstate;
  const own = Math.max(1, re.startCapital);
  const spExposure = (r.sp500.initialInvestment + r.sp500.loanPrincipal) / Math.max(1, r.sp500.initialInvestment);
  return {
    exposure: re.propertyPrice / own,
    aptDropLoss: (0.15 * re.propertyPrice) / own,
    spDropLoss: 0.35 * spExposure,
    pti: (re.monthlyMortgagePayment + re.extraLoanPayment + b.existingPayments) / Math.max(1, p.income),
    monthlyFromPocket: re.initialMonthlyOwn,
  };
}

/** Months of saving needed to reach the minimum for an apartment. Infinity when not saving. */
export function monthsToMinimum(b: Basics): number {
  const missing = MIN_START_CAPITAL - b.available;
  if (missing <= 0) return 0;
  return b.monthlySaving > 0 ? Math.ceil(missing / b.monthlySaving) : Infinity;
}
