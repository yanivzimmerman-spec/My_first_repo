import { createRoot } from "react-dom/client";
import Simulator from "../components/Simulator";

document.documentElement.lang = "he";
document.documentElement.dir = "rtl";
createRoot(document.getElementById("root")!).render(<Simulator />);
