import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static site: `next build` writes plain HTML/CSS/JS to out/ (served by Cloudflare Pages)
  output: "export",
  // /simulator → /simulator/index.html, so static hosts serve every route without rewrites
  trailingSlash: true,
};

export default nextConfig;
