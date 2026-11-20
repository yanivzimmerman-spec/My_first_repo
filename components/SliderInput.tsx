"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import type { Bound } from "@/lib/calculator";
import { formatNumber, parseLooseNumber } from "@/lib/format";

type Kind = "currency" | "percent" | "years" | "months";

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
  /** "Where does this come from?": a short note behind an info button */
  info?: ReactNode;
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
  info,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const span = bound.max - bound.min;
  const pct = span > 0 ? ((value - bound.min) / span) * 100 : 100;

  // Live while typing: apply a valid number after a short pause; Enter / leaving the field commit at once
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (typing.current) clearTimeout(typing.current);
  }, []);
  const apply = (s: string) => {
    const n = parseLooseNumber(s);
    if (Number.isFinite(n)) onChange(Math.min(bound.max, Math.max(bound.min, n)));
  };
  const commit = (s: string) => {
    if (typing.current) clearTimeout(typing.current);
    apply(s);
    setDraft(null);
  };
  const onType = (s: string) => {
    setDraft(s);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => {
      const n = parseLooseNumber(s);
      // Only values inside the range apply live (a half-typed number like "1" for 1,500,000 waits for Enter)
      if (Number.isFinite(n) && n >= bound.min && n <= bound.max) onChange(n);
    }, 400);
  };

  const prefix = kind === "currency" ? "₪" : "";
  const suffix = kind === "percent" ? "%" : kind === "years" ? " שנים" : kind === "months" ? " חודשים" : "";
  const width = kind === "currency" ? "w-[78px]" : kind === "years" || kind === "months" ? "w-[24px]" : "w-[40px]";

  return (
    <div>
      <div className={`mb-2.5 flex items-center justify-between gap-3 ${disabled ? "opacity-60" : ""}`}>
        <span className="flex items-center gap-1">
          <label htmlFor={id} className="text-[15px] text-slate-700">
            {label}
          </label>
          {info && (
            <button
              type="button"
              aria-expanded={infoOpen}
              aria-controls={`${id}-info`}
              aria-label={`מאיפה זה: ${label}`}
              title="מאיפה זה?"
              onClick={() => setInfoOpen((o) => !o)}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${infoOpen ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
            >
              <Info size={15} aria-hidden />
            </button>
          )}
        </span>
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
            onChange={(e) => onType(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                if (typing.current) clearTimeout(typing.current);
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
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${Math.min(100, Math.max(0, pct))}%`, ["--accent" as string]: accent }}
      />
      {info && infoOpen && (
        <p id={`${id}-info`} className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
          {info}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-[13px] leading-relaxed text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
