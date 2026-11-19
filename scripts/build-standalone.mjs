// Builds the whole app into one self-contained HTML file: dist/index.html
// `node scripts/build-standalone.mjs preview` builds the draft preview into dist/preview.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const preview = process.argv[2] === "preview";
const entry = preview ? "standalone/preview-entry.tsx" : "standalone/entry.tsx";
const out = preview ? "dist/preview.html" : "dist/index.html";
mkdirSync("dist", { recursive: true });
execFileSync("npx", ["@tailwindcss/cli", "-i", "standalone/styles.css", "-o", "dist/app.css", "--minify"], {
  stdio: "inherit",
});
await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  outfile: "dist/app.js",
  alias: { "@": "." },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_STANDALONE": '"1"',
  },
  legalComments: "none",
});

const css = readFileSync("dist/app.css", "utf8");
const js = readFileSync("dist/app.js", "utf8").replace(/<\/script/gi, "<\\/script");
const html = `<title>נדל״ן מול סנופי</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="סימולטור דירה להשקעה מול S&amp;P 500 עם מיסוי ישראלי">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root" dir="rtl" lang="he"></div>
<script>${js}</script>
`;
writeFileSync(out, preview ? html.replace("<title>נדל״ן מול סנופי</title>", "<title>בחירת מצב (טיוטה)</title>") : html);
console.log(`${out} — ${(html.length / 1024).toFixed(0)} KB`);
