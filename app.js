import * as THREE from "https://esm.sh/three@0.165.0";
import { OrbitControls } from "https://esm.sh/three@0.165.0/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "https://esm.sh/three@0.165.0/examples/jsm/loaders/STLLoader.js";

const DEFAULT_MISSION_DATA = {
  missionName: "Artemis II",
  launchDate: "2026-04-01T22:24:00Z",
  checkpoints: [
    {
      id: "launch",
      label: "Launch",
      time: "2026-04-01T22:24:00Z",
      progress: 0.02,
      summary: "Orion lifts off aboard SLS from Kennedy Space Center and begins the crewed lunar flyby mission.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/nasa-sets-coverage-for-artemis-ii-moon-mission/",
      imageUrl: "https://images-assets.nasa.gov/image/KSC-20260318-PH-KLS01_0012/KSC-20260318-PH-KLS01_0012~medium.jpg"
    },
    {
      id: "tli",
      label: "Translunar Injection",
      time: "2026-04-02T19:30:00Z",
      progress: 0.28,
      summary: "Upper stage burn sends Orion out of high Earth orbit and onto the translunar trajectory toward the Moon.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
      imageUrl: "https://images-assets.nasa.gov/image/jsc2025e081079/jsc2025e081079~medium.jpg"
    },
    {
      id: "far-side",
      label: "Far Side Flyby",
      time: "2026-04-06T17:45:00Z",
      progress: 0.68,
      summary: "Orion passes behind the Moon and reaches the deepest point of the free-return loop before heading home.",
      sourceUrl: "https://svs.gsfc.nasa.gov/5610/",
      imageUrl: "https://images-assets.nasa.gov/image/iss072e192098/iss072e192098~medium.jpg"
    },
    {
      id: "return",
      label: "Earth Return",
      time: "2026-04-10T17:00:00Z",
      progress: 0.98,
      summary: "The vehicle closes the loop, re-enters Earth's neighborhood, and prepares for splashdown operations.",
      sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
      imageUrl: "https://images-assets.nasa.gov/image/iss072e367304/iss072e367304~medium.jpg"
    }
  ]
};

const missionData = structuredClone(DEFAULT_MISSION_DATA);

const REMOTE_ASSETS = {
  earthColor: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  earthSpecular: "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
  moonColor: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
  orionModel: "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/printable/orion-capsule/Orion%20Capsule%20%28stand%29.stl"
};

const LIVE_ENDPOINTS = {
  artemisFeed: "https://www.nasa.gov/missions/artemis/feed/",
  imageSearch: "https://images-api.nasa.gov/search?q=Artemis%20II&media_type=image&page=1"
};

const KM_SCALE = 384400;
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737.4;
const EARTH_MOON_DISTANCE_KM = 384400;
const SCENE_EARTH_RADIUS = 2.4;
const SCENE_MOON_DISTANCE = SCENE_EARTH_RADIUS * 8; // Visually compressed (real ratio ~60x)
const SCENE_MOON_RADIUS = SCENE_EARTH_RADIUS * (MOON_RADIUS_KM / EARTH_RADIUS_KM);
const sceneCanvas = document.querySelector("#scene");
const sceneError = document.querySelector("#scene-error");
const metricDistanceAE = document.querySelector("#metric-distance-ae");
const metricDistanceAM = document.querySelector("#metric-distance-am");
const checkpointList = document.querySelector("#checkpoint-list");
const playbackButton = document.querySelector("#playback-toggle");
const fitScreenButton = document.querySelector("#fit-screen");
const newsModal = document.querySelector("#news-modal");

let playbackActive = true;
let selectedCheckpointId = missionData.checkpoints[0].id;
let focusCheckpoint = null;
let pausedAtMs = 0;
let pausedSceneTimeMs = 0;

const EARTH_SIDEREAL_SECONDS = 86164.0905;
const MOON_SIDEREAL_SECONDS = 27.321661 * 86400;
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DEG2RAD = Math.PI / 180;

function formatKm(value, fractionDigits = 0) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} km`;
}

function getCheckpoint(checkpointId) {
  return missionData.checkpoints.find((item) => item.id === checkpointId);
}

function setDetail(checkpointId) {
  selectedCheckpointId = checkpointId;
  refreshCheckpointListState(getMissionProgress(getSceneTimeMs()));
}

function openNewsModal(checkpointId) {
  openNewsModalAt(checkpointId);
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

  newsModal.hidden = false;
}

function closeNewsModal() {
  newsModal.hidden = true;
}

function renderCheckpointList() {
  checkpointList.innerHTML = "";
  missionData.checkpoints.forEach((checkpoint) => {
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
  const launch = new Date(missionData.launchDate).getTime();
  const end = new Date(missionData.checkpoints[missionData.checkpoints.length - 1].time).getTime();
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

function loadTexture(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function loadStl(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function createTrajectoryCurve() {
  const D = SCENE_MOON_DISTANCE;
  const R = SCENE_EARTH_RADIUS;
  // Free-return trajectory: outbound arcs above the plane, swings past Moon, returns below
  const points = [
    new THREE.Vector3(R * 1.08, 0, 0),
    new THREE.Vector3(D * 0.14, D * 0.10, D * 0.04),
    new THREE.Vector3(D * 0.30, D * 0.18, D * 0.06),
    new THREE.Vector3(D * 0.50, D * 0.22, D * 0.05),
    new THREE.Vector3(D * 0.70, D * 0.17, D * 0.01),
    new THREE.Vector3(D * 0.88, D * 0.08, -D * 0.04),
    new THREE.Vector3(D * 1.02, D * 0.01, -D * 0.07),
    new THREE.Vector3(D * 0.90, -D * 0.08, -D * 0.11),
    new THREE.Vector3(D * 0.68, -D * 0.17, -D * 0.13),
    new THREE.Vector3(D * 0.44, -D * 0.20, -D * 0.11),
    new THREE.Vector3(D * 0.20, -D * 0.14, -D * 0.07)
  ];
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.12);
}

function updateMetrics(earth, moon, spacecraft) {
  const earthPos = earth.getWorldPosition(new THREE.Vector3());
  const moonPos = moon.getWorldPosition(new THREE.Vector3());
  const shipPos = spacecraft.getWorldPosition(new THREE.Vector3());

  metricDistanceAE.textContent = formatKm(earthPos.distanceTo(shipPos) / SCENE_MOON_DISTANCE * KM_SCALE, 1);
  metricDistanceAM.textContent = formatKm(moonPos.distanceTo(shipPos) / SCENE_MOON_DISTANCE * KM_SCALE, 1);
}

function getSceneTimeMs() {
  return playbackActive ? Date.now() : pausedSceneTimeMs;
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

function buildCheckpointFromFeedItem(item, fallbackImage, index, total) {
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

async function fetchArtemisFeed() {
  const response = await fetch(LIVE_ENDPOINTS.artemisFeed);
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
  const response = await fetch(LIVE_ENDPOINTS.imageSearch);
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
      .map((item, index) => buildCheckpointFromFeedItem(item, imageItems[index]?.imageUrl || "", index, liveItems.length))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    selectedCheckpointId = missionData.checkpoints[0].id;
  } catch (error) {
    console.warn("Live mission data unavailable, using fallback data.", error);
    missionData.checkpoints = structuredClone(DEFAULT_MISSION_DATA.checkpoints);
    selectedCheckpointId = missionData.checkpoints[0].id;
  }
}

playbackButton.addEventListener("click", () => {
  playbackActive = !playbackActive;
  if (playbackActive) {
    pausedAtMs = 0;
  } else {
    pausedAtMs = Date.now();
    pausedSceneTimeMs = pausedAtMs;
  }
  playbackButton.textContent = playbackActive ? "Pause Motion" : "Resume Motion";
});

async function initScene() {
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

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c4,
      transparent: true,
      opacity: 0.95
    })
  );
  scene.add(sunGlow);

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const textureLoader = new THREE.TextureLoader();
  const stlLoader = new STLLoader();

  const [earthColor, earthSpecular, moonColor, orionGeometry] = await Promise.all([
    loadTexture(textureLoader, REMOTE_ASSETS.earthColor),
    loadTexture(textureLoader, REMOTE_ASSETS.earthSpecular),
    loadTexture(textureLoader, REMOTE_ASSETS.moonColor),
    loadStl(stlLoader, REMOTE_ASSETS.orionModel)
  ]);

  earthColor.colorSpace = THREE.SRGBColorSpace;
  moonColor.colorSpace = THREE.SRGBColorSpace;

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(SCENE_EARTH_RADIUS, 48, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: earthColor,
      emissive: 0x082854,
      emissiveIntensity: 0.58,
      metalnessMap: earthSpecular,
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
      color: 0xffffff,
      map: moonColor,
      emissive: 0x111318,
      emissiveIntensity: 0.14,
      roughness: 0.94
    })
  );
  moon.position.set(SCENE_MOON_DISTANCE, 0, 0);
  moonPivot.add(moon);

  const trajectoryCurve = createTrajectoryCurve();
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
      color: 0xff8d5c,
      emissive: 0x5a2010,
      emissiveIntensity: 0.62,
      roughness: 0.6,
      metalness: 0.15
    })
  );
  scene.add(liveTrajectoryLine);

  let plannedTrajectoryGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(
      trajectoryCurve.getPoints(64),
      false,
      "centripetal",
      0.12
    ),
    64,
    trajectoryRadius * 0.52,
    10,
    false
  );
  const plannedTrajectoryLine = new THREE.Mesh(
    plannedTrajectoryGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x8ed1ff,
      emissive: 0x1f3954,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.82,
      roughness: 0.45,
      metalness: 0.08
    })
  );
  scene.add(plannedTrajectoryLine);

  orionGeometry.center();
  const spacecraft = new THREE.Mesh(
    orionGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xd9dee8,
      emissive: 0x152033,
      emissiveIntensity: 0.52,
      metalness: 0.56,
      roughness: 0.42
    })
  );
  spacecraft.scale.setScalar(0.0034);
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

  function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(checkpointMeshes);
    if (intersects.length > 0) {
      const checkpointId = intersects[0].object.userData.checkpointId;
      setDetail(checkpointId);
      focusCheckpoint(checkpointId);
    }
  }

  window.addEventListener("resize", resize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
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
    sunGlow.position.copy(solarDirection).multiplyScalar(54);

    const progress = getMissionProgress(nowMs);
    const shipPoint = trajectoryCurve.getPoint(progress);
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
    const nextGeometry = new THREE.TubeGeometry(
      completedCurve,
      Math.max(24, Math.floor(220 * progress)),
      trajectoryRadius,
      12,
      false
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
    const nextPlannedGeometry = new THREE.TubeGeometry(
      remainingCurve,
      Math.max(18, Math.floor(220 * (1 - progress))),
      trajectoryRadius * 0.52,
      10,
      false
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
    updateMetrics(earth, moon, spacecraft);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

try {
  await hydrateMissionData();
  renderCheckpointList();
  setDetail(selectedCheckpointId);
  await initScene();
} catch (error) {
  console.error(error);
  showSceneError(error);
  metricDistanceAE.textContent = "Unavailable";
  metricDistanceAM.textContent = "Unavailable";
}
