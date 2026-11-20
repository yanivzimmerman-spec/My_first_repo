// Artifact build: the charts bundle (charts.js). React and the usage counter come from the page.
import GrowthChart from "../components/GrowthChart";
import ComboView from "../components/ComboView";

(window as unknown as { __snoopyCharts: unknown }).__snoopyCharts = { GrowthChart, ComboView };
