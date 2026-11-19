/**
 * Inline script for <head>: sets html.dark before the first paint, using the same
 * order as lib/theme.ts — saved choice, then the host's data-theme, then the OS setting.
 * Kept in a plain (non-"use client") module so the server layout can embed the string.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=null;try{s=localStorage.getItem("theme")}catch(e){}var h=document.documentElement.getAttribute("data-theme");var t=s==="light"||s==="dark"?s:h==="light"||h==="dark"?h:(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})();`;
