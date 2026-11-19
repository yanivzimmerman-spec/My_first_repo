/*
 * Independent reference model, written from the rules (README / research reports),
 * not from lib/calculator.ts. Deliberately different methods:
 *  - loan balances from the closed-form annuity formula (no month-by-month loop),
 *  - every fund deposit tracked as its own lot with its own growth and indexation,
 *  - the maximum price found by scanning prices downward instead of bisection.
 * Only input sanitising is shared with the engine.
 */
import { sanitizeInputs, type SimInputs } from "../lib/calculator.ts";

const LTV = { single: 0.75, upgraderBuyFirst: 0.7, additional: 0.5 };
const SINGLE_BRACKETS: [number, number][] = [
  [1_978_745, 0],
  [2_347_040, 0.035],
  [6_055_070, 0.05],
  [20_183_565, 0.08],
  [Infinity, 0.1],
];
const ADDITIONAL_BRACKETS: [number, number][] = [
  [6_055_070, 0.08],
  [Infinity, 0.1],
];

function progressive(x: number, brackets: [number, number][]): number {
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of brackets) {
    const slice = Math.min(x, top) - prev;
    if (slice <= 0) break;
    tax += slice * rate;
    prev = top;
  }
  return tax;
}

const feeRate = (broker: boolean) => (broker ? 0.025 : 0.005) * 1.18;

function annuity(P: number, ratePct: number, years: number) {
  const n = years * 12;
  const i = ratePct / 1200;
  const pmt = P <= 0 ? 0 : i === 0 ? P / n : (P * i) / (1 - Math.pow(1 + i, -n));
  const balanceAfter = (k: number) => {
    if (P <= 0 || k >= n) return 0;
    if (i === 0) return P - pmt * k;
    return P * Math.pow(1 + i, k) - (pmt * (Math.pow(1 + i, k) - 1)) / i;
  };
  const paymentIn = (m: number) => (P > 0 && m >= 1 && m <= n ? pmt : 0);
  return { pmt, balanceAfter, paymentIn };
}

export interface RefResult {
  price: number;
  realEstate: number;
  sp500: number;
  rentTaxTotal: number;
  shevach: number;
  spTax: number;
}

export function referenceModel(raw: Partial<SimInputs>): RefResult {
  const x = sanitizeInputs(raw);
  const upgrader = x.apartmentType === "upgrader";
  const additional = x.apartmentType === "additional";
  const living = x.liveInNew && !additional;

  // --- Money at the start ---------------------------------------------------
  let oldNet = 0;
  if (upgrader) {
    const m = Math.min(x.oldHomeMortgage, x.oldHomeValue);
    oldNet = Math.max(0, x.oldHomeValue * (1 - feeRate(x.useBroker)) - m - (m > 0 ? x.oldHomePrepayFee : 0));
  }
  const ownStart = x.equity + oldNet;
  let usableOld = oldNet;
  if (upgrader && !x.sellFirst) {
    usableOld = Math.min(oldNet, Math.max(0, x.oldHomeValue / 2 - Math.min(x.oldHomeMortgage, x.oldHomeValue)));
  }
  const loan = x.loanEnabled ? x.loanAmount : 0;
  const cashForPurchase = x.equity + usableOld + loan;

  // --- Price: scan down from ₪5M in ₪10K steps -------------------------------
  const ltv = additional ? LTV.additional : upgrader && !x.sellFirst ? LTV.upgraderBuyFirst : LTV.single;
  const tax = (p: number) => progressive(p, additional ? ADDITIONAL_BRACKETS : SINGLE_BRACKETS);
  const buyCosts = (p: number) => p * feeRate(x.useBroker) + 10_000;
  let cap = 300_000;
  for (let p = 5_000_000; p >= 300_000; p -= 10_000) {
    if (cashForPurchase - tax(p) - buyCosts(p) >= (1 - ltv) * p - 1e-6) {
      cap = p;
      break;
    }
  }
  const price = x.autoPrice ? cap : Math.min(x.propertyPrice, cap);
  const pTax = tax(price);
  const closing = buyCosts(price);
  const down = cashForPurchase - pTax - closing;
  const mortgage = Math.max(0, price - down);
  const extraAtStart = Math.max(0, down - price) + (oldNet - usableOld);

  const N = x.years * 12;
  const mort = annuity(mortgage, x.mortgageRate, x.mortgageTerm);
  const dpLoan = annuity(loan, x.loanRate, x.loanTerm);
  const spLoanP = x.spLoanEnabled ? x.spLoanAmount : 0;
  const spLoan = annuity(spLoanP, x.spLoanRate, x.spLoanTerm);

  // --- Fund lots -------------------------------------------------------------
  const drag = x.spVehicle === "israeli" ? 0.0032 : 0.0019;
  const annual = Math.max(-0.99, (1 + x.spReturn / 100) * (1 - x.spFee / 100) - 1 - drag);
  const rM = Math.pow(1 + annual, 1 / 12) - 1;
  const iM = Math.pow(1 + x.inflation / 100, 1 / 12) - 1;
  const indexBasis = x.spVehicle === "israeli";
  type Lot = { amount: number; month: number };
  const valueOf = (lots: Lot[]) => lots.reduce((s, l) => s + l.amount * Math.pow(1 + rM, N - l.month), 0);
  const basisOf = (lots: Lot[]) =>
    lots.reduce((s, l) => s + l.amount * (indexBasis ? Math.pow(1 + iM, N - l.month) : 1), 0);

  const spLots: Lot[] = [{ amount: ownStart + spLoanP, month: 0 }];
  const sideLots: Lot[] = extraAtStart > 0 ? [{ amount: extraAtStart, month: 0 }] : [];
  let idle = 0;
  let rentTaxTotal = 0;

  for (let m = 1; m <= N; m++) {
    const y = Math.floor((m - 1) / 12);
    // Additional apartment + moving in: the old apartment is the one rented out
    const both = additional && x.liveElsewhere;
    const rentedValue = additional && x.liveInNew && !both ? x.oldHomeValue : price;
    const gross = ((rentedValue * x.rentalYield) / 1200) * Math.pow(1 + x.rentGrowth / 100, y);
    const received = living ? gross : (gross * 11) / 12;
    const ceiling = 5_654 * Math.pow(1 + x.inflation / 100, y); // frozen in year 1 (2027), indexed after
    const householdTax = (rent: number, deduction: number) => {
      if (rent <= ceiling) return 0;
      const exemptPart = Math.max(0, Math.min(ceiling, 2 * ceiling - rent));
      return Math.min(0.1 * (rent - exemptPart), 0.1 * Math.max(0, rent - deduction));
    };
    let rentTax = 0;
    if (both) {
      // the old apartment is rented in both tracks; count only the extra tax the new rent causes
      const oldReceived = (((x.oldHomeValue * x.rentalYield) / 1200) * Math.pow(1 + x.rentGrowth / 100, y) * 11) / 12;
      rentTax = householdTax(oldReceived + received, 0) - householdTax(oldReceived, 0);
    } else if (!living) {
      rentTax = householdTax(received, additional ? 0 : Math.min(x.ownRentPaid, 7_500));
    }
    rentTaxTotal += rentTax;
    const running = 0.08 * received + 150 * Math.pow(1 + x.inflation / 100, y);
    const netRent = received - rentTax - running;

    const apartmentOut = mort.paymentIn(m) + dpLoan.paymentIn(m) - netRent;
    const spOut = spLoan.paymentIn(m);
    if (x.cashflowMatching) {
      const own = Math.max(apartmentOut, spOut);
      if (own - apartmentOut > 0) sideLots.push({ amount: own - apartmentOut, month: m });
      if (own - spOut > 0) spLots.push({ amount: own - spOut, month: m });
    } else if (apartmentOut < 0) {
      idle += -apartmentOut;
    }
  }

  // --- Sale at the end -------------------------------------------------------
  const tIdx = Math.pow(1 + x.inflation / 100, Math.max(0, x.years - 1)); // thresholds frozen in year 1
  const value = price * Math.pow(1 + x.appreciation / 100, x.years);
  const sellCosts = value * feeRate(x.useBroker);
  const realGain = Math.max(0, value - sellCosts - (price + pTax + closing) * Math.pow(1 + iM, N));
  let taxable = realGain;
  if (!additional) {
    const ceil = 5_008_000 * tIdx;
    taxable = value <= ceil ? 0 : (realGain * (value - ceil)) / value;
  }
  const shevach = 0.25 * taxable;
  const sideV = valueOf(sideLots);
  const sideGain = Math.max(0, sideV - basisOf(sideLots));
  const spV = valueOf(spLots);
  const spGain = Math.max(0, spV - basisOf(spLots));
  const threshold = 721_560 * tIdx;
  const reBase = (taxable > 0 && value > 5_385_285 * tIdx ? taxable : 0) + sideGain;
  const reSurtax = 0.05 * Math.max(0, reBase - threshold);
  const spSurtax = 0.05 * Math.max(0, spGain - threshold);

  const realEstate =
    value - sellCosts - mort.balanceAfter(N) - dpLoan.balanceAfter(N) - shevach - reSurtax + sideV - 0.25 * sideGain + idle;
  const sp500 = spV - 0.25 * spGain - spSurtax - spLoan.balanceAfter(N);
  return { price, realEstate, sp500, rentTaxTotal, shevach, spTax: 0.25 * spGain };
}
