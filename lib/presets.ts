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
    description: "דירה ראשונה, ₪500K הון עצמי, 20 שנה",
    inputs: { ...DEFAULT_INPUTS, equity: 500_000, years: 20, propertyPrice: 1_800_000, isFirstApartment: true },
  },
  {
    id: "second",
    label: "משפרי דיור / דירה שנייה",
    description: "דירה נוספת, ₪1M הון עצמי, מימון 50%",
    inputs: { ...DEFAULT_INPUTS, equity: 1_000_000, years: 15, propertyPrice: 1_650_000, isFirstApartment: false },
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
      spReturn: 7,
      inflation: 3,
    },
  },
];
