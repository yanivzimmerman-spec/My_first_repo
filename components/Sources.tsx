import { ExternalLink } from "lucide-react";
import { SOURCES, type SourceId } from "@/lib/sources";

/** Small "מקור:" line with links that open in a new tab. */
export default function Sources({ ids, className = "" }: { ids: SourceId[]; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500 ${className}`}>
      <span>מקור:</span>
      {ids.map((id) => (
        <a
          key={id}
          href={SOURCES[id].url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          {SOURCES[id].label}
          <ExternalLink size={11} aria-hidden />
        </a>
      ))}
    </p>
  );
}
