/* Compares the engine with the independent reference model on random and extreme inputs. */
import { simulate, BOUNDS, DEFAULT_INPUTS, type SimInputs } from "../lib/calculator.ts";
import { referenceModel } from "./reference-model.ts";

let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const cases: Partial<SimInputs>[] = [];
for (let n = 0; n < 5000; n++) {
  const c: Record<string, unknown> = {};
  for (const [k, b] of Object.entries(BOUNDS)) {
    const r = rand();
    c[k] = r < 0.08 ? b.min : r < 0.16 ? b.max : b.min + rand() * (b.max - b.min);
  }
  c.years = Math.round(c.years as number);
  for (const k of ["autoPrice", "useBroker", "cashflowMatching", "loanEnabled", "spLoanEnabled", "sellFirst", "liveInNew", "incomeCheck"]) c[k] = rand() < 0.5;
  c.apartmentType = pick(["single", "upgrader", "additional"]);
  c.spVehicle = pick(["israeli", "irish"]);
  cases.push(c as Partial<SimInputs>);
}
cases.push(DEFAULT_INPUTS, { ...DEFAULT_INPUTS, apartmentType: "upgrader", sellFirst: false, equity: 0, oldHomeMortgage: 1_500_000 });

let worst = 0;
let fails = 0;
for (const c of cases) {
  const e = simulate(c);
  const r = referenceModel(c);
  const tol = (v: number) => Math.max(1, Math.abs(v) * 1e-7);
  const dRe = Math.abs(e.realEstate.netWorth - r.realEstate);
  const dSp = Math.abs(e.sp500.netWorth - r.sp500);
  const dTax = Math.abs(e.realEstate.totalRentTax - r.rentTaxTotal);
  const bad = e.realEstate.propertyPrice !== r.price || dRe > tol(r.realEstate) || dSp > tol(r.sp500) || dTax > tol(r.rentTaxTotal) ||
    Math.abs(e.realEstate.shevachTax - r.shevach) > tol(r.shevach) || Math.abs(e.sp500.capitalGainsTax - r.spTax) > tol(r.spTax);
  worst = Math.max(worst, dRe / Math.max(1, Math.abs(r.realEstate)), dSp / Math.max(1, Math.abs(r.sp500)));
  if (bad) {
    fails++;
    if (fails <= 3)
      console.error("MISMATCH", JSON.stringify({ price: [e.realEstate.propertyPrice, r.price], re: [e.realEstate.netWorth, r.realEstate], sp: [e.sp500.netWorth, r.sp500], rentTax: [e.realEstate.totalRentTax, r.rentTaxTotal], shevach: [e.realEstate.shevachTax, r.shevach], input: e.inputs }));
  }
}
console.log(`Reference model: ${cases.length} cases, worst relative gap ${worst.toExponential(1)}`);
if (fails) { console.error(`${fails} mismatch(es)`); process.exit(1); }
console.log("Engine matches the independent reference model");
