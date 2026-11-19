import { simulate, MIN_START_CAPITAL, type SimInputs, type SimResult } from "./calculator";

export interface ComboPoint {
  /** Share of the starting money that goes to the apartment, 0–100 */
  share: number;
  /** After-tax net worth at the end, or null when that share can't buy an apartment */
  value: number | null;
  price: number | null;
}

/**
 * Mixed strategy: part of the starting money buys a (smaller) apartment, the rest goes to
 * the S&P. Every mix gets the same money as the all-apartment plan: the same starting money
 * and the same monthly outlay, with whatever the apartment doesn't use invested in the S&P.
 *
 * The all-apartment plan's S&P track already holds "same money, all in the S&P". A mix is that,
 * plus the apartment part's own advantage over investing the same money in the S&P:
 *   mix(x) = S&P_full + (apartment_x − S&P_x)
 * (Approximation: surtax is applied to each part separately.)
 */
export function comboCurve(inputs: SimInputs, full: SimResult, step = 10): ComboPoint[] {
  const start = full.realEstate.startCapital;
  const points: ComboPoint[] = [];
  for (let share = 0; share <= 100; share += step) {
    if (share === 0) {
      points.push({ share, value: full.sp500.netWorth, price: null });
      continue;
    }
    if (share === 100) {
      points.push({ share, value: full.realEstate.netWorth, price: full.realEstate.propertyPrice });
      continue;
    }
    const cash = (start * share) / 100;
    if (cash < MIN_START_CAPITAL) {
      points.push({ share, value: null, price: null });
      continue;
    }
    // The old home's money (upgrader) is treated as cash already in hand
    const part = simulate({
      ...inputs,
      equity: cash,
      oldHomeMortgage: inputs.oldHomeValue,
      oldHomePrepayFee: 0,
      sellFirst: true,
    });
    points.push({
      share,
      value: full.sp500.netWorth + (part.realEstate.netWorth - part.sp500.netWorth),
      price: part.realEstate.propertyPrice,
    });
  }
  return points;
}
