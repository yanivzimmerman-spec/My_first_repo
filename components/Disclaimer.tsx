"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "disclaimer-seen";
let seenThisVisit = false;

function seen(): boolean {
  if (seenThisVisit) return true;
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  seenThisVisit = true;
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked: remembered for this page load only */
  }
}

/**
 * Short notice shown once per visit, before the first result and before the guided path:
 * a simulation on assumptions the user chose, not investment, tax or mortgage advice.
 */
export default function Disclaimer({ show }: { show: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (show && !seen()) setOpen(true);
  }, [show]);

  useEffect(() => {
    if (!open) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      // Keep focus inside the dialog: it has a single control
      if (e.key === "Tab") {
        e.preventDefault();
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    markSeen();
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        aria-describedby="disclaimer-text"
        className="w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="disclaimer-title" className="text-lg font-bold text-slate-900">
          לפני שממשיכים
        </h2>
        <div id="disclaimer-text" className="mt-2 space-y-2 text-[14.5px] leading-relaxed text-slate-700">
          <p>זו סימולציה שמחשבת לפי ההנחות שאתם בוחרים.</p>
          <p>היא לא ייעוץ השקעות, לא ייעוץ מס ולא ייעוץ משכנתאות, ולא מתחשבת בכל הצרכים שלכם.</p>
        </div>
        <button
          ref={button}
          type="button"
          onClick={close}
          className="mt-5 w-full rounded-full bg-slate-900 px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-slate-700"
        >
          הבנתי
        </button>
      </div>
    </div>
  );
}
