/** Wrap in an LTR isolate so "-₪1,234" never gets reordered inside Hebrew text. */
const ltr = (s: string) => `\u2066${s}\u2069`;
const num = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

/** ₪1,234,567 (Hebrew locale, no decimals, never "-0"). */
export function formatILS(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const r = Math.round(v);
  return ltr(`${r < 0 ? "-" : ""}₪${num.format(Math.abs(r))}`);
}

export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const r = Math.round(v);
  return num.format(r === 0 ? 0 : r);
}

/** Compact axis labels: ₪2.4M / ₪850K */
export function formatCompactILS(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1_000_000) return ltr(`${sign}₪${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`);
  if (a >= 1_000) return ltr(`${sign}₪${Math.round(a / 1_000)}K`);
  return ltr(`${sign}₪${Math.round(a)}`);
}

export function formatPct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return "—";
  const fixed = v.toFixed(digits);
  return `${Number(fixed) === 0 ? (0).toFixed(digits) : fixed}%`;
}

/** Parse a user-typed number: strips ₪, commas, spaces, %. */
export function parseLooseNumber(s: string): number {
  const cleaned = s.replace(/[^\d.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  return Number(cleaned);
}
