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
  const iM = Math.pow(1 + x.inflation / 100, 1 / 12) - 1;

  // --- Mortgage tracks, each in closed form -----------------------------------
  const cpiL = (mortgage * x.cpiShare) / 100;
  const varL = (mortgage * x.variableShare) / 100;
  const fixL = mortgage - cpiL - varL;
  const fixed = annuity(fixL, x.mortgageRate, x.mortgageTerm);
  const var0 = annuity(varL, x.mortgageRate, x.mortgageTerm);
  // the variable rate changes from month 13: re-amortise the year-1 balance over the remaining term
  const shocked = x.rateShock !== 0 && varL > 0;
  const var1 = shocked
    ? annuity(var0.balanceAfter(12), Math.max(0.1, x.mortgageRate + x.rateShock), x.mortgageTerm - 1)
    : var0;
  const varPay = (m: number) => (!shocked || m <= 12 ? var0.paymentIn(m) : var1.paymentIn(m - 12));
  const varBal = (k: number) => (!shocked || k <= 12 ? var0.balanceAfter(k) : var1.balanceAfter(k - 12));
  const cpiReal = annuity(cpiL, x.cpiRealRate, x.mortgageTerm); // real annuity; payment & balance × CPI index
  const cpiPay = (m: number) => cpiReal.paymentIn(m) * Math.pow(1 + iM, m);
  const cpiBal = (k: number) => cpiReal.balanceAfter(k) * Math.pow(1 + iM, k);
  const mortPay = (m: number) => fixed.paymentIn(m) + varPay(m) + cpiPay(m);
  const mortBal = (k: number) => fixed.balanceAfter(k) + varBal(k) + cpiBal(k);

  const dpLoan = annuity(loan, x.loanRate, x.loanTerm);
  const spLoanP = x.spLoanEnabled ? x.spLoanAmount : 0;
  const spLoan = annuity(spLoanP, x.spLoanRate, x.spLoanTerm);

  // --- Apartment value: market growth minus age drag, optional renewal jump ---
  const g = (x.appreciation - x.ageDrag) / 100;
  const renewal = x.urbanRenewal && x.renewalYear <= x.years;
  const valueAt = (month: number) =>
    price * Math.pow(1 + g, month / 12) * (renewal && month >= x.renewalYear * 12 ? 1 + x.renewalUplift / 100 : 1);
  const building = (m: number) => renewal && m > (x.renewalYear - 3) * 12 && m <= x.renewalYear * 12;

  // --- Fund lots (shekel return includes the dollar drift) ---------------------
  const drag = x.spVehicle === "israeli" ? 0.0032 : 0.0019;
  const fx = x.fxDrift / 100;
  const annual = Math.max(-0.99, (1 + x.spReturn / 100) * (1 + fx) * (1 - x.spFee / 100) - 1 - drag);
  const rM = Math.pow(1 + annual, 1 / 12) - 1;
  // basis index: CPI for an Israeli fund, the dollar for an Irish ETF
  const bM = x.spVehicle === "israeli" ? iM : Math.pow(1 + fx, 1 / 12) - 1;
  type Lot = { amount: number; month: number };
  const valueOf = (lots: Lot[]) => lots.reduce((s, l) => s + l.amount * Math.pow(1 + rM, N - l.month), 0);
  const basisOf = (lots: Lot[]) => lots.reduce((s, l) => s + l.amount * Math.pow(1 + bM, N - l.month), 0);

  // keren hishtalmut: the S&P track leaves it in the fund (own fee, tax-free); the apartment track spends it
  const keren = Math.min(x.hishtalmutAmount, x.equity);
  const kerenAnnual = Math.max(-0.99, (1 + x.spReturn / 100) * (1 + fx) * (1 - x.hishtalmutFee / 100) - 1 - 0.0032);
  const kerenEnd = keren * Math.pow(1 + kerenAnnual, x.years);
  const spLots: Lot[] = [{ amount: ownStart - keren + spLoanP, month: 0 }];
  const sideLots: Lot[] = extraAtStart > 0 ? [{ amount: extraAtStart, month: 0 }] : [];
  let idle = 0;
  let rentTaxTotal = 0;
  const both = additional && x.liveElsewhere;
  const rentOld = additional && x.liveInNew && !both;

  for (let m = 1; m <= N; m++) {
    const y = Math.floor((m - 1) / 12);
    const growth = Math.pow(1 + x.rentGrowth / 100, y);
    const cpiY = Math.pow(1 + x.inflation / 100, y);
    const rebuilding = building(m);
    const newIdle = rebuilding && !rentOld; // the new apartment yields nothing while rebuilt
    // Additional apartment + moving in: the old apartment is the one rented out
    // the old apartment's rent: what the household reported, else its value × the yield
    const oldRent = (x.oldHomeRent > 0 ? x.oldHomeRent : (x.oldHomeValue * x.rentalYield) / 1200) * growth;
    const gross = newIdle ? 0 : rentOld ? oldRent : ((price * x.rentalYield) / 1200) * growth;
    const received = living ? gross : (gross * 11) / 12;
    const rentElsewhere = rebuilding && rentOld ? ((price * x.rentalYield) / 1200) * growth : 0;
    const ceiling = 5_654 * Math.pow(1 + x.inflation / 100, y); // frozen in year 1 (2027), indexed after
    const householdTax = (rent: number, deduction: number) => {
      if (rent <= ceiling) return 0;
      const exemptPart = Math.max(0, Math.min(ceiling, 2 * ceiling - rent));
      return Math.min(0.1 * (rent - exemptPart), 0.1 * Math.max(0, rent - deduction));
    };
    let rentTax = 0;
    if (both) {
      // the old apartment is rented in both tracks; count only the extra tax the new rent causes
      const oldReceived = (oldRent * 11) / 12;
      rentTax = householdTax(oldReceived + received, 0) - householdTax(oldReceived, 0);
    } else if (!living) {
      const ownRent = additional ? 0 : x.ownRentAuto ? gross : x.ownRentPaid;
      rentTax = householdTax(received, Math.min(ownRent, 7_500));
    }
    rentTaxTotal += rentTax;
    const balStart = mortBal(m - 1);
    const running =
      0.08 * received +
      (living || newIdle ? 0 : (x.vacancyOwnerCost / 12) * cpiY) +
      (living ? 0 : (received * x.managementFee) / 100) +
      (rebuilding ? 0 : ((x.capexRate / 100) * valueAt(m)) / 12) +
      50 * cpiY +
      (100 * balStart) / 1e6 +
      rentElsewhere;
    // moving into the new apartment: the S&P track lives in the old one, so count the housing difference
    const housing = rentOld ? ((price * x.rentalYield) / 1200) * growth - oldRent : 0;
    const netRent = received - rentTax - running + housing;

    const apartmentOut = mortPay(m) + dpLoan.paymentIn(m) - netRent;
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
  const value = valueAt(N);
  const sellCosts = value * feeRate(x.useBroker);
  const levy = renewal ? 0.25 * price * Math.pow(1 + g, x.renewalYear) * (x.renewalUplift / 100) : 0;
  const dep = x.depreciation && additional && !rentOld ? Math.min(1, 0.02 * x.years) * (2 / 3) * price : 0;
  const lastYear = Math.max(0, x.years - 1);
  const sellDelay =
    !living && !rentOld
      ? x.monthsToSell *
        (((price * x.rentalYield) / 1200) * Math.pow(1 + x.rentGrowth / 100, lastYear) +
          x.vacancyOwnerCost * Math.pow(1 + x.inflation / 100, lastYear))
      : 0;
  const realGain = Math.max(0, value - sellCosts - levy - ((price + pTax + closing) * Math.pow(1 + iM, N) - dep));
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
  // portfolios sold over saleYears equal parts, the surtax counted per year; the apartment sale is in year one
  const yrs = x.saleYears;
  const st = (v: number) => 0.05 * Math.max(0, v - threshold);
  const reSurtax = st(reBase - sideGain + sideGain / yrs) + (yrs - 1) * st(sideGain / yrs);
  const spSurtax = yrs * st(spGain / yrs);

  const realEstate =
    value - sellCosts - levy - sellDelay - mortBal(N) - dpLoan.balanceAfter(N) - shevach - reSurtax + sideV - 0.25 * sideGain + idle;
  const sp500 = spV - 0.25 * spGain - spSurtax - spLoan.balanceAfter(N) + kerenEnd;
  return { price, realEstate, sp500, rentTaxTotal, shevach, spTax: 0.25 * spGain };
}
