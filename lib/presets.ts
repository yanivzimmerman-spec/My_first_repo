import { DEFAULT_INPUTS, type SimInputs } from "./calculator";

export interface Preset {
  id: string;
  label: string;
  description: string;
  inputs: SimInputs;
}

export const PRESETS: Preset[] = [
  {
    id: "young",
    label: "משקיע צעיר",
    description: "דירה יחידה, ₪500K הון עצמי, 20 שנה",
    inputs: { ...DEFAULT_INPUTS, equity: 500_000, years: 20, propertyPrice: 1_750_000, apartmentType: "single" },
  },
  {
    id: "upgrader",
    label: "משפרי דיור",
    description: "מוכרים דירה ב-₪2M (משכנתא ₪500K) וקונים ב-₪3M",
    inputs: {
      ...DEFAULT_INPUTS,
      equity: 200_000,
      years: 15,
      propertyPrice: 3_000_000,
      apartmentType: "upgrader",
      oldHomeValue: 2_000_000,
      oldHomeMortgage: 500_000,
      sellFirst: true,
    },
  },
  {
    id: "investor",
    label: "דירה שנייה להשקעה",
    description: "דירה נוספת, ₪1M הון עצמי, מימון עד 50%",
    inputs: { ...DEFAULT_INPUTS, equity: 1_000_000, years: 15, propertyPrice: 1_600_000, apartmentType: "additional" },
  },
  {
    id: "home",
    label: "קונים לגור",
    description: "דירה ראשונה לגור בה, ₪600K הון עצמי, 25 שנה",
    inputs: { ...DEFAULT_INPUTS, equity: 600_000, years: 25, propertyPrice: 2_000_000, apartmentType: "single", liveInNew: true },
  },
];

/**
 * "How conservative are you?" — one control for the assumptions about the future, applied
 * the same way to both tracks. Position 3 matches the defaults.
 */
export interface RiskProfile {
  label: string;
  description: string;
  values: Pick<SimInputs, "appreciation" | "rentGrowth" | "spReturn" | "fxDrift">;
}

export const RISK_PROFILES: RiskProfile[] = [
  { label: "שמרן מאוד", description: "מחירי דירות +2%, שכירות +2%, S&P 7% בדולרים, הדולר נחלש 1.5% בשנה", values: { appreciation: 2, rentGrowth: 2, spReturn: 7, fxDrift: -1.5 } },
  { label: "שמרן", description: "מחירי דירות +3%, שכירות +2.5%, S&P 8.5% בדולרים, הדולר נחלש 1% בשנה", values: { appreciation: 3, rentGrowth: 2.5, spReturn: 8.5, fxDrift: -1 } },
  { label: "מאוזן", description: "מחירי דירות +4%, שכירות +3%, S&P 9.5% בדולרים, הדולר נחלש 0.5% בשנה", values: { appreciation: 4, rentGrowth: 3, spReturn: 9.5, fxDrift: -0.5 } },
  { label: "אופטימי", description: "מחירי דירות +5%, שכירות +3.5%, S&P 10% בדולרים, הדולר יציב", values: { appreciation: 5, rentGrowth: 3.5, spReturn: 10, fxDrift: 0 } },
  { label: "אופטימי מאוד", description: "מחירי דירות +6%, שכירות +4%, S&P 11% בדולרים, הדולר יציב", values: { appreciation: 6, rentGrowth: 4, spReturn: 11, fxDrift: 0 } },
];

/** Which profile the current assumptions match, or -1 for a custom mix. */
export function matchRiskProfile(inputs: SimInputs): number {
  return RISK_PROFILES.findIndex((p) => (Object.keys(p.values) as (keyof RiskProfile["values"])[]).every((k) => inputs[k] === p.values[k]));
}

/** Pessimistic / optimistic scenarios around the user's own assumptions (both assets move together). */
export const SCENARIO_DELTAS = {
  pessimistic: { appreciation: -1.5, rentGrowth: -1, spReturn: -2.5, fxDrift: -0.5 },
  optimistic: { appreciation: 1.5, rentGrowth: 1, spReturn: 2, fxDrift: 0.5 },
} as const;

/**
 * Situation categories (draft, preview only): the main combinations of "do you own an apartment?"
 * and "where will you live?". Picking one sets those choices and keeps the user's numbers.
 */
export interface Situation {
  id: string;
  title: string;
  description: string;
  icon: "home" | "key" | "swap" | "plus" | "move" | "two";
  values: Pick<SimInputs, "apartmentType" | "liveInNew" | "liveElsewhere">;
}

export const SITUATIONS: Situation[] = [
  { id: "firstHome", title: "דירה ראשונה למגורים", description: "אין לנו דירה, קונים כדי לגור בה", icon: "home", values: { apartmentType: "single", liveInNew: true, liveElsewhere: false } },
  { id: "firstInvest", title: "דירה ראשונה להשקעה", description: "אין לנו דירה, קונים ומשכירים, וגרים בשכירות", icon: "key", values: { apartmentType: "single", liveInNew: false, liveElsewhere: false } },
  { id: "upgrade", title: "משפרי דיור", description: "מוכרים את הדירה שלנו וקונים אחרת לגור בה", icon: "swap", values: { apartmentType: "upgrader", liveInNew: true, liveElsewhere: false } },
  { id: "secondInvest", title: "דירה שנייה להשקעה", description: "נשארים בדירה שלנו וקונים עוד אחת להשכרה", icon: "plus", values: { apartmentType: "additional", liveInNew: false, liveElsewhere: false } },
  { id: "moveRentOld", title: "עוברים ומשכירים את הישנה", description: "קונים דירה לגור בה ומשכירים את הדירה הקיימת", icon: "move", values: { apartmentType: "additional", liveInNew: true, liveElsewhere: false } },
  { id: "twoRentals", title: "שתי דירות להשכרה", description: "גרים במקום אחר ומשכירים גם את הקיימת וגם את החדשה", icon: "two", values: { apartmentType: "additional", liveInNew: false, liveElsewhere: true } },
];

export function matchSituation(inputs: SimInputs): string | null {
  const s = SITUATIONS.find(
    (x) =>
      x.values.apartmentType === inputs.apartmentType &&
      x.values.liveInNew === inputs.liveInNew &&
      (inputs.apartmentType !== "additional" || x.values.liveElsewhere === inputs.liveElsewhere),
  );
  return s ? s.id : null;
}
