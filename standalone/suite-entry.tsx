// New version under test: the simulator with the guided path ("before the advisor") built in.
import "./shared";
import { createRoot } from "react-dom/client";
import Simulator from "../components/Simulator";
import { applyTheme, initialTheme } from "../lib/theme";

applyTheme(initialTheme());
document.documentElement.lang = "he";
document.documentElement.dir = "rtl";
createRoot(document.getElementById("root")!).render(<Simulator withGuide />);
