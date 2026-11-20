import { SIM_NOTE } from "@/lib/config";

/** The fixed "simulation, not a recommendation" line shown on every result and summary screen. */
export default function SimNote({ className = "" }: { className?: string }) {
  return <p className={`mt-1 text-[13px] font-medium text-slate-600 ${className}`}>{SIM_NOTE}</p>;
}
