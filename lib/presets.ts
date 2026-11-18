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
    inputs: { ...DEFAULT_INPUTS, equity: 500_000, years: 20, propertyPrice: 1_800_000, apartmentType: "single" },
  },
  {
    id: "upgrader",
    label: "משפרי דיור",
    description: "מוכרים דירה קיימת, ₪1M הון עצמי, מימון עד 70%",
    inputs: { ...DEFAULT_INPUTS, equity: 1_000_000, years: 15, propertyPrice: 2_500_000, apartmentType: "upgrader" },
  },
  {
    id: "investor",
    label: "דירה שנייה להשקעה",
    description: "דירה נוספת, ₪1M הון עצמי, מימון עד 50%",
    inputs: { ...DEFAULT_INPUTS, equity: 1_000_000, years: 15, propertyPrice: 1_600_000, apartmentType: "additional" },
  },
  {
    id: "conservative",
    label: "שמרן",
    description: "ריבית 5.8%, עליית ערך 3%, S&P 7%",
    inputs: {
      ...DEFAULT_INPUTS,
      mortgageRate: 5.8,
      rentalYield: 2.8,
      appreciation: 3,
      rentGrowth: 2.5,
      spReturn: 7,
      inflation: 3,
    },
  },
];
