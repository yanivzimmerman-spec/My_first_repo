// Where the chart components come from. Next.js: code-split dynamic imports. The single-file
// artifact build swaps this module for standalone/charts-loader.ts (a classic script loaded on demand).
export const loadGrowthChart = () => import("./GrowthChart");
export const loadComboView = () => import("./ComboView");
