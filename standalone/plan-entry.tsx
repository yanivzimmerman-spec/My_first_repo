// Test environment: the "before the advisor" planner draft. Not used by the published site.
import { createRoot } from "react-dom/client";
import Planner from "../components/plan/Planner";
import { applyTheme, initialTheme } from "../lib/theme";

applyTheme(initialTheme());
document.documentElement.lang = "he";
document.documentElement.dir = "rtl";
createRoot(document.getElementById("root")!).render(<Planner />);
