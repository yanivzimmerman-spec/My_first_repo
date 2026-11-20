/**
 * The verdict shown to users, in today's money, with a visible tie rule. Display only: the
 * engine's own numbers are untouched.
 */
import type { SimResult } from "./calculator.ts";

/** A gap smaller than this share of the larger result counts as a tie */
export const TIE_SHARE = 0.02;
/** Israeli apartment prices, average yearly rise over the last 25 years (CBS, rounded) */
export const HISTORIC_APPRECIATION = 4.7;

export type VerdictKind = "realEstate" | "sp500" | "tie";

export interface Verdict {
  kind: VerdictKind;
  /** One word for the card */
  word: string;
  /** Final net worth of each track in today's money */
  reReal: number;
  spReal: number;
  /** |apartment − S&P| in today's money */
  gapReal: number;
  /** The tie threshold for this result, in today's money */
  tieLimit: number;
  /** Divide a nominal amount in the final year by this to get today's money */
  deflator: number;
  /** The year one track first overtakes the other for good, if it happens inside the horizon */
  crossYear: number | null;
}

export function deflatorOf(r: SimResult): number {
  return Math.pow(1 + r.inputs.inflation / 100, r.inputs.years);
}

export function verdictOf(r: SimResult): Verdict {
  const deflator = deflatorOf(r);
  const reReal = r.realEstate.netWorth / deflator;
  const spReal = r.sp500.netWorth / deflator;
  const gapReal = Math.abs(reReal - spReal);
  const tieLimit = TIE_SHARE * Math.max(Math.abs(reReal), Math.abs(spReal));
  const kind: VerdictKind = gapReal < tieLimit ? "tie" : reReal > spReal ? "realEstate" : "sp500";
  const last = r.crossovers[r.crossovers.length - 1];
  return {
    kind,
    word: kind === "realEstate" ? "דירה" : kind === "sp500" ? "S&P 500" : "תיקו",
    reReal,
    spReal,
    gapReal,
    tieLimit,
    deflator,
    crossYear: last && last.year <= r.inputs.years ? last.year : null,
  };
}

/** Plain sentence, never advice: "בהנחות שהזנתם, מסלול X מוביל ב-₪Y". */
export function verdictSentence(v: Verdict, years: number, money: (n: number) => string): string {
  if (v.kind === "tie")
    return `בהנחות שהזנתם, שני המסלולים כמעט שווים אחרי ${years} שנה: פער של ${money(v.gapReal)} בערכי היום, פחות מ-${Math.round(TIE_SHARE * 100)}%.`;
  const name = v.kind === "realEstate" ? "הדירה" : "ה-S&P 500";
  return `בהנחות שהזנתם, מסלול ${name} מוביל ב-${money(v.gapReal)} בערכי היום, אחרי ${years} שנה.`;
}
