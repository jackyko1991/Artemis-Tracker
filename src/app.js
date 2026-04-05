import "./ui.js";  // registers all UI event listeners
import { applyLanguage, getCurrentLanguage, renderCheckpointList, showSceneError } from "./ui.js";
import { fetchHorizonsTrajectory, fetchMoonEphemeris, selectedCheckpointId, setDetail, hydrateMissionData } from "./mission.js";
import { getTranslations } from "./i18n.js";
import { initScene } from "./scene.js";

const metricDistanceAE = document.querySelector("#metric-distance-ae");
const metricDistanceAM = document.querySelector("#metric-distance-am");
const dataSourceBadge = document.querySelector("#data-source-badge");

function updateBadge(horizonsCount = null, moonCount = null, metrics = null) {
  const copy = getTranslations(getCurrentLanguage());
  if (horizonsCount === null || moonCount === null) {
    dataSourceBadge.textContent = copy.dataUnavailable;
    return;
  }
  dataSourceBadge.textContent = copy.trajectoryBadge({
    orionCount: horizonsCount,
    moonCount,
    tliRadiusKm: metrics?.tliRadiusKm ?? "…",
    maxBridgeTurnDeg: metrics?.maxBridgeTurnDeg ?? "…",
  });
}

// Load bundled HORIZONS trajectory (pre-fetched from NASA JPL, no CORS issues)
let horizonsData = null;
let moonData = null;
try {
  horizonsData = await fetchHorizonsTrajectory();
  moonData = await fetchMoonEphemeris();
  updateBadge(horizonsData.length, moonData.length, null);
} catch (err) {
  console.error("ephemeris load failed:", err.message);
  updateBadge(null, null, null);
}

try {
  renderCheckpointList();
  setDetail(selectedCheckpointId);
  const diagnostics = await initScene(horizonsData, moonData);
  if (diagnostics?.metrics && horizonsData && moonData) {
    updateBadge(horizonsData.length, moonData.length, diagnostics.metrics);
  }
} catch (error) {
  console.error(error);
  showSceneError(error);
  metricDistanceAE.textContent = "Unavailable";
  metricDistanceAM.textContent = "Unavailable";
}

// Attempt to hydrate with live NASA feed data in the background
hydrateMissionData().then(() => {
  applyLanguage(getCurrentLanguage(), { skipListRender: true });
  renderCheckpointList();
  setDetail(selectedCheckpointId);
}).catch(() => {});

window.addEventListener("app-languagechange", () => {
  updateBadge(horizonsData?.length ?? null, moonData?.length ?? null, globalThis.__trajectoryValidation?.metrics ?? null);
});
