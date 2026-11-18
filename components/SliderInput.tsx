"use client";

import { useId, useState, type ReactNode } from "react";
import type { Bound } from "@/lib/calculator";
import { formatNumber, parseLooseNumber } from "@/lib/format";

type Kind = "currency" | "percent" | "years";

interface Props {
  label: string;
  value: number;
  bound: Bound;
  onChange: (v: number) => void;
  kind: Kind;
  icon?: ReactNode;
  hint?: ReactNode;
  accent?: string;
  disabled?: boolean;
  highlight?: boolean;
  decimals?: number;
}

function display(v: number, kind: Kind, decimals: number) {
  if (kind === "currency") return formatNumber(v);
  if (kind === "percent") return v.toFixed(decimals);
  return String(Math.round(v));
}

export default function SliderInput({
  label,
  value,
  bound,
  onChange,
  kind,
  icon,
  hint,
  accent = "#0F172A",
  disabled,
  highlight,
  decimals = 2,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const pct = ((value - bound.min) / (bound.max - bound.min)) * 100;

  const commit = (s: string) => {
    const n = parseLooseNumber(s);
    if (Number.isFinite(n)) onChange(Math.min(bound.max, Math.max(bound.min, n)));
    setDraft(null);
  };

  const unit = kind === "currency" ? "₪" : kind === "percent" ? "%" : "שנים";

  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className={`flex items-center gap-1.5 text-slate-700 ${highlight ? "text-[15px] font-semibold" : "text-sm font-medium"}`}
        >
          {icon && <span className="text-slate-400">{icon}</span>}
          {label}
        </label>
        <div
          dir="ltr"
          className={`flex items-center gap-1 rounded-lg border bg-white px-2 focus-within:ring-2 focus-within:ring-slate-900/10 ${
            highlight ? "border-slate-300 py-1.5" : "border-slate-200 py-1"
          }`}
        >
          {kind === "currency" && <span className="text-xs text-slate-400">{unit}</span>}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            dir="ltr"
            disabled={disabled}
            aria-label={label}
            className={`bg-transparent text-left font-semibold tabular-nums text-slate-900 outline-none ${
              highlight ? "text-base" : "text-sm"
            } ${kind === "currency" ? "w-[84px]" : kind === "years" ? "w-[28px]" : "w-[44px]"}`}
            value={draft ?? display(value, kind, decimals)}
            onFocus={(e) => {
              setDraft(display(value, kind, decimals).replace(/,/g, ""));
              requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(null);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {kind !== "currency" && <span className="text-xs text-slate-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        className="range"
        aria-label={label}
        min={bound.min}
        max={bound.max}
        step={bound.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${Math.min(100, Math.max(0, pct))}%`, ["--accent" as string]: accent }}
      />
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}
