import { DEFAULT_INPUTS, sanitizeInputs, type SimInputs } from "./calculator";

/** Short, stable URL keys for sharing a scenario. */
const KEYS: Record<keyof SimInputs, string> = {
  equity: "e",
  years: "y",
  propertyPrice: "p",
  autoPrice: "ap",
  isFirstApartment: "f",
  mortgageRate: "mr",
  mortgageTerm: "mt",
  rentalYield: "ry",
  appreciation: "a",
  spReturn: "sr",
  spFee: "sf",
  cashflowMatching: "cm",
  inflation: "i",
};

export function inputsToQuery(inputs: SimInputs): string {
  const params = new URLSearchParams();
  (Object.keys(KEYS) as (keyof SimInputs)[]).forEach((k) => {
    const v = inputs[k];
    if (v === DEFAULT_INPUTS[k]) return;
    params.set(KEYS[k], typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  });
  return params.toString();
}

export function queryToInputs(search: string): SimInputs | null {
  const params = new URLSearchParams(search);
  let found = false;
  const raw: Partial<Record<keyof SimInputs, unknown>> = {};
  (Object.keys(KEYS) as (keyof SimInputs)[]).forEach((k) => {
    const v = params.get(KEYS[k]);
    if (v !== null) {
      found = true;
      raw[k] = typeof DEFAULT_INPUTS[k] === "boolean" ? v : Number(v);
    }
  });
  return found ? sanitizeInputs(raw) : null;
}
