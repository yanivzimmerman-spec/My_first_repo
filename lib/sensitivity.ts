/**
 * "What flips the result": for a few key assumptions, the value at which the two tracks end
 * equal, found by bisection on the existing engine (nothing in the engine changes).
 */
import { simulate, sanitizeInputs, BOUNDS, CPI_REAL_RATE_GAP, type SimInputs } from "./calculator.ts";

export type FlipKey = "appreciation" | "spReturn" | "mortgageRate";

export interface Flip {
  key: FlipKey;
  /** Current assumption */
  current: number;
  /** Value where the leader changes, or null when it doesn't within the allowed range */
  flipAt: number | null;
  /** Range searched */
  min: number;
  max: number;
  /** Who leads now (by the engine's sign; a tie counts as the apartment) */
  leader: "realEstate" | "sp500";
}

export const FLIP_LABEL: Record<FlipKey, string> = {
  appreciation: "עליית מחירי הדירות",
  spReturn: "תשואת ה-S&P 500 (בדולרים)",
  mortgageRate: "ריבית המשכנתא",
};

/** Inputs with one assumption set (the mortgage rate is set by hand, CPI track follows it). */
function withValue(x: SimInputs, key: FlipKey, v: number): SimInputs {
  if (key === "mortgageRate") return { ...x, autoRate: false, mortgageRate: v, cpiRealRate: Math.max(BOUNDS.cpiRealRate.min, v - CPI_REAL_RATE_GAP) };
  return { ...x, [key]: v };
}

const gapAt = (x: SimInputs, key: FlipKey, v: number) => {
  const r = simulate(withValue(x, key, v));
  return r.realEstate.netWorth - r.sp500.netWorth;
};

export function flipPoint(raw: SimInputs, key: FlipKey, iterations = 24): Flip {
  const x = sanitizeInputs(raw);
  const { min, max } = BOUNDS[key];
  const current = x[key];
  const now = gapAt(x, key, current);
  const leader = now >= 0 ? "realEstate" : "sp500";
  // Search from the current value towards the end of the range where the other track gains
  const otherGainsUpward = key === "appreciation" ? leader === "sp500" : leader === "realEstate";
  const far = otherGainsUpward ? max : min;
  const sideOf = (g: number) => (g >= 0 ? "realEstate" : "sp500");
  if (sideOf(gapAt(x, key, far)) === leader) return { key, current, flipAt: null, min, max, leader };
  let a = current;
  let b = far;
  for (let i = 0; i < iterations; i++) {
    const mid = (a + b) / 2;
    if (sideOf(gapAt(x, key, mid)) === leader) a = mid;
    else b = mid;
  }
  return { key, current, flipAt: b, min, max, leader };
}

export function flips(x: SimInputs): Flip[] {
  return (["appreciation", "spReturn", "mortgageRate"] as FlipKey[]).map((k) => flipPoint(x, k));
}

/** Plain sentence for one assumption. */
export function flipSentence(f: Flip): string {
  const pct = (v: number) => `${v.toFixed(1)}%`;
  const other = f.leader === "realEstate" ? "ה-S&P 500 מוביל" : "הדירה מובילה";
  const label = FLIP_LABEL[f.key];
  if (f.flipAt === null)
    return `${label}: גם בכל הטווח (${pct(f.min)} עד ${pct(f.max)}) התוצאה לא מתהפכת. הנחתם ${pct(f.current)}.`;
  const up = f.flipAt > f.current;
  const delta = Math.abs(f.flipAt - f.current);
  return `${label}: אם ${up ? "תעלה מעל " : "תרד מתחת ל-"}${pct(f.flipAt)}, ${other}. הנחתם ${pct(f.current)} (פער של ${delta.toFixed(1)} נקודות).`;
}
