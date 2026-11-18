"use client";

import type { ReactNode } from "react";

/** Terminal toggle: [ON]/[OFF] block switch. */
export function Switch({
  checked,
  onChange,
  label,
  accent = "var(--color-amber)",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      dir="ltr"
      className="flex shrink-0 items-center border border-term-line font-mono text-[11px] font-semibold leading-none"
    >
      <span
        className="px-2 py-1.5 transition-colors"
        style={checked ? { background: accent, color: "#0E1110" } : { color: "var(--color-term-dim)" }}
      >
        ON
      </span>
      <span
        className="px-2 py-1.5 transition-colors"
        style={!checked ? { background: "var(--color-term-line)", color: "var(--color-term-text)" } : { color: "var(--color-term-dim)" }}
      >
        OFF
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  accent = "var(--color-amber)",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  accent?: string;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid auto-cols-fr grid-flow-col border border-term-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2 text-sm font-semibold transition-colors ${
              active ? "" : "text-term-dim hover:text-term-text"
            }`}
            style={active ? { background: accent, color: "#fff" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
