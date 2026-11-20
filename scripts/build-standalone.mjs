// Builds the whole app into one self-contained HTML file: dist/index.html
// `node scripts/build-standalone.mjs plan` builds the planner test environment into dist/plan.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { basename } from "node:path";

const TARGETS = {
  main: { entry: "standalone/entry.tsx", out: "dist/index.html", title: "נדל״ן מול סנופי" },
  plan: { entry: "standalone/plan-entry.tsx", out: "dist/plan.html", title: "לפני היועץ (טיוטה)" },
  suite: { entry: "standalone/suite-entry.tsx", out: "dist/suite.html", title: "נדל״ן מול סנופי" },
  flow: { entry: "standalone/flow-entry.tsx", out: "dist/flow.html", title: "נדל״ן מול סנופי" },
};
const target = TARGETS[process.argv[2] ?? "main"];
if (!target) throw new Error(`Unknown target: ${process.argv[2]}`);
const { entry, out } = target;
mkdirSync("dist", { recursive: true });
execFileSync("npx", ["@tailwindcss/cli", "-i", "standalone/styles.css", "-o", "dist/app.css", "--minify"], {
  stdio: "inherit",
});
// The page script (classic, inlined) leaves the charts out: they ship as charts.js next to the page
// and load on first use (standalone/charts-loader.ts). charts.js borrows React and the usage
// counter from the page (standalone/shared.ts), so there is one React and one counter.
const define = { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_STANDALONE": '"1"' };
const useChartsLoader = {
  name: "charts-loader",
  setup(b) {
    b.onResolve({ filter: /chartsSource$/ }, () => ({ path: new URL("../standalone/charts-loader.ts", import.meta.url).pathname }));
  },
};
await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  outfile: "dist/app.js",
  alias: { "@": "." },
  define,
  plugins: [useChartsLoader],
  legalComments: "none",
});
const fromPage = {
  name: "from-page",
  setup(b) {
    const map = { react: "React", "react-dom": "ReactDOM", "react/jsx-runtime": "jsx" };
    b.onResolve({ filter: /^(react|react-dom|react\/jsx-runtime)$/ }, (a) => ({ path: map[a.path], namespace: "page" }));
    b.onResolve({ filter: /lib\/track(\.ts)?$/ }, () => ({ path: "track", namespace: "page" }));
    b.onLoad({ filter: /.*/, namespace: "page" }, (a) => ({ contents: `module.exports = window.__snoopyShared.${a.path};`, loader: "js" }));
  },
};
const chartsOut = `dist/${basename(out, ".html")}-charts.js`;
await build({
  entryPoints: ["standalone/charts-entry.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  outfile: chartsOut,
  alias: { "@": "." },
  define,
  plugins: [fromPage],
  legalComments: "none",
});
const chunkDir = chartsOut;
const chunks = ["charts.js"];

// Opening screen as static HTML (replaced by the app when its script runs)
let prerendered = "";
const prerenderTarget = process.argv[2] ?? "main";
if (["flow", "suite", "main"].includes(prerenderTarget)) {
  await build({
    entryPoints: ["standalone/prerender.tsx"],
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile: "dist/prerender.cjs",
    alias: { "@": "." },
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_STANDALONE": '"1"' },
    logLevel: "error",
  });
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  prerendered = require(new URL("../dist/prerender.cjs", import.meta.url).pathname).render(prerenderTarget);
}
const { THEME_BOOT_SCRIPT } = await import("../lib/theme-boot.ts").catch(() => ({ THEME_BOOT_SCRIPT: "" }));

const css = readFileSync("dist/app.css", "utf8");
const js = readFileSync("dist/app.js", "utf8").replace(/<\/script/gi, "<\\/script");
const html = `<title>${target.title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="סימולטור דירה להשקעה מול S&amp;P 500 עם מיסוי ישראלי">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" media="print" onload="this.media='all'">
<script>${THEME_BOOT_SCRIPT}</script>
<style>${css}</style>
<div id="root" dir="rtl" lang="he">${prerendered}</div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log(`${out} — ${(html.length / 1024).toFixed(0)} KB; charts.js (publish next to it) = ${chunkDir}, ${(readFileSync(chunkDir).length / 1024).toFixed(0)} KB`);
