import * as THREE from "https://esm.sh/three@0.165.0";
import {
  DEFAULT_MISSION_DATA, KM_SCALE, SCENE_EARTH_RADIUS, SCENE_MOON_DISTANCE,
  VELOCITY_PROFILE, LIVE_ENDPOINTS, LOCAL_NEWS_IMAGES
} from "./constants.js";

// Keplerian parking-orbit generator
// Derives orbital elements from the early HORIZONS data points (which sample
// the parking orbit too coarsely to interpolate smoothly) and generates a
// dense synthetic arc at 20-minute steps. This gives the correct ellipse
// shape, including the full swing out to apogee and back down to the TLI
// perigee on the far side of Earth, without CORS or API issues.

function solveKepler(M, e, tol = 1e-10) {
  // Newton-Raphson for eccentric anomaly E from mean anomaly M
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); // normalise to [0, 2π)
  let E = M + e * Math.sin(M); // Danby initial guess
  for (let i = 0; i < 60; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

/**
 * Generates a physically-accurate parking-orbit trajectory at 20-min steps
 * in scene space.  The orbit is derived from the HORIZONS data:
 *   • Orbital plane  : h = r₀ × r₁  (first two data points)
 *   • Apogee radius  : maximum-radius data point before TLI
 *   • Semi-major axis: a = (r_a + r_p) / 2  (r_p = 185 km altitude)
 *   • First perigee  : back-calculated from true anomaly at horizonsData[0]
 *
 * Returns { pts, tliPos, apogeePos, t_perigee_1_ms, T_ms } or null on error.
 */
export function generateParkingOrbitData(horizonsData, tliIdx) {
  if (!horizonsData || horizonsData.length < 4 || tliIdx < 3) return null;

  const MU_KM3_S2   = 398600;          // Earth gravitational parameter  km³/s²
  const R_EARTH_KM  = 6371;
  const R_PERIGEE_KM = R_EARTH_KM + 185; // 185 km perigee altitude
  const sceneToKm   = KM_SCALE / SCENE_MOON_DISTANCE;
  const kmToScene   = SCENE_MOON_DISTANCE / KM_SCALE;
  const R_PERIGEE_SC = R_PERIGEE_KM * kmToScene;

  // ── 1. Orbital plane ───────────────────────────────────────────────────
  const p0 = horizonsData[0].pos;
  const p1 = horizonsData[1].pos;
  const hVec = p0.clone().cross(p1);
  if (hVec.lengthSq() < 1e-20) return null;
  const hDir = hVec.normalize();            // orbital angular momentum direction

  // ── 2. Apogee (max-radius point before TLI) ────────────────────────────
  let apogeeIdx = 1;
  for (let i = 2; i < tliIdx; i++) {
    if (horizonsData[i].pos.length() > horizonsData[apogeeIdx].pos.length()) apogeeIdx = i;
  }
  const r_a_sc  = horizonsData[apogeeIdx].pos.length();
  const r_a_km  = r_a_sc * sceneToKm;
  const apogeeDir  = horizonsData[apogeeIdx].pos.clone().normalize();

  // ── 3. Orbital elements ────────────────────────────────────────────────
  const a_km = (r_a_km + R_PERIGEE_KM) / 2;
  const e    = (r_a_km - R_PERIGEE_KM) / (r_a_km + R_PERIGEE_KM);
  if (e <= 0 || e >= 1) return null;

  const T_s  = 2 * Math.PI * Math.sqrt(a_km ** 3 / MU_KM3_S2);
  const T_ms = T_s * 1000;
  const n    = 2 * Math.PI / T_s; // mean motion  rad/s

  // Semi-latus rectum for the orbit equation  r = p / (1 + e cos ν)
  const p_km = a_km * (1 - e * e);

  // ── 4. True anomaly at horizonsData[0]; must be ascending (ν ∈ [0, π]) ──
  const r0_km  = horizonsData[0].pos.length() * sceneToKm;
  const cosNu0 = Math.max(-1, Math.min(1, (p_km / r0_km - 1) / e));
  const nu0    = Math.acos(cosNu0);           // ascending → ν ∈ [0, π]

  // Eccentric anomaly via half-angle formula
  const tanHalfE0 = Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu0 / 2);
  const E0  = 2 * Math.atan(tanHalfE0);
  const M0  = E0 - e * Math.sin(E0);
  const t_perigee_1_ms = horizonsData[0].timeMs - (M0 / (2 * Math.PI)) * T_ms;

  // ── 5. Perigee & prograde directions ──────────────────────────────────
  const perigeeDir = apogeeDir.clone().negate();
  const perpDir    = hDir.clone().cross(perigeeDir).normalize(); // prograde at perigee

  // ── 6. Generate points: full first orbit back to TLI perigee ──────────
  const STEP_MS      = 20 * 60 * 1000;          // 20-minute steps
  const t_perigee_2_ms = t_perigee_1_ms + T_ms; // second perigee = TLI time
  const pts = [];

  for (let t = t_perigee_1_ms; t < t_perigee_2_ms; t += STEP_MS) {
    const dt_s = (t - t_perigee_1_ms) / 1000;
    const M    = n * dt_s;
    const E    = solveKepler(M, e);
    const nu   = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    const r_km = a_km * (1 - e * Math.cos(E));
    const r_sc = Math.max(r_km * kmToScene, SCENE_EARTH_RADIUS * 1.04);
    const pos  = perigeeDir.clone().multiplyScalar(r_sc * Math.cos(nu))
      .add(perpDir.clone().multiplyScalar(r_sc * Math.sin(nu)));
    const v_km_s = Math.sqrt(MU_KM3_S2 * (2 / r_km - 1 / a_km));
    pts.push({ timeMs: t, pos, speedKmH: v_km_s * 3600 });
  }
  // Add exact TLI perigee point (second perigee = where TLI fires).
  // Keep it just above the Earth shell so the node remains visible.
  const v_peri_km_s = Math.sqrt(MU_KM3_S2 * (2 / R_PERIGEE_KM - 1 / a_km));
  const tliR  = Math.max(R_PERIGEE_SC, SCENE_EARTH_RADIUS * 1.04);
  const tliPos = perigeeDir.clone().multiplyScalar(tliR);
  pts.push({ timeMs: t_perigee_2_ms, pos: tliPos.clone(), speedKmH: v_peri_km_s * 3600 });

  const apogeePos = apogeeDir.clone().multiplyScalar(r_a_sc);

  return {
    pts,
    tliPos,
    apogeePos,
    t_perigee_1_ms,
    t_perigee_2_ms,
    T_ms,
    apogeeIdx,
    departureDir: perpDir.clone(),
  };
}

export const missionData = structuredClone(DEFAULT_MISSION_DATA);
export let selectedCheckpointId = missionData.checkpoints[0].id;

// Mutable container. scene.js sets .fn after initScene; ui.js calls it via this reference.
// Using an object because ES module namespace bindings are not externally reassignable.
export const focusRef = { fn: null };

export function getCheckpoint(checkpointId) {
  return missionData.checkpoints.find(item => item.id === checkpointId);
}

export function getCachedNewsImage(checkpointId) {
  return LOCAL_NEWS_IMAGES[checkpointId] || LOCAL_NEWS_IMAGES.default || "";
}

export function getCheckpointTimeMs(checkpoint) {
  return new Date(checkpoint.time).getTime();
}

export function isCheckpointFuture(checkpoint, nowMs = getSceneTimeMs()) {
  return getCheckpointTimeMs(checkpoint) > nowMs;
}

export function setDetail(checkpointId) {
  selectedCheckpointId = checkpointId;
}

export function getVelocityKmH(progress) {
  for (let i = 0; i < VELOCITY_PROFILE.length - 1; i++) {
    const [t0, v0] = VELOCITY_PROFILE[i];
    const [t1, v1] = VELOCITY_PROFILE[i + 1];
    if (progress >= t0 && progress <= t1) {
      return v0 + (v1 - v0) * ((progress - t0) / (t1 - t0));
    }
  }
  return 0;
}

export function getSceneTimeMs() {
  return Date.now();
}

export function getMissionProgress(nowMs = Date.now()) {
  // Always use DEFAULT_MISSION_DATA timestamps so live-feed data cannot break progress
  const launch = new Date(DEFAULT_MISSION_DATA.launchDate).getTime();
  const end = new Date(DEFAULT_MISSION_DATA.checkpoints[DEFAULT_MISSION_DATA.checkpoints.length - 1].time).getTime();
  const progress = (nowMs - launch) / (end - launch);
  return THREE.MathUtils.clamp(progress, 0.02, 0.98);
}

export async function fetchWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fetchHorizonsTrajectory() {
  // Load from bundled local file. No CORS issues and no API rate limits.
  // Data pre-fetched from NASA JPL HORIZONS (spacecraft -1024, 3-hour step).
  const response = await fetchWithTimeout("./assets/trajectory.json", 8000);
  if (!response.ok) throw new Error(`trajectory.json load failed: ${response.status}`);
  const json = await response.json();
  return mapHorizonsPoints(json.points, true);
}

export async function fetchMoonEphemeris() {
  const response = await fetchWithTimeout("./assets/moon_trajectory.json", 8000);
  if (!response.ok) throw new Error(`moon_trajectory.json load failed: ${response.status}`);
  const json = await response.json();
  return mapHorizonsPoints(json.points, false);
}

function mapHorizonsPoints(points, clampToEarthSkin) {
  const scale = SCENE_MOON_DISTANCE / KM_SCALE;
  return points.map(p => {
    const pos = new THREE.Vector3(p.x * scale, p.z * scale, -p.y * scale);
    if (clampToEarthSkin) {
      // Keep near-perigee points just above the Earth skin without flattening the
      // rest of the parking orbit arc.
      const minDist = SCENE_EARTH_RADIUS * 1.02;
      const d = pos.length();
      if (d < minDist) pos.multiplyScalar(minDist / d);
    }
    return { timeMs: p.timeMs, pos, speedKmH: p.speedKmH ?? null };
  });
}

export function horizonsProgress(data, nowMs) {
  const t0 = data[0].timeMs, t1 = data[data.length - 1].timeMs;
  return THREE.MathUtils.clamp((nowMs - t0) / (t1 - t0), 0, 1);
}

export function horizonsLookup(data, nowMs) {
  if (nowMs <= data[0].timeMs) return { pos: data[0].pos.clone(), speedKmH: data[0].speedKmH };
  if (nowMs >= data[data.length - 1].timeMs) {
    const last = data[data.length - 1];
    return { pos: last.pos.clone(), speedKmH: last.speedKmH };
  }
  for (let i = 0; i < data.length - 1; i++) {
    if (nowMs >= data[i].timeMs && nowMs < data[i + 1].timeMs) {
      const f = (nowMs - data[i].timeMs) / (data[i + 1].timeMs - data[i].timeMs);
      return {
        pos: new THREE.Vector3().lerpVectors(data[i].pos, data[i + 1].pos, f),
        speedKmH: data[i].speedKmH + (data[i + 1].speedKmH - data[i].speedKmH) * f
      };
    }
  }
  return { pos: data[data.length - 1].pos.clone(), speedKmH: data[data.length - 1].speedKmH };
}

export function clampProgress(progress) {
  return THREE.MathUtils.clamp(progress, 0.02, 0.98);
}

export function stripHtml(value) {
  const temp = document.createElement("div");
  temp.innerHTML = value;
  return (temp.textContent || "").trim();
}

export function extractImageFromContent(encoded) {
  const temp = document.createElement("div");
  temp.innerHTML = encoded;
  return temp.querySelector("img")?.src || "";
}

export function buildCheckpointFromFeedItem(item, fallbackImage, index) {
  const fallback = DEFAULT_MISSION_DATA.checkpoints[index] || DEFAULT_MISSION_DATA.checkpoints[0];
  const launch = new Date(DEFAULT_MISSION_DATA.launchDate).getTime();
  const missionEnd = launch + (10 * 24 * 60 * 60 * 1000);
  const eventTime = new Date(item.pubDate || fallback.time).getTime();
  let progress;

  if (!Number.isFinite(eventTime) || eventTime < launch) {
    progress = 0.02;
  } else if (eventTime > missionEnd) {
    progress = 0.98;
  } else {
    progress = clampProgress((eventTime - launch) / (missionEnd - launch));
  }

  return {
    id: fallback.id,
    label: stripHtml(item.title || fallback.label),
    time: item.pubDate || fallback.time,
    progress,
    summary: stripHtml(item.description || fallback.summary).slice(0, 320),
    sourceUrl: item.link || fallback.sourceUrl,
    imageUrl: extractImageFromContent(item["content:encoded"] || ""),
  };
}

export async function fetchArtemisFeed() {
  const resp = await fetchWithTimeout(
    `https://api.allorigins.win/get?url=${encodeURIComponent(LIVE_ENDPOINTS.artemisFeed)}`,
    8000
  );
  if (!resp.ok) throw new Error("Feed fetch failed");
  const json = await resp.json();
  const parser = new DOMParser();
  const doc = parser.parseFromString(json.contents, "text/xml");
  return Array.from(doc.querySelectorAll("item")).slice(0, 5).map(item => ({
    title: item.querySelector("title")?.textContent || "",
    description: item.querySelector("description")?.textContent || "",
    link: item.querySelector("link")?.textContent || "",
    pubDate: item.querySelector("pubDate")?.textContent || "",
    "content:encoded": item.querySelector("content\\:encoded")?.textContent || "",
  }));
}

export async function hydrateMissionData() {
  let fallbackImage = "";
  try {
    const imgResp = await fetchWithTimeout(
      `https://images-api.nasa.gov/search?q=Artemis%20II&media_type=image&page=1`,
      6000
    );
    if (imgResp.ok) {
      const imgJson = await imgResp.json();
      fallbackImage = imgJson?.collection?.items?.[0]?.links?.[0]?.href || "";
    }
  } catch (_) {}

  const feedItems = await fetchArtemisFeed();
  feedItems.slice(0, missionData.checkpoints.length).forEach((item, i) => {
    const cp = buildCheckpointFromFeedItem(item, fallbackImage, i);
    Object.assign(missionData.checkpoints[i], cp);
  });
}
