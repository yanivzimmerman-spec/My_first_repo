"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "theme";

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The starting theme: the viewer's saved choice, else the host page's data-theme
 * (claude.ai viewer), else the operating system setting.
 */
export function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const s = stored();
  if (s) return s;
  const host = document.documentElement.dataset.theme;
  if (host === "light" || host === "dark") return host;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function useTheme(): [Theme, () => void] {
  // null until resolved on the client, so the class set by the boot script isn't undone first
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(initialTheme());
    // Follow the OS setting until the viewer makes a choice
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!stored()) setTheme(e.matches ? "dark" : "light");
    };
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* private mode: the choice lasts for this visit only */
      }
      return next;
    });
  }, []);

  return [theme ?? "light", toggle];
}
