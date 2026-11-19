// Draft preview: the situation cards. Not used by the published site.
import { createRoot } from "react-dom/client";
import Simulator from "../components/Simulator";
import { applyTheme, initialTheme } from "../lib/theme";

applyTheme(initialTheme());
document.documentElement.lang = "he";
document.documentElement.dir = "rtl";
createRoot(document.getElementById("root")!).render(<Simulator variant="situations" />);
