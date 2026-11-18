import type { SimResult } from "./calculator";

export interface Reason {
  /** Which track this factor helps */
  favors: "realEstate" | "sp500";
  /** Size in ₪, used for ranking */
  amount: number;
  /** Builds the sentence; formatting is injected so this file stays UI-free */
  text: (fmt: (n: number) => string) => string;
}

/**
 * Three plain-language reasons behind the result: what each track gained,
 * plus the single biggest cost that tipped the balance. Winner's gain first.
 */
export function topReasons(r: SimResult): Reason[] {
  const re = r.realEstate;
  const sp = r.sp500;
  const y = r.inputs.years;
  const leverage = r.inputs.equity > 0 ? re.propertyPrice / r.inputs.equity : 0;

  const gains: Reason[] = [
    {
      favors: "realEstate",
      amount: re.finalPropertyValue - re.propertyPrice,
      text: (f) =>
        `מחיר הדירה עלה ב-${f(re.finalPropertyValue - re.propertyPrice)} ב-${y} שנה. המשכנתא נותנת לכם את כל העלייה על דירה ששווה פי ${leverage.toFixed(1)} מהכסף שלכם.`,
    },
    {
      favors: "sp500",
      amount: Math.max(0, sp.grossGain),
      text: (f) => `ההשקעה במדד צמחה ב-${f(Math.max(0, sp.grossGain))}, בלי הוצאות שוטפות.`,
    },
  ];

  const costs: Reason[] = [
    {
      favors: "sp500",
      amount: re.totalInterestPaid + re.extraLoanInterestPaid,
      text: (f) => `על המשכנתא${re.extraLoanPrincipal > 0 ? " וההלוואה" : ""} שילמתם ${f(re.totalInterestPaid + re.extraLoanInterestPaid)} ריבית לבנק.`,
    },
    {
      favors: "sp500",
      amount: re.purchaseTax + re.closingCosts + re.sellingCosts,
      text: (f) => `מס רכישה, עמלות ועלויות קנייה ומכירה עלו לדירה ${f(re.purchaseTax + re.closingCosts + re.sellingCosts)}.`,
    },
    {
      favors: "sp500",
      amount: re.totalVacancyLoss + re.totalOwnershipCosts + re.totalRentTax,
      text: (f) =>
        `חודשים פנויים, תחזוקה, ביטוח ומס על השכירות הורידו ${f(re.totalVacancyLoss + re.totalOwnershipCosts + re.totalRentTax)} מהשכירות.`,
    },
  ];

  const reSaleTax = re.shevachTax + re.surtax + re.sideFundTax;
  const spSaleTax = sp.capitalGainsTax + sp.surtax;
  if (Math.abs(spSaleTax - reSaleTax) > 0) {
    costs.push({
      favors: spSaleTax > reSaleTax ? "realEstate" : "sp500",
      amount: Math.abs(spSaleTax - reSaleTax),
      text: (f) =>
        spSaleTax > reSaleTax
          ? `במכירה ה-S&P משלם ${f(spSaleTax)} מס, והדירה ${reSaleTax < 1 ? "פטורה" : `רק ${f(reSaleTax)}`}.`
          : `במכירה הדירה משלמת ${f(reSaleTax)} מס, וה-S&P רק ${f(spSaleTax)}.`,
    });
  }

  if (r.winner === "sp500") gains.reverse();
  const biggestCost = costs.filter((x) => x.amount > 1).sort((a, b) => b.amount - a.amount)[0];
  return [...gains.filter((x) => x.amount > 1), ...(biggestCost ? [biggestCost] : [])];
}
