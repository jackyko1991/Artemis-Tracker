import * as THREE from "https://esm.sh/three@0.165.0";
import { OrbitControls } from "https://esm.sh/three@0.165.0/examples/jsm/controls/OrbitControls.js";

const DEFAULT_MISSION_DATA = {
  missionName: "Artemis II",
  launchDate: "2026-04-01T22:35:00Z",
  checkpoints: [
    {
      id: "launch",
      label: "Launch",
      time: "2026-04-01T22:35:00Z",
      progress: 0.02,
      summary: "Orion lifts off aboard SLS from Kennedy Space Center. MECO occurs 8 min later at 160 km altitude and 28,160 km/h. Solar arrays deploy and Orion enters a 43,730 × 115 mile high Earth orbit.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/nasa-sets-coverage-for-artemis-ii-moon-mission/",
      imageUrl: "https://images-assets.nasa.gov/image/KSC-20260318-PH-KLS01_0012/KSC-20260318-PH-KLS01_0012~medium.jpg"
    },
    {
      id: "tli",
      label: "Translunar Injection",
      time: "2026-04-02T23:49:00Z",
      progress: 0.12,
      summary: "A 5 min 51 s ICPS burn (ΔV 388 m/s) sends Orion out of high Earth orbit onto a free-return translunar trajectory. No lunar orbit insertion — the Moon's gravity bends the path and returns the crew to Earth automatically.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
      imageUrl: "https://images-assets.nasa.gov/image/jsc2025e081079/jsc2025e081079~medium.jpg"
    },
    {
      id: "lunar-flyby",
      label: "Lunar Flyby",
      time: "2026-04-06T18:00:00Z",
      progress: 0.53,
      summary: "Orion passes ~6,500 km above the lunar far side — the closest a crewed spacecraft has come to the Moon since Apollo 17. The crew briefly loses radio contact while behind the Moon.",
      sourceUrl: "https://svs.gsfc.nasa.gov/5610/",
      imageUrl: "https://images-assets.nasa.gov/image/iss072e192098/iss072e192098~medium.jpg"
    },
    {
      id: "max-distance",
      label: "Distance Record",
      time: "2026-04-06T17:45:00Z",
      progress: 0.55,
      summary: "At 406,840 km from Earth, Orion breaks the human spaceflight distance record set by Apollo 13 in 1970 (400,171 km). No astronaut has ever been this far from home.",
      sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
      imageUrl: "https://images-assets.nasa.gov/image/iss072e367304/iss072e367304~medium.jpg"
    },
    {
      id: "splashdown",
      label: "Splashdown",
      time: "2026-04-11T00:06:00Z",
      progress: 0.98,
      summary: "Orion re-enters at ~40,000 km/h. The heat shield reaches 2,760 °C. After 13 minutes of entry, the capsule splashes down in the Pacific Ocean off San Diego, completing a 1.1 million km round trip.",
      sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
      imageUrl: "https://images-assets.nasa.gov/image/iss072e367304/iss072e367304~medium.jpg"
    }
  ]
};

const missionData = structuredClone(DEFAULT_MISSION_DATA);

// Optional: replace with your free NASA API key from https://api.nasa.gov
// DEMO_KEY works but is rate-limited (30 req/hour, 50 req/day)
const NASA_API_KEY = "DEMO_KEY";

const REMOTE_ASSETS = {
  earthColor: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  earthSpecular: "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
  moonColor: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
  orionModel: ""
};

const LIVE_ENDPOINTS = {
  artemisFeed: "https://www.nasa.gov/missions/artemis/feed/",
  imageSearch: `https://images-api.nasa.gov/search?q=Artemis%20II&media_type=image&page=1${NASA_API_KEY !== "DEMO_KEY" ? `&api_key=${NASA_API_KEY}` : ""}`
};

const KM_SCALE = 384400;
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737.4;
const SCENE_EARTH_RADIUS = 2.4;
const SCENE_MOON_DISTANCE = SCENE_EARTH_RADIUS * 8; // Visually compressed (real ratio ~60x)
const SCENE_MOON_RADIUS = SCENE_EARTH_RADIUS * (MOON_RADIUS_KM / EARTH_RADIUS_KM);
const sceneCanvas = document.querySelector("#scene");
const sceneError = document.querySelector("#scene-error");
const metricDistanceAE = document.querySelector("#metric-distance-ae");
const metricDistanceAM = document.querySelector("#metric-distance-am");
const metricSpeed = document.querySelector("#metric-speed");
const checkpointList = document.querySelector("#checkpoint-list");
const fitScreenButton = document.querySelector("#fit-screen");
const newsModal = document.querySelector("#news-modal");

let selectedCheckpointId = missionData.checkpoints[0].id;
let focusCheckpoint = null;

const EARTH_SIDEREAL_SECONDS = 86164.0905;
const MOON_SIDEREAL_SECONDS = 27.321661 * 86400;
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DEG2RAD = Math.PI / 180;

function formatKm(value, fractionDigits = 2) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} km`;
}

// Artemis II mission velocity profile: [progress, km/h]
// Based on NASA mission design — fast near Earth (gravity), slow at maximum distance
const VELOCITY_PROFILE = [
  [0.00,     0],
  [0.02, 28160],  // MECO — 160 km altitude, 28,160 km/h
  [0.12, 37800],  // TLI burn peak (ΔV 388 m/s)
  [0.22, 12000],  // early outbound (decelerating against Earth gravity)
  [0.35,  5500],
  [0.45,  3400],  // approaching Moon
  [0.53,  3100],  // lunar flyby closest approach ~6,500 km
  [0.55,  2800],  // maximum distance — slowest point
  [0.65,  3600],  // return transit (accelerating due to gravity)
  [0.75,  6000],
  [0.85, 12000],
  [0.93, 25000],
  [0.96, 36000],  // entry interface
  [0.98, 40000],  // peak heating ~40,000 km/h
  [1.00,     0],
];

function getVelocityKmH(progress) {
  for (let i = 0; i < VELOCITY_PROFILE.length - 1; i++) {
    const [t0, v0] = VELOCITY_PROFILE[i];
    const [t1, v1] = VELOCITY_PROFILE[i + 1];
    if (progress >= t0 && progress <= t1) {
      return v0 + (v1 - v0) * ((progress - t0) / (t1 - t0));
    }
  }
  return 0;
}

async function fetchHorizonsTrajectory() {
  // Load from bundled local file — no CORS issues, no API rate limits.
  // Data pre-fetched from NASA JPL HORIZONS (spacecraft -1024, 3-hour step).
  // Re-run `scripts/update_trajectory.sh` to refresh when a new solution is published.
  const response = await fetchWithTimeout("./trajectory.json", 8000);
  if (!response.ok) throw new Error(`trajectory.json load failed: ${response.status}`);
  const json = await response.json();
  const scale = SCENE_MOON_DISTANCE / KM_SCALE;
  return json.points.map(p => ({
    timeMs: p.timeMs,
    pos: new THREE.Vector3(p.x * scale, p.z * scale, p.y * scale),
    speedKmH: p.speedKmH
  }));
}


function horizonsProgress(data, nowMs) {
  const t0 = data[0].timeMs, t1 = data[data.length - 1].timeMs;
  return THREE.MathUtils.clamp((nowMs - t0) / (t1 - t0), 0, 1);
}

function horizonsLookup(data, nowMs) {
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

function getCheckpoint(checkpointId) {
  return missionData.checkpoints.find((item) => item.id === checkpointId);
}

function setDetail(checkpointId) {
  selectedCheckpointId = checkpointId;
  refreshCheckpointListState(getMissionProgress(getSceneTimeMs()));
}

function openNewsModalAt(checkpointId, anchorElement = null) {
  const checkpoint = getCheckpoint(checkpointId);
  if (!checkpoint) {
    return;
  }

  document.querySelector("#news-title").textContent = checkpoint.label;
  document.querySelector("#news-time").textContent = new Date(checkpoint.time).toUTCString();
  document.querySelector("#news-summary").textContent = checkpoint.summary;
  document.querySelector("#news-link").href = checkpoint.sourceUrl;
  document.querySelector("#news-image").src = checkpoint.imageUrl;
  document.querySelector("#news-image").alt = checkpoint.label;

  if (anchorElement && window.innerWidth > 1200) {
    const rect = anchorElement.getBoundingClientRect();
    const modalWidth = Math.min(360, window.innerWidth * 0.28);
    const preferredLeft = rect.left - modalWidth - 14;
    const fallbackLeft = Math.min(rect.right + 14, window.innerWidth - modalWidth - 16);
    const left = preferredLeft >= 16 ? preferredLeft : fallbackLeft;
    const panelHeight = window.innerHeight * 0.8;
    const minTop = window.innerHeight * 0.1;
    const maxTop = window.innerHeight * 0.1;
    const top = Math.min(
      Math.max(minTop, rect.top - 10),
      Math.max(minTop, window.innerHeight - panelHeight - maxTop)
    );
    newsModal.style.left = `${left}px`;
    newsModal.style.top = `${top}px`;
    newsModal.style.bottom = "auto";
    newsModal.style.right = "auto";
    newsModal.style.width = `${modalWidth}px`;
  } else {
    newsModal.style.left = "";
    newsModal.style.top = "";
    newsModal.style.right = "";
    newsModal.style.bottom = "";
    newsModal.style.width = "";
  }

  newsModal.removeAttribute("hidden");
  newsModal.style.display = "block";
}

function closeNewsModal() {
  newsModal.setAttribute("hidden", "");
  newsModal.style.display = "none";
}

function renderCheckpointList() {
  checkpointList.innerHTML = "";
  missionData.checkpoints.slice().reverse().forEach((checkpoint) => {
    const item = document.createElement("li");
    item.className = "checkpoint-item";

    const button = document.createElement("button");
    button.dataset.id = checkpoint.id;
    button.innerHTML = `<strong>${checkpoint.label}</strong><span>${new Date(checkpoint.time).toUTCString()}</span>`;
    button.addEventListener("click", () => {
      setDetail(checkpoint.id);
      if (focusCheckpoint) {
        focusCheckpoint(checkpoint.id);
      }
      if (checkpoint.sourceUrl) {
        window.open(checkpoint.sourceUrl, "_blank", "noopener,noreferrer");
      }
    });
    button.addEventListener("mouseenter", () => {
      setDetail(checkpoint.id);
      openNewsModalAt(checkpoint.id, button);
    });
    button.addEventListener("focus", () => {
      setDetail(checkpoint.id);
      openNewsModalAt(checkpoint.id, button);
    });
    button.addEventListener("mouseleave", closeNewsModal);
    button.addEventListener("blur", closeNewsModal);

    item.appendChild(button);
    checkpointList.appendChild(item);
  });

  refreshCheckpointListState(getMissionProgress(getSceneTimeMs()));
}

function refreshCheckpointListState(progress) {
  checkpointList.querySelectorAll("button").forEach((button) => {
    const checkpoint = getCheckpoint(button.dataset.id);
    const isFuture = checkpoint && checkpoint.progress > progress;
    button.classList.toggle("is-future", Boolean(isFuture));
    button.classList.toggle("active", button.dataset.id === selectedCheckpointId);
  });
}

function getMissionProgress(nowMs = Date.now()) {
  // Always use DEFAULT_MISSION_DATA timestamps so live-feed data cannot break progress
  const launch = new Date(DEFAULT_MISSION_DATA.launchDate).getTime();
  const end = new Date(DEFAULT_MISSION_DATA.checkpoints[DEFAULT_MISSION_DATA.checkpoints.length - 1].time).getTime();
  const progress = (nowMs - launch) / (end - launch);
  return THREE.MathUtils.clamp(progress, 0.02, 0.98);
}

function showSceneError(error) {
  sceneError.hidden = false;
  sceneError.textContent = `Scene failed to initialize: ${error.message}`;
}

function stripHtml(value) {
  const temp = document.createElement("div");
  temp.innerHTML = value;
  return (temp.textContent || "").trim();
}

function extractImageFromContent(encoded) {
  const temp = document.createElement("div");
  temp.innerHTML = encoded;
  return temp.querySelector("img")?.src || "";
}

function clampProgress(progress) {
  return THREE.MathUtils.clamp(progress, 0.02, 0.98);
}

function loadTexture(loader, url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`Texture load timed out: ${url}`);
      resolve(null);
    }, timeoutMs);
    loader.load(
      url,
      (tex) => { clearTimeout(timer); resolve(tex); },
      undefined,
      (err) => { clearTimeout(timer); console.warn(`Texture load failed: ${url}`, err); resolve(null); }
    );
  });
}

function createSpacecraftModel() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9dee8, emissive: 0x152033, emissiveIntensity: 0.52, metalness: 0.56, roughness: 0.42 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a3a6b, emissive: 0x0a1a40, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.55 });

  // Crew module — tapered cone (narrow top, wider heat-shield base)
  const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.20, 12), bodyMat);
  cm.position.y = 0.21;
  group.add(cm);

  // Service module — cylinder
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12), bodyMat.clone());
  sm.position.y = 0.05;
  group.add(sm);

  // Solar panels (two arms)
  const panelGeo = new THREE.BoxGeometry(0.38, 0.005, 0.10);
  [-0.30, 0.30].forEach((x) => {
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(x, 0.05, 0);
    group.add(panel);
  });

  // Glow halo
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff8452, transparent: true, opacity: 0.32 })
  );
  group.add(glow);

  // Invisible hit-sphere — makes hover detection reliable at any zoom level
  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitArea.userData.isHitArea = true;
  group.add(hitArea);

  return group;
}

// Planned (future) tube — bright at start (Orion's position), fades out toward Earth arrival
function createFadingPlannedTube(curve, tubularSegments, radius, radialSegments) {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const ringCount = radialSegments + 1;
  const colors = new Float32Array((tubularSegments + 1) * ringCount * 3);
  for (let i = 0; i <= tubularSegments; i++) {
    const fade = 0.22 + 0.78 * Math.pow(1.0 - i / tubularSegments, 1.4); // bright at Orion end, dimmer at Earth end
    for (let j = 0; j < ringCount; j++) {
      const idx = (i * ringCount + j) * 3;
      colors[idx]     = 0.56 * fade;
      colors[idx + 1] = 0.82 * fade;
      colors[idx + 2] = fade;
    }
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

function createFadingTube(curve, tubularSegments, radius, radialSegments) {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const ringCount = radialSegments + 1;
  const colors = new Float32Array((tubularSegments + 1) * ringCount * 3);
  for (let i = 0; i <= tubularSegments; i++) {
    const fade = Math.pow(i / tubularSegments, 1.8); // dim at start, bright at tip
    for (let j = 0; j < ringCount; j++) {
      const idx = (i * ringCount + j) * 3;
      colors[idx]     = fade;
      colors[idx + 1] = 0.55 * fade;
      colors[idx + 2] = 0.22 * fade;
    }
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

function createTrajectoryCurve() {
  const D = SCENE_MOON_DISTANCE;
  const R = SCENE_EARTH_RADIUS;
  // Free-return trajectory in the XZ plane (matches Moon orbital plane).
  // All points kept > R*2 from Earth centre so Orion never overlaps Earth.
  // Moon flyby at D*0.96 — just inside the orbit ring, no overshoot.
  // Departure/arrival on the viewer-facing (+X,+Z) side of Earth so the
  // spacecraft is clearly near Earth at launch/return.
  // Max extent D*0.82 keeps the flyby visibly inside the Moon orbit ring.
  // Clean free-return trajectory — X increases to Moon flyby then decreases back.
  // No Earth-orbit arc so the spline stays smooth throughout.
  const points = [
    new THREE.Vector3( R * 1.08,  0.05,  D * 0.05), // TLI departure — just above Earth surface
    new THREE.Vector3( D * 0.22,  0.5,   D * 0.18), // early outbound
    new THREE.Vector3( D * 0.50,  0.5,   D * 0.14), // mid outbound
    new THREE.Vector3( D * 0.74,  0.3,   D * 0.06), // approaching Moon
    new THREE.Vector3( D * 0.82,  0.05,  0        ), // Moon flyby — inside orbit ring
    new THREE.Vector3( D * 0.74, -0.20, -D * 0.06), // post-flyby
    new THREE.Vector3( D * 0.50, -0.45, -D * 0.14), // mid return
    new THREE.Vector3( D * 0.22, -0.50, -D * 0.18), // late return
    new THREE.Vector3( R * 1.12, -0.08, -D * 0.05), // Earth arrival — re-entry, near Earth
  ];
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.12);
}

function updateMetrics(earth, moon, spacecraft, progress, liveSpeedKmH = null) {
  const earthPos = earth.getWorldPosition(new THREE.Vector3());
  const moonPos = moon.getWorldPosition(new THREE.Vector3());
  const shipPos = spacecraft.getWorldPosition(new THREE.Vector3());

  metricDistanceAE.textContent = formatKm(earthPos.distanceTo(shipPos) / SCENE_MOON_DISTANCE * KM_SCALE);
  metricDistanceAM.textContent = formatKm(moonPos.distanceTo(shipPos) / SCENE_MOON_DISTANCE * KM_SCALE);

  const speedKmH = liveSpeedKmH !== null ? liveSpeedKmH : getVelocityKmH(progress);
  metricSpeed.textContent = `${speedKmH.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/h`;
}

function getSceneTimeMs() {
  return Date.now();
}

function getRealTimeAngles(nowMs) {
  const elapsedSeconds = (nowMs - J2000_UTC_MS) / 1000;
  const earthRotation = ((elapsedSeconds / EARTH_SIDEREAL_SECONDS) % 1) * Math.PI * 2;
  const moonRotation = ((elapsedSeconds / MOON_SIDEREAL_SECONDS) % 1) * Math.PI * 2;

  return {
    earthRotation,
    moonRotation,
    moonOrbit: moonRotation
  };
}

function getSolarDirection(nowMs) {
  const julianDay = nowMs / 86400000 + 2440587.5;
  const n = julianDay - 2451545.0;
  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * n) % 360;
  const lambda = meanLongitude
    + 1.915 * Math.sin(meanAnomaly * DEG2RAD)
    + 0.02 * Math.sin(2 * meanAnomaly * DEG2RAD);
  const obliquity = 23.439 - 0.0000004 * n;

  const lambdaRad = lambda * DEG2RAD;
  const obliquityRad = obliquity * DEG2RAD;

  const x = Math.cos(lambdaRad);
  const y = Math.sin(obliquityRad) * Math.sin(lambdaRad);
  const z = Math.cos(obliquityRad) * Math.sin(lambdaRad);

  return new THREE.Vector3(x, y, z).normalize();
}

function buildCheckpointFromFeedItem(item, fallbackImage, index) {
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
    id: `live-${index}`,
    label: stripHtml(item.title || fallback.label),
    time: item.pubDate || fallback.time,
    progress,
    summary: stripHtml(item.description || "Latest Artemis mission update from NASA."),
    sourceUrl: item.link || fallback.sourceUrl,
    imageUrl: extractImageFromContent(item.content || "") || fallbackImage || fallback.imageUrl
  };
}

async function fetchWithTimeout(url, timeoutMs = 6000) {
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

async function fetchArtemisFeed() {
  const response = await fetchWithTimeout(LIVE_ENDPOINTS.artemisFeed);
  if (!response.ok) {
    throw new Error(`NASA Artemis feed returned ${response.status}`);
  }

  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const items = [...doc.querySelectorAll("item")].map((item) => ({
    title: item.querySelector("title")?.textContent || "",
    link: item.querySelector("link")?.textContent || "",
    pubDate: item.querySelector("pubDate")?.textContent || "",
    description: item.querySelector("description")?.textContent || "",
    content: item.getElementsByTagName("content:encoded")[0]?.textContent || ""
  }));

  return items.filter((item) => /artemis ii|orion|moon mission|crew/i.test(`${item.title} ${item.description}`));
}

async function fetchArtemisImages() {
  const response = await fetchWithTimeout(LIVE_ENDPOINTS.imageSearch);
  if (!response.ok) {
    throw new Error(`NASA image API returned ${response.status}`);
  }

  const data = await response.json();
  const items = data.collection?.items || [];

  return items
    .map((item) => ({
      title: item.data?.[0]?.title || "",
      imageUrl: item.links?.find((link) => link.render === "image")?.href || ""
    }))
    .filter((item) => item.imageUrl);
}

async function hydrateMissionData() {
  try {
    const [feedItems, imageItems] = await Promise.all([
      fetchArtemisFeed(),
      fetchArtemisImages()
    ]);

    const liveItems = feedItems.slice(0, 4);
    if (liveItems.length === 0) {
      throw new Error("NASA feed did not include Artemis II updates");
    }

    missionData.checkpoints = liveItems
      .map((item, index) => buildCheckpointFromFeedItem(item, imageItems[index]?.imageUrl || "", index))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    selectedCheckpointId = missionData.checkpoints[0].id;
  } catch (error) {
    console.warn("Live mission data unavailable, using fallback data.", error);
    missionData.checkpoints = structuredClone(DEFAULT_MISSION_DATA.checkpoints);
    selectedCheckpointId = missionData.checkpoints[0].id;
  }
}


async function initScene(horizonsData = null) {
  const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03070d, 0.0008);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(0, 9, 26);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 4;
  controls.maxDistance = SCENE_MOON_DISTANCE * 3;

  const ambient = new THREE.AmbientLight(0xffffff, 1.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff4d6, 3.1);
  keyLight.position.set(8, 10, 12);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x7bc7ff, 1.45);
  fillLight.position.set(-10, 4, -6);
  scene.add(fillLight);


  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const textureLoader = new THREE.TextureLoader();

  const [earthColor, earthSpecular, moonColor] = await Promise.all([
    loadTexture(textureLoader, REMOTE_ASSETS.earthColor),
    loadTexture(textureLoader, REMOTE_ASSETS.earthSpecular),
    loadTexture(textureLoader, REMOTE_ASSETS.moonColor)
  ]);

  if (earthColor) earthColor.colorSpace = THREE.SRGBColorSpace;
  if (moonColor) moonColor.colorSpace = THREE.SRGBColorSpace;

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(SCENE_EARTH_RADIUS, 48, 48),
    new THREE.MeshStandardMaterial({
      color: earthColor ? 0xffffff : 0x2255aa,
      map: earthColor || null,
      emissive: 0x082854,
      emissiveIntensity: 0.58,
      metalnessMap: earthSpecular || null,
      roughness: 0.72,
      metalness: 0.08
    })
  );
  earthGroup.add(earth);

  const earthGlow = new THREE.Mesh(
    new THREE.SphereGeometry(SCENE_EARTH_RADIUS * 1.09, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x58d8ff,
      transparent: true,
      opacity: 0.28
    })
  );
  earthGroup.add(earthGlow);

  const moonPivot = new THREE.Group();
  scene.add(moonPivot);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(SCENE_MOON_RADIUS, 36, 36),
    new THREE.MeshStandardMaterial({
      color: moonColor ? 0xffffff : 0x888888,
      map: moonColor || null,
      emissive: 0x111318,
      emissiveIntensity: 0.14,
      roughness: 0.94
    })
  );
  moon.position.set(SCENE_MOON_DISTANCE, 0, 0);
  moonPivot.add(moon);

  // Moon orbit — dashed ring in the XZ plane
  const moonOrbitPoints = Array.from({ length: 129 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * SCENE_MOON_DISTANCE, 0, Math.sin(a) * SCENE_MOON_DISTANCE);
  });
  const moonOrbitGeometry = new THREE.BufferGeometry().setFromPoints(moonOrbitPoints);
  const moonOrbitLine = new THREE.Line(
    moonOrbitGeometry,
    new THREE.LineDashedMaterial({ color: 0x7aaedd, dashSize: 0.6, gapSize: 0.4, opacity: 0.75, transparent: true })
  );
  moonOrbitLine.computeLineDistances();
  scene.add(moonOrbitLine);

  let trajectoryCurve = createTrajectoryCurve();
  // If real HORIZONS data loaded, override with real positions
  if (horizonsData) {
    const realPoints = horizonsData.map(p => p.pos);
    trajectoryCurve = new THREE.CatmullRomCurve3(realPoints, false, "centripetal", 0.1);
  }
  const trajectoryRadius = Math.max(0.075, SCENE_EARTH_RADIUS * 0.028);
  let liveTrajectoryGeometry = new THREE.TubeGeometry(
    trajectoryCurve,
    64,
    trajectoryRadius,
    12,
    false
  );
  const liveTrajectoryLine = new THREE.Mesh(
    liveTrajectoryGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0x5a2010,
      emissiveIntensity: 0.62,
      roughness: 0.6,
      metalness: 0.15
    })
  );
  scene.add(liveTrajectoryLine);

  let plannedTrajectoryGeometry = createFadingPlannedTube(
    new THREE.CatmullRomCurve3(trajectoryCurve.getPoints(64), false, "centripetal", 0.12),
    64, trajectoryRadius * 0.52, 10
  );
  const plannedTrajectoryLine = new THREE.Mesh(
    plannedTrajectoryGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0x1f3954,
      emissiveIntensity: 0.85,
      roughness: 0.45,
      metalness: 0.08
    })
  );
  scene.add(plannedTrajectoryLine);

  const spacecraft = createSpacecraftModel();
  scene.add(spacecraft);

  const checkpointMeshes = [];
  const checkpointLayer = new THREE.Group();
  scene.add(checkpointLayer);

  missionData.checkpoints.forEach((checkpoint) => {
    const position = trajectoryCurve.getPoint(checkpoint.progress);
    checkpoint.position = position;

    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe182 })
    );
    node.position.copy(position);
    node.userData.checkpointId = checkpoint.id;
    checkpointLayer.add(node);
    checkpointMeshes.push(node);
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const fitBox = new THREE.Box3();
  const fitCenter = new THREE.Vector3();
  const fitSize = new THREE.Vector3();
  const fitObjects = [earthGroup, moonPivot, liveTrajectoryLine, plannedTrajectoryLine, checkpointLayer, spacecraft];

  focusCheckpoint = (checkpointId) => {
    const checkpoint = missionData.checkpoints.find((item) => item.id === checkpointId);
    if (!checkpoint?.position) {
      return;
    }
    controls.target.copy(checkpoint.position);
  };

  function fitSceneToView() {
    fitBox.makeEmpty();
    fitObjects.forEach((object) => fitBox.expandByObject(object));
    fitBox.getCenter(fitCenter);
    fitBox.getSize(fitSize);

    const maxSize = Math.max(fitSize.x, fitSize.y, fitSize.z);
    const fitHeightDistance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = 1.02 * Math.max(fitHeightDistance, fitWidthDistance);
    const direction = new THREE.Vector3(0.9, 0.42, 1).normalize();

    controls.target.copy(fitCenter);
    camera.position.copy(fitCenter).addScaledVector(direction, distance);
    camera.near = Math.max(0.1, distance / 100);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function resize() {
    const { clientWidth, clientHeight } = sceneCanvas.parentElement;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  function getCanvasPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      clientX: event.clientX,
      clientY: event.clientY
    };
  }

  function onPointerDown(event) {
    const { x, y } = getCanvasPointer(event);
    pointer.x = x;
    pointer.y = y;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(checkpointMeshes);
    if (intersects.length > 0) {
      const checkpointId = intersects[0].object.userData.checkpointId;
      setDetail(checkpointId);
      focusCheckpoint(checkpointId);
    }
  }

  const orionCard = document.querySelector("#orion-card");
  const nodeCard  = document.querySelector("#node-card");

  function showNodeCard(checkpointId, clientX, clientY) {
    const cp = getCheckpoint(checkpointId);
    if (!cp) return;
    const isFuture = cp.progress > getMissionProgress(getSceneTimeMs());
    nodeCard.innerHTML = `
      <p class="eyebrow">${isFuture ? "Upcoming" : "Completed"}</p>
      <strong style="display:block;margin:4px 0 2px">${cp.label}</strong>
      <span style="font-size:0.82rem;color:var(--muted)">${new Date(cp.time).toUTCString()}</span>
      <p style="margin:8px 0 0;font-size:0.88rem;line-height:1.45">${cp.summary}</p>`;
    nodeCard.style.left = `${clientX + 16}px`;
    nodeCard.style.top  = `${clientY - 10}px`;
    nodeCard.hidden = false;
  }

  function hideNodeCard() {
    nodeCard.hidden = true;
  }

  function showOrionCard(clientX, clientY) {
    const ae = metricDistanceAE.textContent;
    const am = metricDistanceAM.textContent;
    const spd = metricSpeed.textContent;
    const pct = Math.round(getMissionProgress(getSceneTimeMs()) * 100);
    orionCard.innerHTML = `
      <p class="eyebrow">Orion Live Status</p>
      <dl class="orion-card-dl">
        <dt>Mission progress</dt><dd>${pct}%</dd>
        <dt>Distance from Earth</dt><dd>${ae}</dd>
        <dt>Distance from Moon</dt><dd>${am}</dd>
        <dt>Speed</dt><dd>${spd}</dd>
      </dl>`;
    orionCard.style.left = `${clientX + 14}px`;
    orionCard.style.top  = `${clientY - 10}px`;
    orionCard.hidden = false;
  }

  function hideOrionCard() {
    orionCard.hidden = true;
  }

  let hoveredCheckpointId = null;
  let orionHovered = false;
  let lastOrionClient = { x: 0, y: 0 };

  function onPointerMove(event) {
    const { x, y, clientX, clientY } = getCanvasPointer(event);
    pointer.x = x;
    pointer.y = y;

    raycaster.setFromCamera(pointer, camera);

    // Check spacecraft first
    const hitSphere = spacecraft.children.find(c => c.userData.isHitArea);
    const shipHits = hitSphere ? raycaster.intersectObject(hitSphere) : [];
    if (shipHits.length > 0) {
      if (!orionHovered) {
        orionHovered = true;
        hoveredCheckpointId = null;
        closeNewsModal();
        renderer.domElement.style.cursor = "crosshair";
      }
      lastOrionClient = { x: clientX, y: clientY };
      showOrionCard(clientX, clientY);
      return;
    }
    if (orionHovered) {
      orionHovered = false;
      hideOrionCard();
      renderer.domElement.style.cursor = "";
    }

    // Check checkpoint nodes
    const intersects = raycaster.intersectObjects(checkpointMeshes);
    if (intersects.length > 0) {
      const checkpointId = intersects[0].object.userData.checkpointId;
      hoveredCheckpointId = checkpointId;
      setDetail(checkpointId);
      showNodeCard(checkpointId, clientX, clientY);
      renderer.domElement.style.cursor = "pointer";
    } else {
      if (hoveredCheckpointId !== null) {
        hoveredCheckpointId = null;
        hideNodeCard();
        renderer.domElement.style.cursor = "";
      }
    }
  }

  window.addEventListener("resize", resize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  fitScreenButton.addEventListener("click", fitSceneToView);
  resize();
  fitSceneToView();

  function animate() {
    const elapsed = clock.getElapsedTime();
    const nowMs = getSceneTimeMs();
    const { earthRotation, moonRotation, moonOrbit } = getRealTimeAngles(nowMs);
    const solarDirection = getSolarDirection(nowMs);

    earth.rotation.y = earthRotation;
    moon.rotation.y = moonRotation;
    moonPivot.rotation.y = moonOrbit;
    keyLight.position.copy(solarDirection).multiplyScalar(42);
    fillLight.position.copy(solarDirection).multiplyScalar(-18).add(new THREE.Vector3(-4, 3, 0));

    const progress = horizonsData ? horizonsProgress(horizonsData, nowMs) : getMissionProgress(nowMs);
    const horizonsLive = horizonsData ? horizonsLookup(horizonsData, nowMs) : null;
    const shipPoint = horizonsLive ? horizonsLive.pos : trajectoryCurve.getPoint(progress);
    const nextPoint = trajectoryCurve.getPoint(Math.min(progress + 0.01, 0.99));
    const numCompleted = Math.max(8, Math.floor(220 * progress));
    const completedCurve = new THREE.CatmullRomCurve3(
      Array.from({ length: numCompleted + 1 }, (_, i) =>
        trajectoryCurve.getPoint((progress * i) / numCompleted)
      ),
      false,
      "centripetal",
      0.12
    );
    const nextGeometry = createFadingTube(
      completedCurve,
      Math.max(24, Math.floor(220 * progress)),
      trajectoryRadius,
      12
    );
    const remainingCurve = new THREE.CatmullRomCurve3(
      trajectoryCurve.getPoints(Math.max(8, Math.floor(220 * (1 - progress)))).map((_, index, points) => {
        const t = progress + ((1 - progress) * index / Math.max(1, points.length - 1));
        return trajectoryCurve.getPoint(Math.min(t, 0.999));
      }),
      false,
      "centripetal",
      0.12
    );
    const nextPlannedGeometry = createFadingPlannedTube(
      remainingCurve,
      Math.max(18, Math.floor(220 * (1 - progress))),
      trajectoryRadius * 0.52,
      10
    );
    liveTrajectoryLine.geometry.dispose();
    liveTrajectoryLine.geometry = nextGeometry;
    plannedTrajectoryLine.geometry.dispose();
    plannedTrajectoryLine.geometry = nextPlannedGeometry;
    spacecraft.position.copy(shipPoint);
    spacecraft.lookAt(nextPoint);
    spacecraft.rotateX(Math.PI / 2);

    checkpointMeshes.forEach((mesh) => {
      const active = mesh.userData.checkpointId === selectedCheckpointId;
      const checkpoint = getCheckpoint(mesh.userData.checkpointId);
      const isFuture = checkpoint && checkpoint.progress > progress;
      const pulse = 1 + Math.sin(elapsed * 3 + mesh.position.x) * 0.08;
      mesh.material.color.setHex(isFuture ? 0x8ed1ff : 0xffe182);
      mesh.scale.setScalar(active ? pulse * 1.35 : pulse * 0.92);
    });

    refreshCheckpointListState(progress);

    controls.update();
    updateMetrics(earth, moon, spacecraft, progress, horizonsLive?.speedKmH ?? null);
    if (orionHovered) showOrionCard(lastOrionClient.x, lastOrionClient.y);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

// Tap news modal on mobile to dismiss
newsModal.addEventListener("click", closeNewsModal);

document.querySelector("#about-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.querySelector("#about-panel");
  const btn = document.querySelector("#about-btn");
  const opening = panel.hasAttribute("hidden");
  if (opening) {
    panel.removeAttribute("hidden");
    panel.style.display = "block";
  } else {
    panel.style.display = "none";
    panel.setAttribute("hidden", "");
  }
  btn.textContent = opening ? "What is this? ▴" : "What is this? ▾";
});

// Load bundled HORIZONS trajectory (pre-fetched from NASA JPL, no CORS issues)
let horizonsData = null;
try {
  horizonsData = await fetchHorizonsTrajectory();
  document.querySelector("#data-source-badge").textContent =
    `Trajectory: NASA JPL HORIZONS · ${horizonsData.length} pts · 3 h resolution`;
} catch (err) {
  console.error("trajectory.json failed to load:", err.message);
  document.querySelector("#data-source-badge").textContent =
    "Trajectory: data unavailable";
}

try {
  renderCheckpointList();
  setDetail(selectedCheckpointId);
  await initScene(horizonsData);
} catch (error) {
  console.error(error);
  showSceneError(error);
  metricDistanceAE.textContent = "Unavailable";
  metricDistanceAM.textContent = "Unavailable";
}

hydrateMissionData().then(() => {
  renderCheckpointList();
  setDetail(selectedCheckpointId);
}).catch(() => {});
