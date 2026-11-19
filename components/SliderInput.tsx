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
  /** Track color: slider fill and value pill */
  accent?: string;
  disabled?: boolean;
  decimals?: number;
}

function display(v: number, kind: Kind, decimals: number) {
  if (kind === "currency") return formatNumber(v);
  if (kind === "percent") return v.toFixed(decimals);
  return String(Math.round(v));
}

/** One input row: label, tappable value pill (type an exact number), slider. */
export default function SliderInput({
  label,
  value,
  bound,
  onChange,
  kind,
  hint,
  accent = "var(--accent-ink)",
  disabled,
  decimals = 2,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const span = bound.max - bound.min;
  const pct = span > 0 ? ((value - bound.min) / span) * 100 : 100;

  const commit = (s: string) => {
    const n = parseLooseNumber(s);
    if (Number.isFinite(n)) onChange(Math.min(bound.max, Math.max(bound.min, n)));
    setDraft(null);
  };

  const prefix = kind === "currency" ? "₪" : "";
  const suffix = kind === "percent" ? "%" : kind === "years" ? " שנים" : "";
  const width = kind === "currency" ? "w-[78px]" : kind === "years" ? "w-[24px]" : "w-[40px]";

  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[15px] text-slate-700">
          {label}
        </label>
        <div
          dir="ltr"
          className="flex items-center rounded-full px-3 py-1 text-[15px] font-semibold tabular-nums ring-1 ring-transparent transition focus-within:ring-2"
          style={{
            background: `color-mix(in srgb, ${accent} 8%, transparent)`,
            color: accent,
            ["--tw-ring-color" as string]: `color-mix(in srgb, ${accent} 33%, transparent)`,
          }}
        >
          {prefix && <span>{prefix}</span>}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            className={`${width} bg-transparent text-left outline-none`}
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
          {suffix && <span className="whitespace-pre">{suffix}</span>}
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
        disabled={disabled || span <= 0}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${Math.min(100, Math.max(0, pct))}%`, ["--accent" as string]: accent }}
      />
      {hint && <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}
