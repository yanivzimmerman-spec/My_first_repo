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
  hint?: ReactNode;
  /** CSS color for the slider fill + thumb ring */
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

/** Terminal-style "order ticket" field: label, mono readout, slider. Lives on the dark panel. */
export default function SliderInput({
  label,
  value,
  bound,
  onChange,
  kind,
  hint,
  accent = "var(--color-amber)",
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
    <div className={disabled ? "opacity-45" : ""}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <label
          htmlFor={id}
          className={highlight ? "text-[15px] font-semibold text-term-text" : "text-[13px] font-medium text-term-dim"}
        >
          {label}
        </label>
        <div
          dir="ltr"
          className={`flex items-baseline gap-1 border-b font-mono focus-within:border-amber ${
            highlight ? "border-term-dim pb-0.5" : "border-term-line"
          }`}
        >
          {kind === "currency" && <span className="text-xs text-term-dim">{unit}</span>}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            className={`bg-transparent text-left font-semibold tabular-nums text-term-text outline-none ${
              highlight ? "text-xl" : "text-[15px]"
            } ${kind === "currency" ? (highlight ? "w-[112px]" : "w-[92px]") : kind === "years" ? "w-[30px]" : "w-[48px]"}`}
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
          {kind !== "currency" && <span className="font-sans text-xs text-term-dim">{unit}</span>}
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
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-term-dim">{hint}</p>}
    </div>
  );
}
