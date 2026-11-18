"use client";

import type { ReactNode } from "react";

export function Switch({
  checked,
  onChange,
  label,
  accent = "#0F172A",
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
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
      style={{ background: checked ? accent : "#CBD5E1" }}
    >
      {/* RTL: "off" knob sits on the right, "on" slides left */}
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "-translate-x-[22px]" : "-translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  accent = "#0F172A",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  accent?: string;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              active ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
            style={active ? { color: accent } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
