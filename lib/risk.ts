import type { SimResult } from "./calculator";

/**
 * Rule-of-thumb risk gauge for each track. The core number is how much of your own money a
 * bad year could wipe out: exposure ÷ own money (leverage) × a bad-year drop for the asset.
 *  - A single apartment: −15% in a bad period (Israeli prices fell ~25% in real terms over
 *    1997–2007 and are falling again in 2025–26; a single flat swings more than the index).
 *  - The S&P 500: −35% (2008 about −50%, 2020 about −34%, 2022 about −25% in dollars).
 * Extra points for things that make a bad year harder to sit out.
 */
export const BAD_YEAR_DROP = { apartment: 0.15, sp500: 0.35 } as const;

export const RISK_LEVELS = ["נמוך", "נמוך-בינוני", "בינוני", "גבוה", "גבוה מאוד"] as const;

export interface TrackRisk {
  /** 1 (low) … 5 (very high) */
  level: number;
  label: (typeof RISK_LEVELS)[number];
  /** Exposure per shekel of own money */
  leverage: number;
  /** Share of own money a bad year could wipe out, % */
  badYearLossPct: number;
  /** Plain-language reasons, most important first */
  factors: string[];
}

function toLevel(lossPct: number, extra: number): number {
  const base = lossPct <= 15 ? 1 : lossPct <= 30 ? 2 : lossPct <= 45 ? 3 : lossPct <= 65 ? 4 : 5;
  return Math.min(5, Math.max(1, base + extra));
}

export function trackRisks(r: SimResult): { realEstate: TrackRisk; sp500: TrackRisk } {
  const re = r.realEstate;
  const sp = r.sp500;
  const x = r.inputs;
  const own = Math.max(1, re.startCapital);

  // --- Apartment ---
  const reLev = re.propertyPrice / own;
  const reLoss = Math.min(100, reLev * BAD_YEAR_DROP.apartment * 100);
  let reExtra = 0;
  const reF: string[] = [
    `על כל שקל שלכם יש ${reLev.toFixed(1)} ₪ בדירה, כך שירידה של 10% במחיר מוחקת כ-${Math.round(reLev * 10)}% מהכסף שלכם.`,
    "כל הכסף בנכס אחד, ומכירה לוקחת חודשים.",
  ];
  if (re.extraLoanPrincipal > 0) {
    reExtra += 1;
    reF.push("חלק מההון העצמי מושאל, וצריך להחזיר אותו גם אם המחיר יורד.");
  }
  if (x.variableShare > 0 || x.cpiShare > 0) {
    reF.push(`${x.variableShare + x.cpiShare}% מהמשכנתא בריבית משתנה או צמודה: ההחזר יכול לעלות.`);
    if (x.variableShare + x.cpiShare >= 50) reExtra += 1;
  }
  if (re.paymentToIncome !== null && re.paymentToIncome > 0.4) {
    reExtra += 1;
    reF.push("ההחזר החודשי מעל 40% מההכנסה הפנויה: קשה לעמוד בו אם משהו משתבש.");
  }
  if (re.initialMonthlyGap > 0 && !re.livesInNew) {
    reF.push("צריך להמשיך להוסיף כסף כל חודש, גם בחודשים בלי שוכר.");
  }
  if (re.livesInNew) reF.push("יתרון: מגן מעליית שכר הדירה ונותן ביטחון בדיור.");

  // --- S&P ---
  const spLev = (own + sp.loanPrincipal) / own;
  const spLoss = Math.min(100, spLev * BAD_YEAR_DROP.sp500 * 100);
  let spExtra = 0;
  const spF: string[] = [
    spLev > 1.01
      ? `על כל שקל שלכם יש ${spLev.toFixed(1)} ₪ במדד בגלל ההלוואה, כך שירידה של 10% מוחקת כ-${Math.round(spLev * 10)}% מהכסף שלכם.`
      : "בלי מינוף: ירידה של 10% במדד מורידה 10% מהכסף.",
    "המדד תנודתי: שנה גרועה יכולה להוריד 30% עד 50%, אבל הוא מפוזר על 500 חברות.",
    "אפשר למכור בכל יום, וגם רק חלק.",
  ];
  if (sp.loanPrincipal > 0) {
    spExtra += 1;
    spF.push("בירידה חדה הבנק יכול לדרוש החזר או למכור את המניות בשפל.");
  }
  if (x.fxDrift < 0) spF.push("שער הדולר משפיע: כשהדולר נחלש, התשואה בשקלים יורדת.");

  const reLevel = toLevel(reLoss, reExtra);
  const spLevel = toLevel(spLoss, spExtra);
  return {
    realEstate: { level: reLevel, label: RISK_LEVELS[reLevel - 1], leverage: reLev, badYearLossPct: reLoss, factors: reF },
    sp500: { level: spLevel, label: RISK_LEVELS[spLevel - 1], leverage: spLev, badYearLossPct: spLoss, factors: spF },
  };
}
