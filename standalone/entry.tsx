import { createRoot } from "react-dom/client";
import Simulator from "../components/Simulator";
import { applyTheme, initialTheme } from "../lib/theme";


// Theme before the first render (saved choice → host data-theme → OS setting)
applyTheme(initialTheme());
document.documentElement.lang = "he";
document.documentElement.dir = "rtl";
createRoot(document.getElementById("root")!).render(<Simulator />);
