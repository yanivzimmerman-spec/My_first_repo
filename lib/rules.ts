/**
 * Israeli tax and regulation rules used by the engine: one place for every value, its source
 * and the date it was last checked. Rules change, and temporary orders expire: when a check is
 * more than a year old the site says the numbers may be out of date.
 *
 * Changing a value here changes results. Run `npm test` and explain any change in the cards.
 */
import type { SourceId } from "./sources.ts";

// ---------------------------------------------------------------------------
// Values
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

/**
 * Dividend withholding drag inside the fund, per year of fund value
 * (~1.27% S&P yield × 25% US withholding for an Israeli fund, × 15% for an Irish UCITS ETF).
 */
export const DIVIDEND_DRAG = { israeli: 0.0032, irish: 0.0019 } as const;

/** Urban renewal (optional): betterment levy share of the uplift, years without income while building */
export const RENEWAL_LEVY_RATE = 0.25;

/** Notional depreciation the Tax Authority deducts for rented years (contested in court) */
export const DEPRECIATION_RATE = 0.02;


// ---------------------------------------------------------------------------
// What each value is, where it comes from, when it was checked
// ---------------------------------------------------------------------------

/** Purchase tax on an additional apartment: temporary order, purchases up to this date */
export const ADDITIONAL_PURCHASE_TAX_ORDER_END = "2027-02-10";

export interface Rule {
  id: string;
  /** Hebrew name shown on the "how it's calculated" page */
  title: string;
  /** The value in plain Hebrew */
  value: string;
  sources: SourceId[];
  /** ISO date the value was last checked against its source */
  checked: string;
  /** ISO date a temporary rule ends, if any */
  expires?: string;
}

const CHECKED = "2026-11-19";

export const RULES: Rule[] = [
  {
    id: "purchaseTaxSingle",
    title: "מס רכישה: דירה יחידה ומשפרי דיור",
    value: "0% עד ₪1,978,745 · 3.5% עד ₪2,347,040 · 5% עד ₪6,055,070 · 8% עד ₪20,183,565 · 10% מעל. המדרגות קפואות עד 15.1.2028",
    sources: ["purchaseTax", "taxSimulator", "freezeLaw"],
    checked: CHECKED,
  },
  {
    id: "purchaseTaxAdditional",
    title: "מס רכישה: דירה נוספת",
    value: "8% עד ₪6,055,070 · 10% מעל. הוראת שעה לרכישות עד 10.2.2027",
    sources: ["purchaseTax", "taxSimulator"],
    checked: CHECKED,
    expires: ADDITIONAL_PURCHASE_TAX_ORDER_END,
  },
  {
    id: "upgraderSale",
    title: "משפרי דיור: מכירת הדירה הקודמת",
    value: "מס רכישה כמו דירה יחידה, בתנאי שהדירה הקודמת נמכרת בזמן שהחוק קובע",
    sources: ["upgrader"],
    checked: CHECKED,
  },
  {
    id: "vat",
    title: "מע״מ על עמלות תיווך ועורך דין",
    value: "18%",
    sources: ["taxSimulator"],
    checked: CHECKED,
  },
  {
    id: "rentTax",
    title: "מס על הכנסה משכירות",
    value: "פטור עד ₪5,654 בחודש לכל משק הבית (קפוא עד סוף 2027), פטור חלקי עד פי 2 מהתקרה, או מסלול 10% על כל השכירות",
    sources: ["rentTax"],
    checked: CHECKED,
  },
  {
    id: "ownRentDeduction",
    title: "קיזוז שכר דירה במסלול 10%",
    value: "בעל דירה יחידה שגר בשכירות מקזז את השכירות שהוא משלם, עד ₪90,000 בשנה",
    sources: ["ownRentDeduction"],
    checked: CHECKED,
  },
  {
    id: "shevach",
    title: "מס שבח",
    value: "25% על הרווח הריאלי. דירה יחידה פטורה עד ₪5,008,000 (קפוא עד סוף 2027), אחרי 18 חודשי בעלות",
    sources: ["shevach"],
    checked: CHECKED,
  },
  {
    id: "capitalGains",
    title: "מס רווחי הון על השקעה במדד",
    value: "25% על הרווח הריאלי (בקרן ישראלית) או על הרווח מעל שער הדולר (ב-ETF אירי)",
    sources: ["sp500Tax"],
    checked: CHECKED,
  },
  {
    id: "surtax",
    title: "מס יסף",
    value: "5% על הכנסה מעל ₪721,560 בשנה. מכירת דירה שאינה פטורה נכללת רק מעל ₪5,385,285",
    sources: ["surtax"],
    checked: CHECKED,
  },
  {
    id: "ltv",
    title: "מגבלות מימון (בנק ישראל)",
    value: "עד 75% לדירה יחידה, 70% למשפרי דיור שעוד לא מכרו, 50% לדירה נוספת",
    sources: ["boi329", "boiQA"],
    checked: CHECKED,
  },
  {
    id: "pti",
    title: "יחס החזר להכנסה (בנק ישראל)",
    value: "עד 50% מההכנסה הפנויה. מעל 40% הבנק רואה בזה סיכון גבוה",
    sources: ["boi329"],
    checked: CHECKED,
  },
  {
    id: "dividends",
    title: "מס על דיבידנדים בתוך הקרן",
    value: "כ-0.32% בשנה בקרן ישראלית, כ-0.19% ב-ETF אירי (ניכוי מס במקור בארה״ב)",
    sources: ["sp500Tax"],
    checked: CHECKED,
  },
  {
    id: "renewal",
    title: "היטל השבחה בהתחדשות עירונית (אם בוחרים)",
    value: "25% מעליית הערך",
    sources: [],
    checked: CHECKED,
  },
  {
    id: "depreciation",
    title: "פחת רעיוני על דירה מושכרת (אם בוחרים)",
    value: "2% בשנה על כשני שלישים מהמחיר",
    sources: [],
    checked: CHECKED,
  },
];

const DAY = 86_400_000;

/** Rules whose check is more than a year old on `today`. */
export function staleRules(today: Date = new Date()): Rule[] {
  return RULES.filter((r) => today.getTime() - new Date(r.checked).getTime() > 365 * DAY);
}

/** The additional-apartment purchase-tax order has passed its end date on `today`. */
export function additionalTaxOrderExpired(today: Date = new Date()): boolean {
  return today.getTime() > new Date(`${ADDITIONAL_PURCHASE_TAX_ORDER_END}T23:59:59`).getTime();
}
