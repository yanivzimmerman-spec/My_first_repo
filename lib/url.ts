import { DEFAULT_INPUTS, sanitizeInputs, type SimInputs } from "./calculator";

/** Short, stable URL keys for sharing a scenario. */
const KEYS: Record<keyof SimInputs, string> = {
  equity: "e",
  years: "y",
  propertyPrice: "p",
  autoPrice: "ap",
  apartmentType: "t",
  useBroker: "b",
  mortgageRate: "mr",
  mortgageTerm: "mt",
  rentalYield: "ry",
  rentGrowth: "rg",
  appreciation: "a",
  spReturn: "sr",
  spFee: "sf",
  spVehicle: "v",
  cashflowMatching: "cm",
  inflation: "i",
  loanEnabled: "l",
  loanAmount: "la",
  loanRate: "lr",
  loanTerm: "lt",
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
  const raw: Record<string, unknown> = {};
  (Object.keys(KEYS) as (keyof SimInputs)[]).forEach((k) => {
    const v = params.get(KEYS[k]);
    if (v !== null) {
      found = true;
      raw[k] = typeof DEFAULT_INPUTS[k] === "number" ? Number(v) : v;
    }
  });
  // Legacy links: f=1 single / f=0 additional
  const legacy = params.get("f");
  if (legacy !== null) {
    found = true;
    raw.isFirstApartment = legacy;
  }
  return found ? sanitizeInputs(raw) : null;
}
