/* Reference values for the six situation cards (example numbers, "balanced" profile) + general
 * engine invariants. Run with `npm test`. Any change to these numbers needs an explanation. */
import { simulate, sanitizeInputs, DEFAULT_INPUTS, BOUNDS, type SimInputs } from "../lib/calculator.ts";
import { SITUATIONS, situationInputs, RISK_PROFILES } from "../lib/presets.ts";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok  ", msg);
};

const BALANCED = RISK_PROFILES[2].values;
export const cardInputs = (id: string): SimInputs =>
  sanitizeInputs({ ...DEFAULT_INPUTS, ...situationInputs(SITUATIONS.find((s) => s.id === id)!), ...BALANCED });

// realEstate.netWorth / sp500.netWorth / realEstate.totalRentTax, from the published version
const REFERENCE: Record<string, [number, number, number]> = {
  firstHome: [3_685_900, 4_295_507, 0],
  firstInvest: [2_476_179, 3_031_590, 0],
  upgrade: [4_786_283, 5_579_909, 0],
  secondInvest: [3_137_108, 4_402_084, 7_498],
  moveRentOld: [3_407_659, 4_693_823, 0],
  twoRentals: [2_433_545, 3_711_487, 169_056],
};

for (const [id, [reW, spW, tax]] of Object.entries(REFERENCE)) {
  const r = simulate(cardInputs(id));
  const got: [number, number, number] = [Math.round(r.realEstate.netWorth), Math.round(r.sp500.netWorth), Math.round(r.realEstate.totalRentTax)];
  ok(got[0] === reW && got[1] === spW && got[2] === tax, `${id.padEnd(12)} ${got.map((n) => n.toLocaleString("en-US")).join(" / ")}`);
}

// General invariants over random inputs
const keys = Object.keys(BOUNDS) as (keyof typeof BOUNDS)[];
let bad = 0;
for (let i = 0; i < 3000; i++) {
  const raw: Record<string, unknown> = {};
  for (const k of keys) {
    const b = BOUNDS[k];
    const m = Math.random();
    raw[k] = m < 0.1 ? b.min : m < 0.2 ? b.max : b.min + Math.random() * (b.max - b.min);
  }
  raw.apartmentType = ["single", "upgrader", "additional"][Math.floor(Math.random() * 3)];
  for (const k of ["liveInNew", "liveElsewhere", "autoPrice", "useBroker", "loanEnabled", "spLoanEnabled", "cashflowMatching", "sellFirst", "ownRentAuto", "urbanRenewal", "depreciation", "incomeCheck"])
    raw[k] = Math.random() < 0.5;
  raw.spVehicle = Math.random() < 0.5 ? "israeli" : "irish";
  const r = simulate(raw as Partial<SimInputs>);
  const nums = Object.values(r.realEstate).concat(Object.values(r.sp500)).filter((v): v is number => typeof v === "number");
  const taxes = [r.realEstate.totalRentTax, r.realEstate.shevachTax, r.realEstate.surtax, r.realEstate.purchaseTax, r.realEstate.sideFundTax, r.sp500.capitalGainsTax, r.sp500.surtax];
  if (nums.some((n) => !Number.isFinite(n)) || taxes.some((t) => t < -1e-6)) {
    bad++;
    if (bad < 4) console.error("bad case", JSON.stringify(raw));
  }
}
ok(bad === 0, "3,000 random inputs: no NaN, no Infinity, no negative tax");

// Monotonic in the main assumptions
let mono = 0;
for (const s of SITUATIONS) {
  const base = cardInputs(s.id);
  let prevRe = -Infinity, prevSp = -Infinity;
  for (let a = -2; a <= 10; a += 0.5) {
    const v = simulate({ ...base, appreciation: a }).realEstate.netWorth;
    if (v < prevRe - 1e-6) mono++;
    prevRe = v;
  }
  for (let sp = 0; sp <= 15; sp += 0.5) {
    const v = simulate({ ...base, spReturn: sp }).sp500.netWorth;
    if (v < prevSp - 1e-6) mono++;
    prevSp = v;
  }
}
ok(mono === 0, "apartment net worth rises with appreciation; S&P net worth rises with spReturn (all six cards)");

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll card reference checks passed");
