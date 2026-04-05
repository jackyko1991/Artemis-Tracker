import * as THREE from "https://esm.sh/three@0.165.0";
import { OrbitControls } from "https://esm.sh/three@0.165.0/examples/jsm/controls/OrbitControls.js";
import {
  SCENE_EARTH_RADIUS, SCENE_MOON_DISTANCE, SCENE_MOON_RADIUS,
  REMOTE_ASSETS, J2000_UTC_MS, EARTH_SIDEREAL_SECONDS, MOON_SIDEREAL_SECONDS, DEG2RAD, KM_SCALE, EARTH_RADIUS_KM
} from "./constants.js";
import * as missionModule from "./mission.js";
import {
  missionData, getCheckpoint, horizonsProgress, horizonsLookup,
  getMissionProgress, getSceneTimeMs, getVelocityKmH, isCheckpointFuture,
  generateParkingOrbitData
} from "./mission.js";
import { openNewsModalAt, closeNewsModal, refreshCheckpointListState, getCurrentLanguage } from "./ui.js";
import { getTranslations } from "./i18n.js";

// DOM refs
const sceneCanvas = document.querySelector("#scene");
const metricDistanceAE = document.querySelector("#metric-distance-ae");
const metricDistanceAM = document.querySelector("#metric-distance-am");
const metricSpeed = document.querySelector("#metric-speed");
const fitScreenButton = document.querySelector("#fit-screen");
const orionCard = document.querySelector("#orion-card");
const VISUAL_EARTH_SCALE = 0.85;
const VISUAL_MOON_SCALE = 1 / VISUAL_EARTH_SCALE;
const MOON_OBSERVATIONAL_CHECKS = [
  {
    label: "2026-04-05 Svalbard",
    timeMs: Date.parse("2026-04-05T22:00:00Z"),
    observerLatDeg: 78,
    observerLonDeg: 20,
    raHours: 15 + 43 / 60 + 52.8 / 3600,
    decDeg: -(25 + 48 / 60 + 20.4 / 3600),
    azDeg: 132 + 15 / 60 + 22.7 / 3600,
    altDeg: -(18 + 27 / 60 + 42.3 / 3600),
    distanceKm: 405804.69,
  },
  {
    label: "2026-04-06 Svalbard",
    timeMs: Date.parse("2026-04-06T22:00:00Z"),
    observerLatDeg: 78,
    observerLonDeg: 20,
    raHours: 16 + 35 / 60 + 56.9 / 3600,
    decDeg: -(28 + 2 / 60 + 7.4 / 3600),
    azDeg: 121 + 23 / 60 + 56.4 / 3600,
    altDeg: -(22 + 32 / 60 + 16.5 / 3600),
    distanceKm: 407224.91,
  },
  {
    label: "2026-04-07 Svalbard",
    timeMs: Date.parse("2026-04-07T22:00:00Z"),
    observerLatDeg: 78,
    observerLonDeg: 20,
    raHours: 17 + 29 / 60 + 17.4 / 3600,
    decDeg: -(29 + 1 / 60 + 55.7 / 3600),
    azDeg: 109 + 58 / 60 + 19 / 3600,
    altDeg: -(25 + 41 / 60 + 15.6 / 3600),
    distanceKm: 407466.64,
  },
];
const MOON_FLYBY_CONSTRAINTS = {
  targetAngleDeg: 0.6,
  maxAngleDeg: 3.5,
  targetDistanceKm: 8237.4,
  maxDistanceKm: 25000,
};
const MOON_DISPLAY_CONSTRAINTS = {
  maxEffectiveTiltDeg: 18,
  targetLoopCenterDistanceKm: 0,
  maxPhaseAlpha: 0.28,
};

export function formatKm(value, fractionDigits = 2) {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })} km`;
}

export function getRealTimeAngles(nowMs) {
  const elapsedSeconds = (nowMs - J2000_UTC_MS) / 1000;
  const earthRotation = ((elapsedSeconds / EARTH_SIDEREAL_SECONDS) % 1) * Math.PI * 2;
  const moonRotation = ((elapsedSeconds / MOON_SIDEREAL_SECONDS) % 1) * Math.PI * 2;
  return { earthRotation, moonRotation };
}

function findClosestTrajectoryIndex(data, timeMs) {
  let closestIdx = 0;
  let closestDelta = Infinity;
  data.forEach((point, index) => {
    const delta = Math.abs(point.timeMs - timeMs);
    if (delta < closestDelta) {
      closestDelta = delta;
      closestIdx = index;
    }
  });
  return closestIdx;
}

function getLocalPlaneNormal(data, timeMs) {
  const idx = findClosestTrajectoryIndex(data, timeMs);
  const prev = data[Math.max(0, idx - 1)].pos.clone();
  const next = data[Math.min(data.length - 1, idx + 1)].pos.clone();
  let normal = prev.cross(next).normalize();
  if (normal.lengthSq() < 1e-8) {
    normal = data[idx].pos.clone().cross(next.clone().sub(prev)).normalize();
  }
  return normal.lengthSq() < 1e-8 ? new THREE.Vector3(0, 1, 0) : normal;
}

// Interpolate points along the orbital arc between two geocentric position vectors.
// Uses angular slerp + linear radius interpolation, much smoother than CatmullRom
// for the sparse 3 h parking-orbit data.
function densifyArc(p0, p1, steps) {
  if (steps <= 0) return [];
  const axis = p0.clone().cross(p1).normalize();
  if (axis.lengthSq() < 1e-8) return [];
  const angle = p0.angleTo(p1);
  if (angle < 1e-6) return [];
  const r0 = p0.length(), r1 = p1.length();
  const pts = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, t * angle);
    pts.push(p0.clone().normalize().applyQuaternion(q).multiplyScalar(r0 + (r1 - r0) * t));
  }
  return pts;
}

function buildTliBridgePoints(parkingOrbit, horizonsData, tliIdx, startPos = null, endPos = null, steps = 10) {
  if (!horizonsData?.length || tliIdx >= horizonsData.length - 1 || steps <= 1) return [];

  const p0 = (startPos ?? parkingOrbit?.tliPos ?? horizonsData[tliIdx].pos).clone();
  const p3 = (endPos ?? horizonsData[tliIdx + 1].pos).clone();
  const chord = p3.clone().sub(p0);
  const distance = chord.length();
  if (distance < 1e-6) return [];

  const fallbackDir = chord.clone().normalize();
  const radialOut = p0.clone().normalize();
  const departureDir = (parkingOrbit?.departureDir?.clone() ?? fallbackDir)
    .addScaledVector(radialOut, 0.16)
    .normalize();

  const nextRef = horizonsData[Math.min(tliIdx + 2, horizonsData.length - 1)]?.pos.clone() ?? p3.clone();
  let arrivalDir = nextRef.sub(p3).normalize();
  if (arrivalDir.lengthSq() < 1e-8) {
    arrivalDir = fallbackDir.clone();
  }
  if (arrivalDir.dot(fallbackDir) < 0) {
    arrivalDir.negate();
  }

  const handleOut = Math.min(distance * 0.42, SCENE_EARTH_RADIUS * 7.2);
  const handleIn = Math.min(distance * 0.2, SCENE_EARTH_RADIUS * 4.2);
  const p1 = p0.clone().addScaledVector(departureDir, handleOut);
  const p2 = p3.clone().addScaledVector(arrivalDir, -handleIn);
  const minRadius = SCENE_EARTH_RADIUS * 1.04;
  const pts = [];

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const omt = 1 - t;
    const point = new THREE.Vector3()
      .addScaledVector(p0, omt * omt * omt)
      .addScaledVector(p1, 3 * omt * omt * t)
      .addScaledVector(p2, 3 * omt * t * t)
      .addScaledVector(p3, t * t * t);
    if (point.length() < minRadius) {
      point.setLength(minRadius);
    }
    pts.push(point);
  }
  return pts;
}

function getMaxTurnDeg(points) {
  if (!points || points.length < 3) return 0;
  let maxTurnDeg = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i].clone().sub(points[i - 1]);
    const next = points[i + 1].clone().sub(points[i]);
    if (prev.lengthSq() < 1e-10 || next.lengthSq() < 1e-10) continue;
    const turnDeg = THREE.MathUtils.radToDeg(prev.angleTo(next));
    if (Number.isFinite(turnDeg)) {
      maxTurnDeg = Math.max(maxTurnDeg, turnDeg);
    }
  }
  return maxTurnDeg;
}

function validateTrajectoryModel({
  trajectoryCurve,
  horizonsData,
  parkingOrbit,
  tliIdx,
  checkpointPositions,
}) {
  const diagnostics = {
    ok: true,
    errors: [],
    warnings: [],
    metrics: {},
  };

  if (!trajectoryCurve || !horizonsData?.length || !parkingOrbit?.pts?.length) {
    diagnostics.warnings.push("Trajectory validation skipped because required simulation inputs are missing.");
    return diagnostics;
  }

  const kmPerSceneUnit = KM_SCALE / SCENE_MOON_DISTANCE;
  const tliPos = parkingOrbit.tliPos.clone();
  const bridgePts = buildTliBridgePoints(parkingOrbit, horizonsData, tliIdx);
  const postStart = horizonsData[tliIdx + 1]?.pos?.clone();
  const bridgeSequence = [
    parkingOrbit.pts[Math.max(0, parkingOrbit.pts.length - 2)].pos.clone(),
    tliPos,
    ...bridgePts,
    ...(postStart ? [postStart] : []),
    ...(horizonsData[tliIdx + 2]?.pos ? [horizonsData[tliIdx + 2].pos.clone()] : []),
  ];
  const outboundSequence = [
    tliPos,
    ...bridgePts,
    ...(postStart ? [postStart] : []),
    ...(horizonsData[tliIdx + 2]?.pos ? [horizonsData[tliIdx + 2].pos.clone()] : []),
  ];

  const bridgeRadii = outboundSequence.map((point) => point.length());
  const minBridgeRadiusScene = Math.min(...bridgeRadii);
  const maxBridgeTurnDeg = getMaxTurnDeg(bridgeSequence);
  const tliRadiusKm = tliPos.length() * kmPerSceneUnit;
  const apogeeRadiusKm = parkingOrbit.apogeePos.length() * kmPerSceneUnit;

  diagnostics.metrics = {
    tliRadiusKm: Number(tliRadiusKm.toFixed(1)),
    apogeeRadiusKm: Number(apogeeRadiusKm.toFixed(1)),
    minBridgeRadiusKm: Number((minBridgeRadiusScene * kmPerSceneUnit).toFixed(1)),
    maxBridgeTurnDeg: Number(maxBridgeTurnDeg.toFixed(2)),
  };

  const minAllowedRadius = SCENE_EARTH_RADIUS * 1.038;
  if (minBridgeRadiusScene < minAllowedRadius) {
    diagnostics.errors.push("TLI bridge dips too close to Earth.");
  }

  if (maxBridgeTurnDeg > 55) {
    diagnostics.errors.push(`TLI bridge turn is too sharp (${diagnostics.metrics.maxBridgeTurnDeg} deg).`);
  }

  for (let i = 1; i < bridgeRadii.length; i++) {
    if (bridgeRadii[i] + 1e-6 < bridgeRadii[i - 1]) {
      diagnostics.errors.push("TLI bridge radius is not monotonically increasing after perigee.");
      break;
    }
  }

  const tliCheckpoint = checkpointPositions.get("tli");
  if (!tliCheckpoint || tliCheckpoint.distanceTo(tliPos) > 0.001) {
    diagnostics.errors.push("TLI checkpoint is not anchored to the validated perigee point.");
  }

  const apogeeCheckpoint = checkpointPositions.get("high-earth-checkout");
  if (!apogeeCheckpoint || apogeeCheckpoint.distanceTo(parkingOrbit.apogeePos) > 0.001) {
    diagnostics.errors.push("High Earth Orbit Checkout checkpoint is not anchored to apogee.");
  }

  const flybyCheckpoint = checkpointPositions.get("lunar-flyby");
  const flybyTimeMs = new Date(getCheckpoint("lunar-flyby")?.time || Date.now()).getTime();
  const expectedFlyby = horizonsLookup(horizonsData, flybyTimeMs).pos;
  if (!flybyCheckpoint || flybyCheckpoint.distanceTo(expectedFlyby) > 0.001) {
    diagnostics.errors.push("Lunar flyby checkpoint is not anchored to the simulated flyby position.");
  }

  if (diagnostics.metrics.tliRadiusKm > 7000) {
    diagnostics.warnings.push(`TLI perigee radius is ${diagnostics.metrics.tliRadiusKm} km, which is visibly higher than a strict 185 km altitude shell.`);
  }

  diagnostics.ok = diagnostics.errors.length === 0;
  return diagnostics;
}

function buildMoonDisplayData(moonData, horizonsData) {
  if (!moonData?.length) return [];
  if (!horizonsData?.length) return moonData.map((point) => ({ ...point, pos: point.pos.clone() }));

  const checkpointFlybyTimeMs = new Date(getCheckpoint("lunar-flyby")?.time || Date.now()).getTime();
  const kmPerSceneUnit = KM_SCALE / SCENE_MOON_DISTANCE;
  function findEncounterEstimate(centerTimeMs, windowHours = 18, stepMinutes = 15) {
    let best = { timeMs: centerTimeMs, distanceKm: Infinity };
    for (let offsetMinutes = -windowHours * 60; offsetMinutes <= windowHours * 60; offsetMinutes += stepMinutes) {
      const timeMs = centerTimeMs + offsetMinutes * 60 * 1000;
      const shipPos = horizonsLookup(horizonsData, timeMs).pos;
      const moonPos = horizonsLookup(moonData, timeMs).pos;
      const distanceKm = shipPos.distanceTo(moonPos) * kmPerSceneUnit;
      if (distanceKm < best.distanceKm) {
        best = { timeMs, distanceKm };
      }
    }
    return best;
  }
  const encounterEstimate = findEncounterEstimate(checkpointFlybyTimeMs);
  const flybyTimeMs = checkpointFlybyTimeMs;
  const moonNormal = getLocalPlaneNormal(moonData, flybyTimeMs);
  const orionNormal = getLocalPlaneNormal(horizonsData, flybyTimeMs);
  const flybyDir = horizonsLookup(horizonsData, flybyTimeMs).pos.clone().normalize();
  const correctedNormal = orionNormal.clone().applyAxisAngle(flybyDir, Math.PI / 2).normalize();
  const flybyWindowHours = 18;
  const flybyWindowStepHours = 3;
  const flybyLoopSamples = [];
  const flybyWindowTimesMs = [];
  for (let hour = -flybyWindowHours; hour <= flybyWindowHours; hour += flybyWindowStepHours) {
    const sampleTimeMs = flybyTimeMs + hour * 60 * 60 * 1000;
    flybyWindowTimesMs.push(sampleTimeMs);
    flybyLoopSamples.push(horizonsLookup(horizonsData, sampleTimeMs).pos.clone());
  }
  const flybyLoopCenter = flybyLoopSamples
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / flybyLoopSamples.length);
  const flybyLoopRadiusKm = flybyLoopSamples
    .reduce((sum, point) => sum + point.distanceTo(flybyLoopCenter), 0) / flybyLoopSamples.length * kmPerSceneUnit;

  function buildCandidate(targetNormal, phaseSignMultiplier) {
    const planeRotation = new THREE.Quaternion().setFromUnitVectors(moonNormal, targetNormal);
    const rotatedMoonData = moonData.map((point) => ({
      ...point,
      pos: point.pos.clone().applyQuaternion(planeRotation),
    }));

    const rotatedMoonFlybyPos = horizonsLookup(rotatedMoonData, flybyTimeMs).pos;
    const orionFlybyPos = horizonsLookup(horizonsData, flybyTimeMs).pos;
    const moonDir = rotatedMoonFlybyPos.clone().normalize();
    const orionDir = orionFlybyPos.clone().normalize();
    let phaseRotation = new THREE.Quaternion();

    if (moonDir.lengthSq() > 1e-8 && orionDir.lengthSq() > 1e-8) {
      const unsigned = moonDir.angleTo(orionDir);
      if (unsigned > 1e-6) {
        const cross = moonDir.clone().cross(orionDir);
        const signed = (Math.sign(cross.dot(targetNormal)) || 1) * phaseSignMultiplier;
        phaseRotation = new THREE.Quaternion().setFromAxisAngle(targetNormal, unsigned * signed);
      }
    }

    return { targetNormal, planeRotation, phaseRotation };
  }

  function getTopDownDeltaDeg(data, t0, t1) {
    const p0 = horizonsLookup(data, t0).pos;
    const p1 = horizonsLookup(data, t1).pos;
    const a0 = Math.atan2(p0.z, p0.x);
    const a1 = Math.atan2(p1.z, p1.x);
    let delta = THREE.MathUtils.radToDeg(a1 - a0);
    while (delta <= -180) delta += 360;
    while (delta > 180) delta -= 360;
    return delta;
  }

  function scenePosToIcrfKm(pos) {
    return new THREE.Vector3(pos.x, -pos.z, pos.y).multiplyScalar(kmPerSceneUnit);
  }

  function vectorToRaDecDistance(icrf) {
    const r = icrf.length();
    const raHours = ((Math.atan2(icrf.y, icrf.x) * 12 / Math.PI) + 24) % 24;
    const decDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(icrf.z / r, -1, 1)));
    return { raHours, decDeg, distanceKm: r };
  }

  function scenePosToRaDecDistance(pos) {
    return vectorToRaDecDistance(scenePosToIcrfKm(pos));
  }

  function getGreenwichSiderealAngleRad(timeMs) {
    const jd = timeMs / 86400000 + 2440587.5;
    const centuries = (jd - 2451545.0) / 36525;
    let gmstDeg = 280.46061837
      + 360.98564736629 * (jd - 2451545)
      + 0.000387933 * centuries * centuries
      - (centuries ** 3) / 38710000;
    gmstDeg = ((gmstDeg % 360) + 360) % 360;
    return THREE.MathUtils.degToRad(gmstDeg);
  }

  function getObserverIcrfKm(latDeg, lonDeg, timeMs) {
    const latRad = THREE.MathUtils.degToRad(latDeg);
    const lonRad = THREE.MathUtils.degToRad(lonDeg);
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cosLon = Math.cos(lonRad);
    const sinLon = Math.sin(lonRad);
    const ecef = new THREE.Vector3(
      EARTH_RADIUS_KM * cosLat * cosLon,
      EARTH_RADIUS_KM * cosLat * sinLon,
      EARTH_RADIUS_KM * sinLat
    );
    return ecef.applyAxisAngle(new THREE.Vector3(0, 0, 1), getGreenwichSiderealAngleRad(timeMs));
  }

  function getSmallestAngleDeg(a, b) {
    let delta = a - b;
    while (delta <= -180) delta += 360;
    while (delta > 180) delta -= 360;
    return delta;
  }

  function getTopocentricObservation(pos, check) {
    const moonIcrfKm = scenePosToIcrfKm(pos);
    const observerIcrfKm = getObserverIcrfKm(check.observerLatDeg, check.observerLonDeg, check.timeMs);
    const rel = moonIcrfKm.sub(observerIcrfKm);
    const { raHours, decDeg, distanceKm } = vectorToRaDecDistance(rel);
    const latRad = THREE.MathUtils.degToRad(check.observerLatDeg);
    const lonRad = THREE.MathUtils.degToRad(check.observerLonDeg);
    const localSiderealRad = getGreenwichSiderealAngleRad(check.timeMs) + lonRad;
    let hourAngleRad = localSiderealRad - (raHours / 12) * Math.PI;
    while (hourAngleRad <= -Math.PI) hourAngleRad += Math.PI * 2;
    while (hourAngleRad > Math.PI) hourAngleRad -= Math.PI * 2;
    const decRad = THREE.MathUtils.degToRad(decDeg);
    const sinAlt = Math.sin(decRad) * Math.sin(latRad)
      + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngleRad);
    const altDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sinAlt, -1, 1)));
    const y = -Math.cos(decRad) * Math.cos(latRad) * Math.sin(hourAngleRad);
    const x = Math.sin(decRad) - Math.sin(latRad) * sinAlt;
    let azDeg = THREE.MathUtils.radToDeg(Math.atan2(y, x));
    if (azDeg < 0) azDeg += 360;
    return { raHours, decDeg, distanceKm, azDeg, altDeg };
  }

  function observedDirection(check) {
    const raRad = check.raHours / 12 * Math.PI;
    const decRad = THREE.MathUtils.degToRad(check.decDeg);
    return new THREE.Vector3(
      Math.cos(decRad) * Math.cos(raRad),
      Math.cos(decRad) * Math.sin(raRad),
      Math.sin(decRad)
    );
  }

  function buildAdjustedMoonData(adjustment, alpha, planeTiltDeg) {
    const identity = new THREE.Quaternion();
    const maxPlaneAlpha = planeTiltDeg > 1e-6
      ? Math.min(alpha, MOON_DISPLAY_CONSTRAINTS.maxEffectiveTiltDeg / planeTiltDeg)
      : alpha;
    const planePartial = maxPlaneAlpha >= 0.999
      ? adjustment.planeRotation
      : new THREE.Quaternion().slerpQuaternions(identity, adjustment.planeRotation, maxPlaneAlpha);
    const phasePartial = alpha >= 0.999
      ? adjustment.phaseRotation
      : new THREE.Quaternion().slerpQuaternions(identity, adjustment.phaseRotation, alpha);
    return moonData.map((point, index) => {
      const rawPos = point.pos.clone();
      const adjustedPos = rawPos
        .applyQuaternion(planePartial)
        .applyQuaternion(phasePartial);
      if (adjustedPos.lengthSq() > 1e-12) {
        adjustedPos.setLength(rawPos.length());
      }
      return { ...point, pos: adjustedPos };
    });
  }

  function evaluateMoonData(candidate, tag, alpha = 1, planeTiltDeg = 0) {
    let observationalCost = 0;
    const checks = MOON_OBSERVATIONAL_CHECKS.map((check) => {
      const candidatePos = horizonsLookup(candidate, check.timeMs).pos;
      const derived = getTopocentricObservation(candidatePos, check);
      const observed = observedDirection(check);
      const derivedDir = observedDirection({ raHours: derived.raHours, decDeg: derived.decDeg });
      const angularErrorDeg = THREE.MathUtils.radToDeg(derivedDir.angleTo(observed));
      const azErrorDeg = getSmallestAngleDeg(derived.azDeg, check.azDeg);
      const altErrorDeg = derived.altDeg - check.altDeg;
      const distanceErrorKm = Math.abs(derived.distanceKm - check.distanceKm);
      const southPenalty = Math.max(0, check.decDeg - derived.decDeg);
      observationalCost += angularErrorDeg * angularErrorDeg * 7
        + azErrorDeg * azErrorDeg * 0.45
        + altErrorDeg * altErrorDeg * 1.15
        + (distanceErrorKm / 2500) ** 2
        + southPenalty * southPenalty * 6;
      return {
        label: check.label,
        angularErrorDeg: Number(angularErrorDeg.toFixed(3)),
        azErrorDeg: Number(azErrorDeg.toFixed(3)),
        altErrorDeg: Number(altErrorDeg.toFixed(3)),
        distanceErrorKm: Number(distanceErrorKm.toFixed(1)),
        raHours: Number(derived.raHours.toFixed(4)),
        decDeg: Number(derived.decDeg.toFixed(4)),
        azDeg: Number(derived.azDeg.toFixed(3)),
        altDeg: Number(derived.altDeg.toFixed(3)),
      };
    });

    const flybyShipPos = horizonsLookup(horizonsData, flybyTimeMs).pos;
    const flybyMoonPos = horizonsLookup(candidate, flybyTimeMs).pos;
    const flybyDistanceKm = flybyShipPos.distanceTo(flybyMoonPos) * kmPerSceneUnit;
    const flybyAngleDeg = THREE.MathUtils.radToDeg(
      flybyShipPos.clone().normalize().angleTo(flybyMoonPos.clone().normalize())
    );
    const flybyLoopCenterDistanceKm = flybyMoonPos.distanceTo(flybyLoopCenter) * kmPerSceneUnit;
    const flybyLoopDistancesKm = flybyLoopSamples.map((samplePos) => (
      samplePos.distanceTo(flybyMoonPos) * kmPerSceneUnit
    ));
    const minLoopDistanceKm = Math.min(...flybyLoopDistancesKm);
    const meanLoopDistanceKm = flybyLoopDistancesKm.reduce((sum, value) => sum + value, 0) / flybyLoopDistancesKm.length;
    const sameTimeDistancesKm = flybyWindowTimesMs.map((timeMs) => {
      const shipPos = horizonsLookup(horizonsData, timeMs).pos;
      const moonPos = horizonsLookup(candidate, timeMs).pos;
      return shipPos.distanceTo(moonPos) * kmPerSceneUnit;
    });
    const minSameTimeDistanceKm = Math.min(...sameTimeDistancesKm);
    const meanSameTimeDistanceKm = sameTimeDistancesKm.reduce((sum, value) => sum + value, 0) / sameTimeDistancesKm.length;
    const motionDeltaDeg = getTopDownDeltaDeg(candidate, flybyTimeMs - 12 * 60 * 60 * 1000, flybyTimeMs - 9 * 60 * 60 * 1000);
    const flybyDistanceCost = ((flybyDistanceKm - MOON_FLYBY_CONSTRAINTS.targetDistanceKm) / 6000) ** 2 * 7;
    const flybyAngleCost = ((flybyAngleDeg - MOON_FLYBY_CONSTRAINTS.targetAngleDeg) / 0.7) ** 2 * 5;
    const loopCenterMaxKm = Math.max(3500, flybyLoopRadiusKm * 0.22);
    const enclosureCost = ((minSameTimeDistanceKm - MOON_FLYBY_CONSTRAINTS.targetDistanceKm) / 4500) ** 2 * 11
      + ((meanSameTimeDistanceKm - flybyLoopRadiusKm) / Math.max(9000, flybyLoopRadiusKm * 0.18)) ** 2 * 4
      + ((minLoopDistanceKm - MOON_FLYBY_CONSTRAINTS.targetDistanceKm) / 7000) ** 2 * 2
      + ((flybyLoopCenterDistanceKm - MOON_DISPLAY_CONSTRAINTS.targetLoopCenterDistanceKm) / loopCenterMaxKm) ** 2 * 14;
    const flybyHardPenalty = (flybyDistanceKm > MOON_FLYBY_CONSTRAINTS.maxDistanceKm ? 8000 : 0)
      + (flybyAngleDeg > MOON_FLYBY_CONSTRAINTS.maxAngleDeg ? 8000 : 0)
      + (minSameTimeDistanceKm > MOON_FLYBY_CONSTRAINTS.maxDistanceKm ? 9000 : 0)
      + (minLoopDistanceKm > MOON_FLYBY_CONSTRAINTS.maxDistanceKm ? 4000 : 0)
      + (flybyLoopCenterDistanceKm > loopCenterMaxKm ? 9000 : 0);
    const effectiveTiltDeg = Math.min(planeTiltDeg * alpha, MOON_DISPLAY_CONSTRAINTS.maxEffectiveTiltDeg);
    const planeTiltCost = ((effectiveTiltDeg) / 8) ** 2 * 26
      + (planeTiltDeg * alpha > MOON_DISPLAY_CONSTRAINTS.maxEffectiveTiltDeg ? 4000 : 0);
    const directionPenalty = motionDeltaDeg >= 0 ? 0 : Math.abs(motionDeltaDeg) * 90;
    const hardConstraintReport = {
      motionDirection: motionDeltaDeg >= 0,
      flybyDistance: flybyDistanceKm <= MOON_FLYBY_CONSTRAINTS.maxDistanceKm,
      flybyAngle: flybyAngleDeg <= MOON_FLYBY_CONSTRAINTS.maxAngleDeg,
      sameTimeEnclosure: minSameTimeDistanceKm <= MOON_FLYBY_CONSTRAINTS.maxDistanceKm,
      loopEnclosure: flybyLoopCenterDistanceKm <= loopCenterMaxKm,
      planeTilt: effectiveTiltDeg <= MOON_DISPLAY_CONSTRAINTS.maxEffectiveTiltDeg,
    };
    const hardConstraintOk = Object.values(hardConstraintReport).every(Boolean);
    return {
      tag,
      alpha,
      candidate,
      observationalCost,
      flybyDistanceKm,
      flybyAngleDeg,
      flybyLoopCenterDistanceKm,
      minLoopDistanceKm,
      meanLoopDistanceKm,
      minSameTimeDistanceKm,
      meanSameTimeDistanceKm,
      planeTiltDeg,
      effectiveTiltDeg,
      motionDeltaDeg,
      hardConstraintOk,
      hardConstraintReport,
      totalCost: observationalCost + flybyDistanceCost + flybyAngleCost + enclosureCost + flybyHardPenalty + planeTiltCost + directionPenalty,
      checks,
    };
  }

  const candidateVariants = [
    { tag: "rawPhase", adjustment: buildCandidate(moonNormal, 1) },
    { tag: "rawPhaseFlip", adjustment: buildCandidate(moonNormal, -1) },
  ];

  let best = null;
  const evaluations = [];
  for (const variant of candidateVariants) {
    const planeTiltDeg = THREE.MathUtils.radToDeg(
      variant.adjustment.targetNormal.angleTo(moonNormal)
    );
    for (let alpha = 0; alpha <= MOON_DISPLAY_CONSTRAINTS.maxPhaseAlpha + 0.0001; alpha += 0.01) {
      const alphaRounded = Number(alpha.toFixed(2));
      const adjusted = buildAdjustedMoonData(variant.adjustment, alphaRounded, planeTiltDeg);
      const evaluation = evaluateMoonData(adjusted, variant.tag, alphaRounded, planeTiltDeg);
      evaluations.push(evaluation);
    }
  }
  const validEvaluations = evaluations.filter((evaluation) => evaluation.hardConstraintOk);
  const candidatePool = validEvaluations.length ? validEvaluations : evaluations;
  best = candidatePool.reduce((currentBest, evaluation) => (
    !currentBest || evaluation.totalCost < currentBest.totalCost ? evaluation : currentBest
  ), null);

  const optimizationSummary = {
    chosen: best.tag,
    alpha: Number(best.alpha.toFixed(2)),
    totalCost: Number(best.totalCost.toFixed(2)),
    hardConstraintOk: best.hardConstraintOk,
    flybyDistanceKm: Number(best.flybyDistanceKm.toFixed(1)),
    flybyAngleDeg: Number(best.flybyAngleDeg.toFixed(3)),
    minSameTimeDistanceKm: Number(best.minSameTimeDistanceKm.toFixed(1)),
    meanSameTimeDistanceKm: Number(best.meanSameTimeDistanceKm.toFixed(1)),
    flybyLoopCenterDistanceKm: Number(best.flybyLoopCenterDistanceKm.toFixed(1)),
    effectiveTiltDeg: Number(best.effectiveTiltDeg.toFixed(3)),
    motionDeltaDeg: Number(best.motionDeltaDeg.toFixed(3)),
  };
  const constraintStatus = Object.fromEntries(
    Object.entries(best.hardConstraintReport).map(([key, value]) => [key, value ? "pass" : "fail"])
  );
  console.info("[MoonOptimizer] summary", optimizationSummary);
  console.table?.(constraintStatus);
  if (!best.hardConstraintOk) {
    console.warn("[MoonOptimizer] selected solution still violates one or more hard constraints", {
      chosen: best.tag,
      alpha: best.alpha,
      constraintStatus,
    });
  }

  globalThis.__moonDisplayDiagnostics = {
    flybyTimeMs,
    checkpointFlybyTimeMs,
    encounterEstimateDeltaHours: Number(((encounterEstimate.timeMs - checkpointFlybyTimeMs) / 3600000).toFixed(2)),
    encounterEstimateDistanceKm: Number(encounterEstimate.distanceKm.toFixed(1)),
    referenceObserver: { name: "Svalbard", latDeg: 78, lonDeg: 20 },
    appliedAxisQuarterTurnDeg: 90,
    chosen: best.tag,
    chosenAlpha: best.alpha,
    hardConstraintOk: best.hardConstraintOk,
    constraintStatus,
    validCandidateCount: validEvaluations.length,
    evaluatedCandidateCount: evaluations.length,
    flybyDistanceKm: Number(best.flybyDistanceKm.toFixed(1)),
    flybyAngleDeg: Number(best.flybyAngleDeg.toFixed(3)),
    flybyLoopCenterDistanceKm: Number(best.flybyLoopCenterDistanceKm.toFixed(1)),
    minLoopDistanceKm: Number(best.minLoopDistanceKm.toFixed(1)),
    meanLoopDistanceKm: Number(best.meanLoopDistanceKm.toFixed(1)),
    minSameTimeDistanceKm: Number(best.minSameTimeDistanceKm.toFixed(1)),
    meanSameTimeDistanceKm: Number(best.meanSameTimeDistanceKm.toFixed(1)),
    flybyLoopRadiusKm: Number(flybyLoopRadiusKm.toFixed(1)),
    planeTiltDeg: Number(best.planeTiltDeg.toFixed(3)),
    effectiveTiltDeg: Number(best.effectiveTiltDeg.toFixed(3)),
    motionDeltaDeg: Number(best.motionDeltaDeg.toFixed(3)),
    flybyConstraints: MOON_FLYBY_CONSTRAINTS,
    validationTimesUtc: MOON_OBSERVATIONAL_CHECKS.map((check) => new Date(check.timeMs).toISOString()),
    likelyMismatchReasons: [
      "Observer checks are topocentric from Svalbard, while the main scene is geocentric.",
      "The supplied Moon snapshots match around 22:00 UTC, not midnight UTC.",
      "A visually adjusted flyby alignment can push the Moon too far south if observer-based checks are too weak.",
    ],
    checks: best.checks,
  };
  return best.candidate;
}

function buildOrionDisplayData(horizonsData, moonData) {
  if (!horizonsData?.length || !moonData?.length) return horizonsData;

  const flybyTimeMs = new Date(getCheckpoint("lunar-flyby")?.time || Date.now()).getTime();
  const loopWindowHours = 18;
  const moonFlybyPos = horizonsLookup(moonData, flybyTimeMs).pos.clone();
  const rawFlybyPos = horizonsLookup(horizonsData, flybyTimeMs).pos.clone();
  const rawLoopSamples = [];
  for (let hour = -loopWindowHours; hour <= loopWindowHours; hour += 3) {
    rawLoopSamples.push(horizonsLookup(horizonsData, flybyTimeMs + hour * 60 * 60 * 1000).pos.clone());
  }
  const rawLoopCenter = rawLoopSamples
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / rawLoopSamples.length);
  const rawFlybyDir = rawFlybyPos.clone().normalize();
  const rawLoopCenterDir = rawLoopCenter.clone().normalize();
  const moonFlybyDir = moonFlybyPos.clone().normalize();
  const rawFlybyAngleDeg = THREE.MathUtils.radToDeg(rawFlybyDir.angleTo(moonFlybyDir));
  const rawLoopCenterAngleDeg = THREE.MathUtils.radToDeg(rawLoopCenterDir.angleTo(moonFlybyDir));

  function buildResidualTarget(sourceDir, residualDeg) {
    const sourceAngleDeg = THREE.MathUtils.radToDeg(sourceDir.angleTo(moonFlybyDir));
    const axis = sourceDir.clone().cross(moonFlybyDir).normalize();
    if (sourceAngleDeg <= 1e-6 || axis.lengthSq() < 1e-8) {
      return sourceDir.clone();
    }
    return moonFlybyDir.clone().applyAxisAngle(axis, THREE.MathUtils.degToRad(residualDeg)).normalize();
  }

  const flybyTargetDir = buildResidualTarget(
    rawFlybyDir,
    Math.min(MOON_FLYBY_CONSTRAINTS.targetAngleDeg, rawFlybyAngleDeg)
  );
  const loopTargetDir = moonFlybyDir.clone();
  const flybyRotation = new THREE.Quaternion().setFromUnitVectors(rawFlybyDir, flybyTargetDir);
  const loopRotation = new THREE.Quaternion().setFromUnitVectors(rawLoopCenterDir, loopTargetDir);

  function evaluateTransform(rotation, scale) {
    const adjusted = horizonsData.map((point) => ({
      ...point,
      pos: point.pos.clone().multiplyScalar(scale).applyQuaternion(rotation),
    }));
    const adjustedFlybyPos = horizonsLookup(adjusted, flybyTimeMs).pos;
    const adjustedLoopCenter = rawLoopCenter.clone().multiplyScalar(scale).applyQuaternion(rotation);
    const flybyDistanceKm = adjustedFlybyPos.distanceTo(moonFlybyPos) * (KM_SCALE / SCENE_MOON_DISTANCE);
    const flybyAngleDeg = THREE.MathUtils.radToDeg(
      adjustedFlybyPos.clone().normalize().angleTo(moonFlybyDir)
    );
    const loopCenterDistanceKm = adjustedLoopCenter.distanceTo(moonFlybyPos) * (KM_SCALE / SCENE_MOON_DISTANCE);
    const maxOffsetKm = adjusted.reduce((maxValue, point, index) => (
      Math.max(maxValue, point.pos.distanceTo(horizonsData[index].pos) * (KM_SCALE / SCENE_MOON_DISTANCE))
    ), 0);
    const scalePenalty = ((scale - 1) / 0.16) ** 2;
    const score = ((flybyAngleDeg - MOON_FLYBY_CONSTRAINTS.targetAngleDeg) / 0.45) ** 2 * 3
      + (loopCenterDistanceKm / 3200) ** 2 * 18
      + ((flybyDistanceKm - MOON_FLYBY_CONSTRAINTS.targetDistanceKm) / 9000) ** 2 * 4
      + (maxOffsetKm / 220000) ** 2
      + scalePenalty;
    return {
      adjusted,
      adjustedFlybyPos,
      adjustedLoopCenter,
      flybyDistanceKm,
      flybyAngleDeg,
      loopCenterDistanceKm,
      maxOffsetKm,
      scale,
      score,
    };
  }

  let best = null;
  for (let beta = 0; beta <= 1.0001; beta += 0.05) {
    const betaRounded = Number(beta.toFixed(2));
    const rotation = betaRounded === 0
      ? flybyRotation.clone()
      : betaRounded === 1
        ? loopRotation.clone()
        : new THREE.Quaternion().slerpQuaternions(flybyRotation, loopRotation, betaRounded);
    for (let scale = 0.82; scale <= 1.1801; scale += 0.01) {
      const scaleRounded = Number(scale.toFixed(2));
      const evaluation = evaluateTransform(rotation, scaleRounded);
      if (!best || evaluation.score < best.score) {
        best = { ...evaluation, beta: betaRounded, rotation };
      }
    }
  }

  const adjusted = best.adjusted;
  const adjustedFlybyPos = best.adjustedFlybyPos;
  const flybyOffsetKm = rawFlybyPos.distanceTo(adjustedFlybyPos) * (KM_SCALE / SCENE_MOON_DISTANCE);
  const maxOffsetKm = best.maxOffsetKm;
  const rotationAngleDeg = THREE.MathUtils.radToDeg(best.rotation.angleTo(new THREE.Quaternion()));
  globalThis.__orionDisplayDiagnostics = {
    flybyTimeMs,
    flybyOffsetKm: Number(flybyOffsetKm.toFixed(1)),
    maxOffsetKm: Number(maxOffsetKm.toFixed(1)),
    rawFlybyAngleDeg: Number(rawFlybyAngleDeg.toFixed(3)),
    rawLoopCenterAngleDeg: Number(rawLoopCenterAngleDeg.toFixed(3)),
    targetFlybyAngleDeg: Number(MOON_FLYBY_CONSTRAINTS.targetAngleDeg.toFixed(3)),
    achievedFlybyAngleDeg: Number(best.flybyAngleDeg.toFixed(3)),
    achievedLoopCenterDistanceKm: Number(best.loopCenterDistanceKm.toFixed(1)),
    rotationBlendBeta: best.beta,
    uniformScale: best.scale,
    rigidRotationAngleDeg: Number(rotationAngleDeg.toFixed(3)),
    targetFlybyDistanceKm: MOON_FLYBY_CONSTRAINTS.targetDistanceKm,
  };

  return adjusted;
}

function getMoonPosition(nowMs, moonData) {
  if (!moonData?.length) throw new Error("Moon ephemeris unavailable");
  return horizonsLookup(moonData, nowMs).pos;
}

function buildMoonDisplayOrbit(moonData, nowMs, spanDeg = 360, sampleCount = 180) {
  if (!moonData?.length) return [];
  const currentPos = getMoonPosition(nowMs, moonData);
  const futurePos = getMoonPosition(nowMs + 3 * 60 * 60 * 1000, moonData);
  const orbitNormal = getLocalPlaneNormal(moonData, nowMs);
  const motionCross = currentPos.clone().cross(futurePos);
  const motionSign = motionCross.dot(orbitNormal) >= 0 ? 1 : -1;
  const spanRad = THREE.MathUtils.degToRad(spanDeg) * motionSign;
  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / Math.max(1, sampleCount - 1);
    const angle = spanRad * (t - 1);
    const pos = currentPos.clone().applyAxisAngle(orbitNormal, angle);
    samples.push({
      alpha: t,
      pos,
    });
  }
  return samples;
}

function buildLaunchCurve(horizonsData) {
  const p0 = horizonsData[0].pos.clone();
  const launchDir = p0.clone().normalize();
  const north = new THREE.Vector3(0, 1, 0);
  let eastDir = north.clone().cross(launchDir).normalize();
  if (eastDir.lengthSq() < 1e-8) eastDir = new THREE.Vector3(1, 0, 0);

  const firstTangent = horizonsData[Math.min(1, horizonsData.length - 1)].pos.clone()
    .sub(p0)
    .projectOnPlane(launchDir);
  if (firstTangent.lengthSq() > 1e-8 && firstTangent.dot(eastDir) < 0) {
    eastDir.negate();
  }

  const r1 = THREE.MathUtils.lerp(SCENE_EARTH_RADIUS * 1.01, p0.length(), 0.16);
  const r2 = THREE.MathUtils.lerp(SCENE_EARTH_RADIUS * 1.01, p0.length(), 0.42);
  const r3 = THREE.MathUtils.lerp(SCENE_EARTH_RADIUS * 1.01, p0.length(), 0.74);
  return new THREE.CatmullRomCurve3([
    launchDir.clone().multiplyScalar(SCENE_EARTH_RADIUS * 1.01),
    launchDir.clone().multiplyScalar(r1).add(eastDir.clone().multiplyScalar(r1 * 0.24)),
    launchDir.clone().multiplyScalar(r2).add(eastDir.clone().multiplyScalar(r2 * 0.34)),
    launchDir.clone().multiplyScalar(r3).add(eastDir.clone().multiplyScalar(r3 * 0.16)),
    p0,
    horizonsData[Math.min(1, horizonsData.length - 1)].pos.clone(),
  ], false, "centripetal", 0.12);
}

function buildTrajectoryPointList(horizonsData, _tliIdx, options = {}) {
  if (!horizonsData?.length) return [];

  const {
    endIndex = horizonsData.length - 1,
    includeLaunch = true,
  } = options;

  const points = [];
  if (includeLaunch) {
    points.push(...buildLaunchCurve(horizonsData).getPoints(12));
  }
  // buildLaunchCurve() ends at horizonsData[1], so skip indices 0 and 1 to
  // avoid the backward jump [1]→[0]→[1] that reverses the early trajectory.
  const dataStart = includeLaunch ? 2 : 0;
  for (let i = dataStart; i <= endIndex; i++) {
    points.push(horizonsData[i].pos.clone());
  }
  return points;
}

function createLinearPath(points) {
  if (points.length < 2) {
    const p = points[0] || new THREE.Vector3();
    return new THREE.LineCurve3(p.clone(), p.clone().add(new THREE.Vector3(0.001, 0, 0)));
  }
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  }
  return path;
}

function getCheckpointPosition(checkpoint, trajectoryCurve, horizonsData, tliIdx, parkingOrbit) {
  if (!horizonsData?.length) {
    return trajectoryCurve.getPoint(checkpoint.progress);
  }

  const launchCurve = buildLaunchCurve(horizonsData);
  const returnDir = horizonsData[horizonsData.length - 1].pos.clone().normalize();

  if (checkpoint.id === "launch") {
    return launchCurve.getPoint(0);
  }
  if (checkpoint.id === "meco-staging") {
    return launchCurve.getPoint(0.28);
  }
  if (checkpoint.id === "spacecraft-separation") {
    return launchCurve.getPoint(0.58);
  }
  if (checkpoint.id === "high-earth-checkout") {
    // Place at apogee of the parking orbit for physical accuracy
    if (parkingOrbit?.apogeePos) return parkingOrbit.apogeePos.clone();
    return horizonsData[parkingOrbit?.apogeeIdx ?? tliIdx - 2]?.pos.clone()
      ?? horizonsLookup(horizonsData, new Date(checkpoint.time).getTime()).pos;
  }
  if (checkpoint.id === "tli") {
    // TLI fires at perigee; place it at the Keplerian perigee near Earth.
    if (parkingOrbit?.tliPos) return parkingOrbit.tliPos.clone();
    return horizonsData[tliIdx].pos.clone();
  }
  if (checkpoint.id === "lunar-flyby") {
    return horizonsLookup(horizonsData, new Date(checkpoint.time).getTime()).pos;
  }
  if (checkpoint.id === "reentry") {
    return returnDir.clone().multiplyScalar(SCENE_EARTH_RADIUS * 1.08);
  }
  if (checkpoint.id === "splashdown") {
    return returnDir.clone().multiplyScalar(SCENE_EARTH_RADIUS * 1.01);
  }

  const timeMs = new Date(checkpoint.time).getTime();
  if (Number.isFinite(timeMs)) {
    if (timeMs <= horizonsData[0].timeMs) return launchCurve.getPoint(0.62);
    if (timeMs >= horizonsData[horizonsData.length - 1].timeMs) {
      return horizonsData[horizonsData.length - 1].pos.clone();
    }
    return horizonsLookup(horizonsData, timeMs).pos;
  }

  return trajectoryCurve.getPoint(checkpoint.progress);
}

export function getSolarDirection(nowMs) {
  const julianDay = nowMs / 86400000 + 2440587.5;
  const n = julianDay - 2451545.0;
  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * n) % 360;
  const lambda = meanLongitude + 1.915 * Math.sin(meanAnomaly * DEG2RAD) + 0.02 * Math.sin(2 * meanAnomaly * DEG2RAD);
  const obliquity = 23.439 - 0.0000004 * n;
  const lambdaRad = lambda * DEG2RAD;
  const obliquityRad = obliquity * DEG2RAD;
  const x = Math.cos(lambdaRad);
  const y = Math.sin(obliquityRad) * Math.sin(lambdaRad);
  const z = Math.cos(obliquityRad) * Math.sin(lambdaRad);
  return new THREE.Vector3(x, y, z).normalize();
}

export function updateMetrics(earth, moon, spacecraft, progress, liveSpeedKmH = null) {
  const earthPos = earth.getWorldPosition(new THREE.Vector3());
  const moonPos = moon.getWorldPosition(new THREE.Vector3());
  const shipPos = spacecraft.getWorldPosition(new THREE.Vector3());
  metricDistanceAE.textContent = formatKm(earthPos.distanceTo(shipPos) / SCENE_MOON_DISTANCE * KM_SCALE);
  metricDistanceAM.textContent = formatKm(moonPos.distanceTo(shipPos) / SCENE_MOON_DISTANCE * KM_SCALE);
  const speedKmH = liveSpeedKmH !== null ? liveSpeedKmH : getVelocityKmH(progress);
  metricSpeed.textContent = `${speedKmH.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/h`;
}

export function createTrajectoryCurve() {
  const D = SCENE_MOON_DISTANCE;
  const R = SCENE_EARTH_RADIUS;
  const points = [
    new THREE.Vector3( R * 1.08,  0.05,  D * 0.05),
    new THREE.Vector3( D * 0.22,  0.5,   D * 0.18),
    new THREE.Vector3( D * 0.50,  0.5,   D * 0.14),
    new THREE.Vector3( D * 0.74,  0.3,   D * 0.06),
    new THREE.Vector3( D * 0.82,  0.05,  0        ),
    new THREE.Vector3( D * 0.74, -0.20, -D * 0.06),
    new THREE.Vector3( D * 0.50, -0.45, -D * 0.14),
    new THREE.Vector3( D * 0.22, -0.50, -D * 0.18),
    new THREE.Vector3( R * 1.12, -0.08, -D * 0.05),
  ];
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.12);
}

// Planned (future) tube, bright at Orion end and fading toward Earth arrival
export function createFadingPlannedTube(curve, tubularSegments, radius, radialSegments) {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const ringCount = radialSegments + 1;
  const colors = new Float32Array((tubularSegments + 1) * ringCount * 3);
  for (let i = 0; i <= tubularSegments; i++) {
    const fade = 0.22 + 0.78 * Math.pow(1.0 - i / tubularSegments, 1.4);
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

export function createFadingTube(curve, tubularSegments, radius, radialSegments) {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const ringCount = radialSegments + 1;
  const colors = new Float32Array((tubularSegments + 1) * ringCount * 3);
  for (let i = 0; i <= tubularSegments; i++) {
    const fade = Math.pow(i / tubularSegments, 1.8);
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

export function createSpacecraftModel() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9dee8, emissive: 0x152033, emissiveIntensity: 0.52, metalness: 0.56, roughness: 0.42 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a3a6b, emissive: 0x0a1a40, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.55 });

  // Crew module
  const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.20, 12), bodyMat);
  cm.position.y = 0.21;
  group.add(cm);

  // Service module
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12), bodyMat.clone());
  sm.position.y = 0.05;
  group.add(sm);

  // Solar panels
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

  // Invisible hit-sphere for reliable hover detection at any zoom
  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitArea.userData.isHitArea = true;
  group.add(hitArea);

  return group;
}

async function loadTexture(loader, url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { console.warn(`Texture load timed out: ${url}`); resolve(null); }, timeoutMs);
    loader.load(url, (tex) => { clearTimeout(timer); resolve(tex); }, undefined, () => { clearTimeout(timer); resolve(null); });
  });
}

export async function initScene(horizonsData = null, moonData = null) {
  if (!moonData?.length) throw new Error("moon_trajectory.json is required");
  // Rotate the Moon display into the flyby view so the rendered flyby remains readable.
  const displayMoonData = buildMoonDisplayData(moonData, horizonsData) || moonData;
  const displayHorizonsData = horizonsData ? buildOrionDisplayData(horizonsData, displayMoonData) : horizonsData;
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
  earth.scale.setScalar(VISUAL_EARTH_SCALE);
  earthGroup.add(earth);

  const earthGlow = new THREE.Mesh(
    new THREE.SphereGeometry(SCENE_EARTH_RADIUS * 1.09, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x58d8ff, transparent: true, opacity: 0.28 })
  );
  earthGlow.scale.setScalar(VISUAL_EARTH_SCALE);
  earthGroup.add(earthGlow);

  const axisExtent = SCENE_EARTH_RADIUS * 2.8;
  const earthAxisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -axisExtent, 0),
    new THREE.Vector3(0, axisExtent, 0),
  ]);
  const earthAxisLine = new THREE.Line(
    earthAxisGeometry,
    new THREE.LineDashedMaterial({
      color: 0x9fe8ff,
      dashSize: SCENE_EARTH_RADIUS * 0.22,
      gapSize: SCENE_EARTH_RADIUS * 0.12,
      transparent: true,
      opacity: 0.9
    })
  );
  earthAxisLine.computeLineDistances();
  earthGroup.add(earthAxisLine);

  const poleMaterial = new THREE.MeshBasicMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.95 });
  const northPole = new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_RADIUS * 0.045, 12, 12), poleMaterial);
  northPole.position.set(0, axisExtent, 0);
  earthGroup.add(northPole);
  const southPole = new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_RADIUS * 0.045, 12, 12), poleMaterial);
  southPole.position.set(0, -axisExtent, 0);
  earthGroup.add(southPole);

  // moonPivot kept only for fitSceneToView box calculation; Moon position is set directly each frame
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
  moon.scale.setScalar(VISUAL_MOON_SCALE);
  // Place the Moon directly in the scene (not parented to moonPivot) so its
  // position can be set each frame from the ephemeris.
  scene.add(moon);
  moon.position.copy(getMoonPosition(getSceneTimeMs(), displayMoonData));

  // Render the Moon orbit in the same Earth-centered plane defined by the
  // free-return flyby radius and local trajectory tangent.
  const moonTrailSampleCount = 180;
  const moonOrbitGeometry = new THREE.BufferGeometry();
  moonOrbitGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(moonTrailSampleCount * 3), 3));
  moonOrbitGeometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(moonTrailSampleCount * 3), 3));
  const moonOrbitLine = new THREE.Line(
    moonOrbitGeometry,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  scene.add(moonOrbitLine);

  // Find TLI burn (max speed in first quarter) and store it for the animate loop.
  let tliIdx = 0;
  if (displayHorizonsData) {
    const quarter = Math.ceil(displayHorizonsData.length / 4);
    for (let i = 1; i < quarter; i++) {
      if (displayHorizonsData[i].speedKmH > displayHorizonsData[tliIdx].speedKmH) tliIdx = i;
    }
  }

  // Generate dense Keplerian parking-orbit data (20-min steps) from the
  // orbital elements derived from the coarse HORIZONS data. This produces
  // the correct full ellipse, with apogee on the far side of Earth plus the TLI
  // perigee, that the 3-hour HORIZONS step is too sparse to show properly.
  const parkingOrbit = displayHorizonsData ? generateParkingOrbitData(displayHorizonsData, tliIdx) : null;

  let trajectoryCurve;
  if (displayHorizonsData) {
    let allPts;
    if (parkingOrbit?.pts?.length) {
      // Keplerian arc from first perigee to full orbit to TLI perigee.
      const keplPts   = parkingOrbit.pts.map(p => p.pos.clone());
      const bridgePts = buildTliBridgePoints(parkingOrbit, displayHorizonsData, tliIdx);
      const postPts   = displayHorizonsData.slice(tliIdx + 1).map(p => p.pos.clone());
      allPts = [...keplPts, ...bridgePts, ...postPts];
    } else {
      allPts = buildTrajectoryPointList(displayHorizonsData, tliIdx);
    }
    trajectoryCurve = new THREE.CatmullRomCurve3(allPts, false, "centripetal", 0.5);
  } else {
    trajectoryCurve = createTrajectoryCurve();
  }
  const trajectoryRadius = Math.max(0.025, SCENE_EARTH_RADIUS * 0.0095);
  let liveTrajectoryGeometry = new THREE.TubeGeometry(trajectoryCurve, 64, trajectoryRadius, 12, false);
  const liveTrajectoryLine = new THREE.Mesh(
    liveTrajectoryGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x5a2010, emissiveIntensity: 0.62, roughness: 0.6, metalness: 0.15 })
  );
  scene.add(liveTrajectoryLine);

  let plannedTrajectoryGeometry = createFadingPlannedTube(
    createLinearPath(trajectoryCurve.getPoints(96)),
    96, trajectoryRadius * 0.52, 10
  );
  const plannedTrajectoryLine = new THREE.Mesh(
    plannedTrajectoryGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x1f3954, emissiveIntensity: 0.85, roughness: 0.45, metalness: 0.08 })
  );
  scene.add(plannedTrajectoryLine);

  const spacecraft = createSpacecraftModel();
  scene.add(spacecraft);

  const checkpointMeshes = [];
  const checkpointPositions = new Map();
  const checkpointLayer = new THREE.Group();
  scene.add(checkpointLayer);

  missionData.checkpoints.forEach((checkpoint) => {
    const position = getCheckpointPosition(checkpoint, trajectoryCurve, displayHorizonsData, tliIdx, parkingOrbit);
    checkpoint.position = position;
    checkpointPositions.set(checkpoint.id, position.clone());

    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xffe182 })
    );
    node.position.copy(position);
    node.userData.checkpointId = checkpoint.id;
    checkpointLayer.add(node);
    checkpointMeshes.push(node);
  });

  const diagnostics = validateTrajectoryModel({
    trajectoryCurve,
    horizonsData: displayHorizonsData,
    parkingOrbit,
    tliIdx,
    checkpointPositions,
  });
  globalThis.__trajectoryValidation = diagnostics;
  if (!diagnostics.ok) {
    throw new Error(`Trajectory validation failed: ${diagnostics.errors.join(" ")}`);
  }
  if (diagnostics.warnings.length) {
    console.warn("Trajectory validation warnings:", diagnostics.warnings, diagnostics.metrics);
  } else {
    console.info("Trajectory validation passed:", diagnostics.metrics);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const fitBox = new THREE.Box3();
  const fitCenter = new THREE.Vector3();
  const fitSize = new THREE.Vector3();
  const fitObjects = [earthGroup, moon, liveTrajectoryLine, plannedTrajectoryLine, checkpointLayer, spacecraft];

  // Store focusCheckpoint so ui.js can call it via the shared mutable ref
  missionModule.focusRef.fn = (checkpointId) => {
    const checkpoint = missionData.checkpoints.find(item => item.id === checkpointId);
    if (!checkpoint?.position) return;
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
    // Re-anchor the Orion status card to the new canvas bounds
    updateOrionCard();
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
      missionModule.setDetail(checkpointId);
      missionModule.focusRef.fn?.(checkpointId);
      openNewsModalAt(checkpointId);
    }
  }

  const nodeCard = document.querySelector("#node-card");

  function showNodeCard(checkpointId, clientX, clientY) {
    const cp = getCheckpoint(checkpointId);
    if (!cp) return;
    const isFuture = isCheckpointFuture(cp, getSceneTimeMs());
    const copy = getTranslations(getCurrentLanguage());
    nodeCard.innerHTML = `
      <p class="eyebrow">${isFuture ? copy.upcoming : copy.completed}</p>
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

  // Update the Orion status card, pinned to the spacecraft's projected screen position
  function updateOrionCard() {
    const ae = metricDistanceAE.textContent;
    const am = metricDistanceAM.textContent;
    const spd = metricSpeed.textContent;
    const nowMs = getSceneTimeMs();
    const pct = Math.round(getMissionProgress(nowMs) * 100);
    const utc = new Date(nowMs).toUTCString();
    const copy = getTranslations(getCurrentLanguage());
    orionCard.innerHTML = `
      <p class="eyebrow">${copy.orionStatus}</p>
      <dl class="orion-card-dl">
        <dt>${copy.missionProgress}</dt><dd>${pct}%</dd>
        <dt>${copy.timeLabel}</dt><dd style="font-size:0.78rem">${utc}</dd>
        <dt>${copy.distanceEarthLabel}</dt><dd>${ae}</dd>
        <dt>${copy.distanceMoonLabel}</dt><dd>${am}</dd>
        <dt>${copy.speedLabel}</dt><dd>${spd}</dd>
      </dl>`;
    const projected = spacecraft.position.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const sx = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;
    const cardW = orionCard.offsetWidth || 220;
    const cardH = orionCard.offsetHeight || 180;
    const canvasLeft = rect.left + 8;
    const canvasRight = rect.right - cardW - 8;
    const canvasTop = rect.top + 8;
    const canvasBottom = rect.bottom - cardH - 8;
    const shipInsideCanvas = projected.z <= 1 && projected.z >= -1 && sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom;
    let left = THREE.MathUtils.clamp(sx + 48, canvasLeft, canvasRight);
    let top = THREE.MathUtils.clamp(sy - cardH - 26, canvasTop, canvasBottom);

    if (!shipInsideCanvas || canvasRight <= canvasLeft) {
      left = THREE.MathUtils.clamp(rect.left + (rect.width - cardW) * 0.5, canvasLeft, Math.max(canvasLeft, canvasRight));
      top = canvasBottom;
    }

    orionCard.style.left = `${left}px`;
    orionCard.style.top = `${top}px`;
    const anchorY = top + cardH / 2;
    const dx = sx - left;
    const dy = sy - anchorY;
    const leaderLength = Math.max(18, Math.hypot(dx, dy));
    const leaderAngle = Math.atan2(dy, dx) - Math.PI;
    orionCard.style.setProperty("--leader-length", `${leaderLength}px`);
    orionCard.style.setProperty("--leader-angle", `${leaderAngle}rad`);
    orionCard.hidden = false;
  }

  let hoveredCheckpointId = null;

  function onPointerMove(event) {
    const { x, y, clientX, clientY } = getCanvasPointer(event);
    pointer.x = x;
    pointer.y = y;
    raycaster.setFromCamera(pointer, camera);

    // Spacecraft hover: change cursor only. The card stays visible.
    const hitSphere = spacecraft.children.find(c => c.userData.isHitArea);
    const shipHits = hitSphere ? raycaster.intersectObject(hitSphere) : [];
    if (shipHits.length > 0) {
      closeNewsModal();
      renderer.domElement.style.cursor = "crosshair";
    } else {
      renderer.domElement.style.cursor = "";
    }

    // Checkpoint node hover
    const nodeHits = raycaster.intersectObjects(checkpointMeshes);
    if (nodeHits.length > 0) {
      const checkpointId = nodeHits[0].object.userData.checkpointId;
      if (checkpointId !== hoveredCheckpointId) {
        hoveredCheckpointId = checkpointId;
        showNodeCard(checkpointId, clientX, clientY);
        renderer.domElement.style.cursor = "pointer";
      } else {
        showNodeCard(checkpointId, clientX, clientY);
      }
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
    const { earthRotation, moonRotation } = getRealTimeAngles(nowMs);
    const solarDirection = getSolarDirection(nowMs);

    earth.rotation.y = earthRotation;
    moon.rotation.y = moonRotation;
    // Position Moon using low-precision ephemeris in ICRF equatorial frame
    moon.position.copy(getMoonPosition(nowMs, displayMoonData));
    const moonTrail = buildMoonDisplayOrbit(displayMoonData, nowMs, 360, moonTrailSampleCount);
    const moonTrailPositions = moonOrbitGeometry.getAttribute("position");
    const moonTrailColors = moonOrbitGeometry.getAttribute("color");
    moonTrail.forEach((sample, index) => {
      moonTrailPositions.setXYZ(index, sample.pos.x, sample.pos.y, sample.pos.z);
      const alpha = sample.alpha;
      const color = new THREE.Color().setHSL(
        THREE.MathUtils.lerp(0.59, 0.57, alpha),
        THREE.MathUtils.lerp(0.42, 0.68, alpha),
        THREE.MathUtils.lerp(0.34, 0.82, alpha)
      );
      moonTrailColors.setXYZ(
        index,
        color.r * THREE.MathUtils.lerp(0.18, 1, alpha),
        color.g * THREE.MathUtils.lerp(0.18, 1, alpha),
        color.b * THREE.MathUtils.lerp(0.18, 1, alpha)
      );
    });
    moonTrailPositions.needsUpdate = true;
    moonTrailColors.needsUpdate = true;
    keyLight.position.copy(solarDirection).multiplyScalar(42);
    fillLight.position.copy(solarDirection).multiplyScalar(-18).add(new THREE.Vector3(-4, 3, 0));

    const progress = displayHorizonsData ? horizonsProgress(displayHorizonsData, nowMs) : getMissionProgress(nowMs);
    // Use dense Keplerian arc for ship position while in the parking orbit phase
    // (gives accurate perigee/apogee altitude vs coarse 3 h HORIZONS steps)
    const inParkingOrbit = parkingOrbit?.pts?.length && nowMs <= (parkingOrbit.t_perigee_2_ms ?? 0);
    const horizonsLive = displayHorizonsData
      ? (inParkingOrbit ? horizonsLookup(parkingOrbit.pts, nowMs) : horizonsLookup(displayHorizonsData, nowMs))
      : null;
    const shipPoint = horizonsLive ? horizonsLive.pos : trajectoryCurve.getPoint(progress);
    const nextPoint = displayHorizonsData
      ? horizonsLookup(displayHorizonsData, nowMs + 10800000).pos
      : trajectoryCurve.getPoint(Math.min(progress + 0.01, 0.99));

    let completedCurve, remainingCurve, completedSegs, remainingSegs;
    if (displayHorizonsData) {
      let ci = 0;
      while (ci < displayHorizonsData.length - 2 && displayHorizonsData[ci + 1].timeMs <= nowMs) ci++;
      let completedPts;
      let remainingPts;
      if (ci < tliIdx) {
        if (parkingOrbit?.pts?.length) {
          // Keplerian arc: completed portion up to now, then ship
          const orbitComp = parkingOrbit.pts
            .filter(p => p.timeMs <= nowMs)
            .map(p => p.pos.clone());
          completedPts = [...orbitComp, shipPoint.clone()];

          // Remaining: rest of parking orbit, then the TLI bridge, then post-TLI HORIZONS
          const orbitRem = parkingOrbit.pts
            .filter(p => p.timeMs > nowMs)
            .map(p => p.pos.clone());
          const bridgePts = buildTliBridgePoints(parkingOrbit, displayHorizonsData, tliIdx);
          remainingPts = [
            shipPoint.clone(),
            ...orbitRem,
            ...bridgePts,
            ...displayHorizonsData.slice(tliIdx + 1).map(p => p.pos.clone()),
          ];
        } else {
          // Fallback: arc-densified HORIZONS data (no Keplerian orbit available)
          const dComp = [];
          for (let i = 0; i <= ci; i++) {
            if (i > 0) dComp.push(...densifyArc(displayHorizonsData[i - 1].pos, displayHorizonsData[i].pos, 4));
            dComp.push(displayHorizonsData[i].pos.clone());
          }
          dComp.push(shipPoint.clone());
          completedPts = dComp;
          const dRem = [shipPoint.clone()];
          let prevRem = shipPoint;
          for (let i = ci + 1; i <= tliIdx; i++) {
            dRem.push(...densifyArc(prevRem, displayHorizonsData[i].pos, 4));
            dRem.push(displayHorizonsData[i].pos.clone());
            prevRem = displayHorizonsData[i].pos;
          }
          remainingPts = [...dRem, ...displayHorizonsData.slice(tliIdx + 1).map(p => p.pos.clone())];
        }
      } else if (ci === tliIdx) {
        // Ship is in the TLI window (between HORIZONS pts tliIdx and tliIdx+1).
        // Split into pre-TLI (still on Keplerian arc) and post-TLI (ascending from perigee).
        const tliPt = parkingOrbit?.pts?.[parkingOrbit.pts.length - 1]?.pos.clone()
          ?? displayHorizonsData[tliIdx].pos.clone();
        if (inParkingOrbit) {
          // Still descending to TLI perigee on Keplerian arc
          const keplComp = parkingOrbit.pts.filter(p => p.timeMs <= nowMs).map(p => p.pos.clone());
          completedPts = [...keplComp, shipPoint.clone()];
          const keplRem = parkingOrbit.pts.filter(p => p.timeMs > nowMs).map(p => p.pos.clone());
          const bridgePts = buildTliBridgePoints(parkingOrbit, displayHorizonsData, tliIdx);
          remainingPts = [shipPoint.clone(), ...keplRem, ...bridgePts,
            ...displayHorizonsData.slice(tliIdx + 1).map(p => p.pos.clone())];
        } else {
          // Post-TLI perigee: ship is ascending, interpolated from HORIZONS linear lerp
          const keplPts = parkingOrbit?.pts?.map(p => p.pos.clone()) ?? [];
          const bridgeToShip = buildTliBridgePoints(parkingOrbit, displayHorizonsData, tliIdx, tliPt, shipPoint, 8);
          completedPts = [...keplPts, ...bridgeToShip, shipPoint.clone()];
          const bridgeToPost = buildTliBridgePoints(parkingOrbit, displayHorizonsData, tliIdx, shipPoint, displayHorizonsData[tliIdx + 1].pos, 8);
          remainingPts = [shipPoint.clone(), ...bridgeToPost,
            ...displayHorizonsData.slice(tliIdx + 1).map(p => p.pos.clone())];
        }
      } else {
        // Post-TLI: use Keplerian arc for the parking-orbit portion, then HORIZONS
        const keplPts = parkingOrbit?.pts?.map(p => p.pos.clone()) ?? [];
        const bridgePts = buildTliBridgePoints(parkingOrbit, displayHorizonsData, tliIdx);
        completedPts = [...keplPts, ...bridgePts,
          ...displayHorizonsData.slice(tliIdx + 1, ci + 1).map(p => p.pos.clone()), shipPoint.clone()];
        remainingPts = [shipPoint.clone(), ...displayHorizonsData.slice(ci + 1).map(p => p.pos.clone())];
      }
      // Strip any remaining points that fall inside the Earth's visual radius.
      // The clamped-to-skin points on the return leg can cause the spline to
      // dip through the globe when interpolated over a large gap.
      const earthClearance = SCENE_EARTH_RADIUS * 1.05;
      remainingPts = remainingPts.filter(p => p.length() >= earthClearance);
      if (remainingPts.length < 2 || remainingPts[0]?.distanceTo(shipPoint) > 0.001) {
        remainingPts.unshift(shipPoint.clone());
      }

      completedSegs = Math.max(32, completedPts.length * 3);
      remainingSegs = Math.max(24, remainingPts.length * 3);
      completedCurve = completedPts.length >= 2
        ? new THREE.CatmullRomCurve3(completedPts, false, "centripetal", 0.5)
        : createLinearPath(completedPts);
      // Use chordal (alpha=1) for the remaining/return path. It follows the data
      // points more faithfully and prevents the spline cutting behind Earth.
      remainingCurve = remainingPts.length >= 2
        ? new THREE.CatmullRomCurve3(remainingPts, false, "chordal", 1.0)
        : createLinearPath(remainingPts);
    } else {
      const numCompleted = Math.max(8, Math.floor(220 * progress));
      completedSegs = Math.max(24, numCompleted);
      completedCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: numCompleted + 1 }, (_, i) =>
          trajectoryCurve.getPoint((progress * i) / numCompleted)
        ),
        false, "centripetal", 0.12
      );
      const numRemaining = Math.max(8, Math.floor(220 * (1 - progress)));
      remainingSegs = Math.max(18, numRemaining);
      remainingCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: numRemaining + 1 }, (_, index) => {
          const t = progress + ((1 - progress) * index / Math.max(1, numRemaining));
          return trajectoryCurve.getPoint(Math.min(t, 0.999));
        }),
        false, "centripetal", 0.12
      );
    }
    const nextGeometry = createFadingTube(completedCurve, completedSegs, trajectoryRadius, 12);
    const nextPlannedGeometry = createFadingPlannedTube(remainingCurve, remainingSegs, trajectoryRadius * 0.52, 10);
    liveTrajectoryLine.geometry.dispose();
    liveTrajectoryLine.geometry = nextGeometry;
    plannedTrajectoryLine.geometry.dispose();
    plannedTrajectoryLine.geometry = nextPlannedGeometry;
    spacecraft.position.copy(shipPoint);
    spacecraft.lookAt(nextPoint);
    spacecraft.rotateX(Math.PI / 2);

    checkpointMeshes.forEach((mesh) => {
      const active = mesh.userData.checkpointId === missionModule.selectedCheckpointId;
      const checkpoint = getCheckpoint(mesh.userData.checkpointId);
      const isFuture = checkpoint && isCheckpointFuture(checkpoint, nowMs);
      const pulse = 1 + Math.sin(elapsed * 3 + mesh.position.x) * 0.08;
      mesh.material.color.setHex(isFuture ? 0x8ed1ff : 0xffe182);
      mesh.scale.setScalar(active ? pulse * 1.35 : pulse * 0.92);
    });

    // Keep the lunar-flyby marker on the planned Artemis path at flyby time.
    const flybyMesh = displayHorizonsData && checkpointMeshes.find(m => m.userData.checkpointId === "lunar-flyby");
    if (flybyMesh && displayHorizonsData) {
      const flybyCheckpoint = getCheckpoint("lunar-flyby");
      if (flybyCheckpoint) {
        const flybyPos = horizonsLookup(displayHorizonsData, new Date(flybyCheckpoint.time).getTime()).pos;
        flybyMesh.position.copy(flybyPos);
        flybyCheckpoint.position = flybyPos.clone();
      }
    }

    refreshCheckpointListState(nowMs);
    controls.update();
    updateMetrics(earth, moon, spacecraft, progress, horizonsLive?.speedKmH ?? null);
    // Always update the Orion card. It is permanently visible at the canvas bottom-left.
    updateOrionCard();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
  return diagnostics;
}
