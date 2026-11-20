// Build-time only: the opening screen as static HTML, so it paints before the app script runs.
import { renderToStaticMarkup } from "react-dom/server";
import Flow from "../components/Flow";
import Simulator from "../components/Simulator";

export function render(target: string): string {
  if (target === "flow") return renderToStaticMarkup(<Flow />);
  if (target === "suite") return renderToStaticMarkup(<Simulator withGuide />);
  if (target === "main") return renderToStaticMarkup(<Simulator />);
  return "";
}
