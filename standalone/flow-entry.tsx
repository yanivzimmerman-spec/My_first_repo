// Test environment: the step-by-step version (situation → a few numbers → the answer).
import { createRoot } from "react-dom/client";
import Flow from "../components/Flow";
import { applyTheme, initialTheme } from "../lib/theme";

applyTheme(initialTheme());
document.documentElement.lang = "he";
document.documentElement.dir = "rtl";
createRoot(document.getElementById("root")!).render(<Flow />);
