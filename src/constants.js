export const KM_SCALE = 384400;
export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737.4;
export const SCENE_EARTH_RADIUS = 0.42;
export const SCENE_MOON_DISTANCE = 19.2;
export const SCENE_MOON_RADIUS = SCENE_EARTH_RADIUS * (MOON_RADIUS_KM / EARTH_RADIUS_KM);
export const EARTH_SIDEREAL_SECONDS = 86164.0905;
export const MOON_SIDEREAL_SECONDS = 27.321661 * 86400;
export const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const DEG2RAD = Math.PI / 180;
export const NASA_API_KEY = "DEMO_KEY";

export const REMOTE_ASSETS = {
  earthColor: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  earthSpecular: "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
  moonColor: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
  orionModel: ""
};

export const LIVE_ENDPOINTS = {
  artemisFeed: "https://www.nasa.gov/missions/artemis/feed/",
  imageSearch: `https://images-api.nasa.gov/search?q=Artemis%20II&media_type=image&page=1`
};

export const LOCAL_NEWS_IMAGES = {
  default: "./assets/mission_logo.jpeg",
  launch: "./assets/mission_logo.jpeg",
  "meco-staging": "./assets/mission_logo.jpeg",
  "spacecraft-separation": "./assets/mission_logo.jpeg",
  "high-earth-checkout": "./assets/mission_logo.jpeg",
  tli: "./assets/artemis2_map.jpg",
  "lunar-flyby": "./assets/artemis2_map.jpg",
  "max-distance": "./assets/artemis2_map.jpg",
  "crew-module-sep": "./assets/mission_logo.jpeg",
  reentry: "./assets/mission_logo.jpeg",
  splashdown: "./assets/mission_logo.jpeg",
};

export const VELOCITY_PROFILE = [
  [0.00,     0],
  [0.02, 28160],
  [0.12, 37800],
  [0.22, 12000],
  [0.35,  5500],
  [0.45,  3400],
  [0.53,  3100],
  [0.55,  2800],
  [0.65,  3600],
  [0.75,  6000],
  [0.85, 12000],
  [0.93, 25000],
  [0.96, 36000],
  [0.98, 40000],
  [1.00,     0],
];

export const DEFAULT_MISSION_DATA = {
  missionName: "Artemis II",
  launchDate: "2026-04-01T22:35:00Z",
  checkpoints: [
    {
      id: "launch",
      label: "Launch",
      time: "2026-04-01T22:35:00Z",
      progress: 0.02,
      summary: "Orion lifts off aboard SLS from Kennedy Space Center. The four SLS solid rocket boosters produce 7.2 million pounds of thrust. At T+2 min the solid rocket boosters separate, completing the first phase of ascent.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/nasa-sets-coverage-for-artemis-ii-moon-mission/",
      imageUrl: ""
    },
    {
      id: "meco-staging",
      label: "MECO & Stage Separation",
      time: "2026-04-01T22:43:00Z",
      progress: 0.03,
      summary: "Main Engine Cutoff (MECO) at T+8 min. The SLS core stage separates at ~160 km altitude. Orion is travelling at 28,160 km/h. The ICPS (Interim Cryogenic Propulsion Stage) takes over for the next burn.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
      imageUrl: ""
    },
    {
      id: "spacecraft-separation",
      label: "Orion Spacecraft Separation",
      time: "2026-04-01T23:10:00Z",
      progress: 0.04,
      summary: "Orion separates from the ICPS at T+~35 min. Solar arrays fully deploy. The spacecraft is now autonomous in the 43,730 × 185 km high-Earth elliptical parking orbit. Crew begins initial system health checks.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
      imageUrl: ""
    },
    {
      id: "high-earth-checkout",
      label: "High Earth Orbit Checkout",
      time: "2026-04-02T19:00:00Z",
      progress: 0.09,
      summary: "Over about 20 hours in the high elliptical parking orbit (185 × 70,375 km), the crew systematically verifies all Orion systems, including life support, navigation, propulsion, and communications, before committing to the translunar trajectory.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
      imageUrl: ""
    },
    {
      id: "tli",
      label: "Translunar Injection",
      time: "2026-04-02T23:49:00Z",
      progress: 0.12,
      summary: "A 5 min 51 s ICPS burn (ΔV 388 m/s) sends Orion out of high Earth orbit onto a free-return translunar trajectory. No lunar orbit insertion is needed. The Moon's gravity bends the path and returns the crew to Earth automatically.",
      sourceUrl: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
      imageUrl: ""
    },
    {
      id: "lunar-flyby",
      label: "Lunar Flyby",
      time: "2026-04-06T17:00:00Z",
      progress: 0.53,
      summary: "Orion reaches its closest approach to the Moon on the hybrid free-return trajectory. The Moon's gravity bends the spacecraft's path back toward Earth without a lunar orbit insertion burn. The crew briefly loses radio contact.",
      sourceUrl: "https://svs.gsfc.nasa.gov/5610/",
      imageUrl: ""
    },
    {
      id: "max-distance",
      label: "Distance Record",
      time: "2026-04-06T23:00:00Z",
      progress: 0.56,
      summary: "At 413,174 km from Earth, Orion breaks the human spaceflight distance record set by Apollo 13 in 1970 (400,171 km). The crew is farther from home than any human in history.",
      sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
      imageUrl: ""
    },
    {
      id: "crew-module-sep",
      label: "Service Module Separation",
      time: "2026-04-10T23:21:00Z",
      progress: 0.95,
      summary: "The European Service Module (ESM) is jettisoned ~45 min before splashdown. Only the conical crew capsule continues to Earth. The ESM burns up in the atmosphere. The heat shield is now fully exposed for re-entry.",
      sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
      imageUrl: ""
    },
    {
      id: "reentry",
      label: "Atmosphere Re-entry",
      time: "2026-04-10T23:53:00Z",
      progress: 0.97,
      summary: "Orion hits Earth's atmosphere at 40,000 km/h. The Orion heat shield reaches 2,760 °C, hotter than the surface of the Sun. A skip-entry maneuver reduces peak g-forces and improves Pacific splashdown accuracy.",
      sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
      imageUrl: ""
    },
    {
      id: "splashdown",
      label: "Splashdown",
      time: "2026-04-11T00:06:00Z",
      progress: 0.98,
      summary: "Drogue chutes deploy at 7.6 km, main chutes at 3 km. Orion splashes down in the Pacific Ocean off San Diego at ~32 km/h, completing a 1.1 million km round trip and the first crewed deep-space mission since Apollo 17.",
      sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
      imageUrl: ""
    }
  ]
};
