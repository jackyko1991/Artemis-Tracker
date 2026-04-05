import { DEFAULT_MISSION_DATA } from "./constants.js";

const CHECKPOINT_TEXT = {
  en: {
    launch: {
      label: "Launch",
      summary: "Orion lifts off aboard SLS from Kennedy Space Center. The four SLS solid rocket boosters produce 7.2 million pounds of thrust. At T+2 min the solid rocket boosters separate, completing the first phase of ascent.",
    },
    "meco-staging": {
      label: "MECO & Stage Separation",
      summary: "Main Engine Cutoff (MECO) at T+8 min. The SLS core stage separates at ~160 km altitude. Orion is travelling at 28,160 km/h. The ICPS (Interim Cryogenic Propulsion Stage) takes over for the next burn.",
    },
    "spacecraft-separation": {
      label: "Orion Spacecraft Separation",
      summary: "Orion separates from the ICPS at T+~35 min. Solar arrays fully deploy. The spacecraft is now autonomous in the 43,730 × 185 km high-Earth elliptical parking orbit. Crew begins initial system health checks.",
    },
    "high-earth-checkout": {
      label: "High Earth Orbit Checkout",
      summary: "Over about 20 hours in the high elliptical parking orbit (185 × 70,375 km), the crew systematically verifies all Orion systems, including life support, navigation, propulsion, and communications, before committing to the translunar trajectory.",
    },
    tli: {
      label: "Translunar Injection",
      summary: "A 5 min 51 s ICPS burn (ΔV 388 m/s) sends Orion out of high Earth orbit onto a free-return translunar trajectory. No lunar orbit insertion is needed. The Moon's gravity bends the path and returns the crew to Earth automatically.",
    },
    "lunar-flyby": {
      label: "Lunar Flyby",
      summary: "Orion reaches its closest approach to the Moon on the hybrid free-return trajectory. The Moon's gravity bends the spacecraft's path back toward Earth without a lunar orbit insertion burn. The crew briefly loses radio contact.",
    },
    "max-distance": {
      label: "Distance Record",
      summary: "At 413,174 km from Earth, Orion breaks the human spaceflight distance record set by Apollo 13 in 1970 (400,171 km). The crew is farther from home than any human in history.",
    },
    "crew-module-sep": {
      label: "Service Module Separation",
      summary: "The European Service Module (ESM) is jettisoned ~45 min before splashdown. Only the conical crew capsule continues to Earth. The ESM burns up in the atmosphere. The heat shield is now fully exposed for re-entry.",
    },
    reentry: {
      label: "Atmosphere Re-entry",
      summary: "Orion hits Earth's atmosphere at 40,000 km/h. The Orion heat shield reaches 2,760 °C, hotter than the surface of the Sun. A skip-entry maneuver reduces peak g-forces and improves Pacific splashdown accuracy.",
    },
    splashdown: {
      label: "Splashdown",
      summary: "Drogue chutes deploy at 7.6 km, main chutes at 3 km. Orion splashes down in the Pacific Ocean off San Diego at ~32 km/h, completing a 1.1 million km round trip and the first crewed deep-space mission since Apollo 17.",
    },
  },
  "zh-Hant": {
    launch: {
      label: "發射",
      summary: "獵戶座由 SLS 自甘迺迪太空中心發射升空。四枚固體火箭助推器共提供 720 萬磅推力。發射後約 2 分鐘，固體助推器分離，完成第一階段上升。",
    },
    "meco-staging": {
      label: "主引擎關機與級間分離",
      summary: "主引擎關機（MECO）發生在發射後約 8 分鐘。SLS 核心級在約 160 公里高度分離，獵戶座速度約為每小時 28,160 公里。之後由 ICPS 接手下一次點火。",
    },
    "spacecraft-separation": {
      label: "獵戶座飛船分離",
      summary: "獵戶座在發射後約 35 分鐘與 ICPS 分離，太陽能板完全展開。太空船此時已自主進入 43,730 × 185 公里的高橢圓停泊軌道，組員開始初步系統健康檢查。",
    },
    "high-earth-checkout": {
      label: "高地球軌道檢查",
      summary: "在約 20 小時的高橢圓停泊軌道（185 × 70,375 公里）期間，組員會系統性檢查獵戶座的生命維持、導航、推進與通訊等系統，再決定是否進入月球轉移軌道。",
    },
    tli: {
      label: "月球轉移注入",
      summary: "ICPS 在近地點進行 5 分 51 秒點火（ΔV 388 m/s），讓獵戶座離開高地球軌道，進入自由返回月球轉移軌道。任務不需要月球軌道插入，月球重力會自然彎轉軌跡並帶它回到地球。",
    },
    "lunar-flyby": {
      label: "月球飛越",
      summary: "獵戶座在混合自由返回軌道上到達最接近月球的位置。月球重力會把太空船的路徑彎回地球，而不需要月球軌道插入點火。組員將短暫失去無線電通訊。",
    },
    "max-distance": {
      label: "最遠距離紀錄",
      summary: "當獵戶座距離地球 413,174 公里時，將打破 1970 年阿波羅 13 號創下的載人飛行最遠距離紀錄（400,171 公里）。組員會成為史上離地球最遠的人類。",
    },
    "crew-module-sep": {
      label: "服務艙分離",
      summary: "歐洲服務艙（ESM）會在濺落前約 45 分鐘分離，之後只有錐形返回艙繼續返地。服務艙會在大氣中燒毀，隔熱罩此時完全暴露以準備再入。",
    },
    reentry: {
      label: "重返大氣層",
      summary: "獵戶座以每小時 40,000 公里的速度進入地球大氣層。隔熱罩溫度可達 2,760 °C，比太陽表面還熱。跳躍式再入可降低峰值過載並提高太平洋濺落精度。",
    },
    splashdown: {
      label: "濺落",
      summary: "減速傘在 7.6 公里高度展開，主傘在 3 公里高度展開。獵戶座以約每小時 32 公里的速度在聖地牙哥外海太平洋濺落，完成約 110 萬公里的往返旅程，以及自阿波羅 17 號後首次載人深空任務。",
    },
  },
};

export const TRANSLATIONS = {
  en: {
    languageName: "English",
    pageTitle: "Artemis Flight Tracker",
    topEyebrow: "Live Mission View",
    title: "Artemis Flight Tracker",
    aboutButton: "About",
    techButton: "Tech Note",
    termsButton: "Terminology",
    languageLabel: "Language",
    fitScreen: "Fit Screen",
    viewerFootnote: "Moon display is visually adjusted to keep the flyby readable.",
    missionSnapshot: "Mission Snapshot",
    metricEarthMoon: "Earth to Moon",
    metricArtemisEarth: "Orion spacecraft distance from Earth",
    metricArtemisMoon: "Orion spacecraft distance from Moon",
    metricSpeed: "Orion spacecraft speed",
    missionNodes: "Mission Nodes and Live News",
    liveNews: "Live News",
    openNasa: "Open NASA source",
    upcoming: "Upcoming",
    completed: "Completed",
    orionStatus: "Orion spacecraft live status",
    missionProgress: "Mission progress",
    timeLabel: "Time",
    distanceEarthLabel: "Distance from Earth",
    distanceMoonLabel: "Distance from Moon",
    speedLabel: "Speed",
    loading: "Loading",
    trajectoryLoading: "Trajectory: synthetic (loading…)",
    dataUnavailable: "Trajectory: data unavailable",
    trajectoryBadge: ({ orionCount, moonCount, tliRadiusKm, maxBridgeTurnDeg }) =>
      `Trajectory: NASA JPL HORIZONS · Orion spacecraft ${orionCount} pts · Moon ${moonCount} pts · validated TLI ${tliRadiusKm} km · turn ${maxBridgeTurnDeg} deg`,
    aboutHtml: `
      <h3>Artemis II</h3>
      <p>Artemis II is the first crewed flight of NASA's SLS rocket and Orion spacecraft. It will be the first human mission into deep space since Apollo 17 in 1972. Four astronauts will verify that the spacecraft works properly in the deep-space environment before Artemis III attempts a lunar landing.</p>
      <h3>Crew</h3>
      <ul>
        <li><strong>Reid Wiseman</strong>: Commander (NASA)</li>
        <li><strong>Victor Glover</strong>: Pilot (NASA)</li>
        <li><strong>Christina Koch</strong>: Mission Specialist (NASA)</li>
        <li><strong>Jeremy Hansen</strong>: Mission Specialist (CSA)</li>
      </ul>
      <h3>Free-return trajectory</h3>
      <a href="./assets/artemis2_map.jpg" target="_blank" rel="noopener noreferrer" class="about-map-link">
        <img src="./assets/artemis2_map.jpg" alt="Artemis II trajectory map" class="about-map">
      </a>
      <p>After launch from Kennedy Space Center, a Translunar Injection (TLI) burn sends Orion onto a <strong>free-return path</strong>. No lunar-orbit-insertion burn is needed. The Moon's gravity naturally bends the trajectory back to Earth. The orange arc is the path already flown, and the blue arc is the planned route ahead.</p>
      <h3>Key numbers</h3>
      <ul>
        <li>Max distance from Earth: <strong>406,840 km</strong>, a new human spaceflight record</li>
        <li>Closest Moon approach: <strong>~6,500 km</strong> above the lunar surface</li>
        <li>Total trip distance: <strong>~1.1 million km</strong></li>
        <li>Mission duration: <strong>~10 days</strong></li>
        <li>Entry speed: <strong>~40,000 km/h</strong>, with the heat shield reaching 2,760 °C</li>
      </ul>
      <h3>Data sources</h3>
      <ul>
        <li><strong>Orion trajectory:</strong> <a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a>, spacecraft ID&nbsp;-1024, geocentric ICRF, 3&nbsp;h resolution</li>
        <li><strong>Lunar ephemeris:</strong> <a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a>, Moon ID&nbsp;301, geocentric ICRF, 3&nbsp;h resolution</li>
        <li><strong>Live mission news:</strong> <a class="detail-link" href="https://www.nasa.gov/missions/artemis/" target="_blank" rel="noreferrer">NASA Artemis news feed</a></li>
        <li><strong>Mission imagery:</strong> <a class="detail-link" href="https://images.nasa.gov" target="_blank" rel="noreferrer">NASA Images API</a></li>
      </ul>
      <p class="about-note">Trajectory is pre-launch HORIZONS planning data (3 h steps). Actual close lunar approach (~8,200 km) falls between data points. Checkpoint times are from NASA mission planning documents.</p>
      <p class="about-note" style="margin-top:8px"><a class="detail-link" href="https://github.com/jackyko1991/space-track" target="_blank" rel="noreferrer">Developer docs &amp; source →</a></p>
    `,
    techHtml: `
      <div class="tech-col">
        <h3>Coordinate system &amp; data pipeline</h3>
        <p>Trajectory data is queried from <a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a> in the <strong>ICRF geocentric J2000</strong> frame: X toward the vernal equinox, Z toward the north celestial pole.</p>
        <p>The scene uses a Y-up right-handed frame. The mapping is:</p>
        $$\\vec{r}_{\\text{scene}} = s\\,\\begin{pmatrix}x_\\text{ICRF}\\\\z_\\text{ICRF}\\\\-y_\\text{ICRF}\\end{pmatrix}, \\quad s = \\frac{D_{\\text{scene}}}{D_{\\text{Moon}}} = \\frac{19.2}{384\\,400} \\approx 4.996\\times10^{-5}$$
        <h3>How trajectory data is obtained</h3>
        <p>NASA's <a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">JPL HORIZONS</a> system already provides a table of Orion positions. In that system, Orion is body <strong>−1024</strong>. The positions are measured from the center of Earth and sampled every <strong>3 hours</strong>. That gives us 72 points across the full 10-day mission. The app stores that file locally, so it does not need live API calls while you are viewing the tracker.</p>
        <h3>Orbital mechanics: parking orbit</h3>
        <p>After MECO Orion enters a <strong>43,730 × 185 km</strong> elliptical orbit. Key parameters (\\(\\mu = 398\\,600\\text{ km}^3\\text{s}^{-2}\\)):</p>
        $$a = \\frac{r_a + r_p}{2} \\approx 28{,}329\\text{ km}$$
        $$e = \\frac{r_a - r_p}{r_a + r_p} \\approx 0.768 \\qquad T \\approx 13.2\\text{ h}$$
        <p>Vis-viva equation gives speed at radius \\(r\\):</p>
        $$v = \\sqrt{\\mu\\!\\left(\\tfrac{2}{r} - \\tfrac{1}{a}\\right)}$$
        <h3>HORIZONS data gap &amp; synthetic arc</h3>
        <p>At 3 h steps, HORIZONS returns only <strong>8 points</strong> for the entire parking orbit (T+3.4 h to T+24.4 h). The TLI second perigee, where the ICPS burn fires at \\(r_p = 6{,}556\\text{ km}\\), falls <em>between</em> consecutive data points:</p>
        <table class="tech-table">
          <tr><th>Point</th><th>r (km)</th><th>Mission time</th></tr>
          <tr><td>idx&nbsp;7</td><td>19,087</td><td>T + 24.4 h</td></tr>
          <tr><td><em>TLI perigee</em></td><td><em>6,556</em></td><td><em>T + 25.1 h, missing</em></td></tr>
          <tr><td>idx&nbsp;8</td><td>40,839</td><td>T + 27.4 h</td></tr>
        </table>
        <p>If we simply interpolate between idx&nbsp;7 and idx&nbsp;8, the path never drops below 19,087 km. That makes the TLI node look like it is floating far above Earth instead of happening near perigee altitude.</p>
      </div>
      <div class="tech-col">
        <h3>Trans-Lunar Injection (TLI)</h3>
        <p>TLI is a prograde ICPS burn at perigee. Required \\(\\Delta v\\) for a free-return trajectory:</p>
        $$\\Delta v_\\text{TLI} \\approx \\sqrt{\\mu\\!\\left(\\tfrac{2}{r_p} - \\tfrac{1}{a_\\text{TLI}}\\right)} - \\sqrt{\\tfrac{\\mu}{r_p}} \\approx 0.388\\text{ km/s}$$
        <p>Apoapsis of the resulting conic is about 413,174 km, a new human spaceflight record.</p>
        <h3>Free-return trajectory</h3>
        <p>A <strong>figure-eight</strong> conic. The Moon's gravity rotates the velocity vector so the spacecraft returns without another major propulsion burn. Approximate condition:</p>
        $$r_\\text{apoapsis} \\approx r_\\text{Moon} = 384{,}400\\text{ km}$$
        <p>Closest lunar approach: <strong>~8,200 km</strong> centre-to-centre.</p>
        <h3>Re-entry: skip manoeuvre</h3>
        <p>Orion dips into the upper atmosphere at ≈ 121 km, generates lift at its 32° trim angle, skips out, then re-enters. Entry speed ~11 km/s; heat shield to <strong>2,760 °C</strong>; peak deceleration ≈ 4 g.</p>
        <h3>Keplerian synthesis solution</h3>
        <p>To recover the missing perigee, the app derives orbital elements directly from the HORIZONS data. No external API is needed:</p>
        <ol>
          <li><strong>Orbital plane</strong>: \\(\\hat{h} = \\vec{r}_0 \\times \\vec{r}_1\\) from the first two data points</li>
          <li><strong>Apogee</strong>: maximum-radius point before TLI → \\(r_a\\), \\(\\hat{r}_a\\)</li>
          <li><strong>Elements</strong>: \\(a = (r_a + r_p)/2\\), \\(e = (r_a - r_p)/(r_a + r_p)\\), \\(T = 2\\pi\\sqrt{a^3/\\mu}\\)</li>
          <li><strong>Phase</strong>: true anomaly \\(\\nu_0\\) at first data point, back-calculated to first perigee time \\(t_{\\pi_1}\\)</li>
        </ol>
        <p>Kepler's equation is then solved at 20-minute steps via <strong>Newton–Raphson</strong> iteration:</p>
        $$M = E - e\\sin E \\quad\\Longrightarrow\\quad E_{n+1} = E_n + \\frac{M - E_n + e\\sin E_n}{1 - e\\cos E_n}$$
        <p>This generates a smooth, physically accurate arc from first perigee through apogee to the TLI second perigee, filling the 3 h data gap with &lt;9 min timing error. A tangent-matched outbound bridge then connects the synthetic perigee to the first post-TLI HORIZONS point at 40,839 km, so the turn away from Earth stays smooth.</p>
        <h3>Moon alignment note</h3>
        <p>The Moon display is visually adjusted for readability. The app starts from the raw HORIZONS lunar ephemeris, keeps the Moon close to observation-based sky values, and then applies only a small phase correction so the flyby remains readable. The goal is to stay mostly faithful to the real Moon motion while avoiding a visually misleading miss at the flyby checkpoint.</p>
        <h3>Constraint-guided agentic tuning</h3>
        <p>The current rendering uses a <strong>constraint-guided agentic tuning</strong> approach. In plain terms, the code tests candidate display transforms, checks them against physical and observational constraints, prints the resulting metrics, and only keeps solutions that make sense as a whole.</p>
        <p>Current validation flow:</p>
        <ol>
          <li><strong>Moon first:</strong> start from raw HORIZONS Moon ephemeris and allow only a small phase correction, checked against sky-observation values and motion direction.</li>
          <li><strong>Orion second:</strong> keep the Orion trajectory shape, then apply a rigid display fit with rotation and uniform scale so the flyby loop points toward the Moon without locally bending the path.</li>
          <li><strong>Constraint report:</strong> compare the result against the flyby geometry checks and print a pass/fail checklist so tuning can be judged numerically instead of by eye alone.</li>
        </ol>
        <p>Current constraints:</p>
        <ul>
          <li><strong>Observer check:</strong> topocentric RA/Dec, azimuth, altitude, and distance are compared against reference sky-observation values around the flyby window.</li>
          <li><strong>Hour adjustment:</strong> observation-hour offsets are considered because date-only Moon snapshots can shift noticeably if the underlying hour is wrong.</li>
          <li><strong>Motion direction:</strong> the displayed Moon must continue moving in the expected top-down direction before flyby.</li>
          <li><strong>Flyby distance:</strong> the Moon-to-Orion flyby separation is pushed toward the network and mission-planning closest-approach distance.</li>
          <li><strong>Flyby angle:</strong> the Earth-centered angle between Orion's flyby direction and the Moon is kept small.</li>
          <li><strong>Loop enclosure:</strong> the Orion flyby loop should wrap around the Moon, with the Moon staying close to the center of that loop.</li>
          <li><strong>Raw-data closeness:</strong> large Moon remaps are penalized so the Moon stays close to the raw ephemeris, while Orion fitting is preferred on the display side.</li>
          <li><strong>Transform size:</strong> the Orion rigid fit reports how far it moved from the raw trajectory, so any display correction stays auditable.</li>
        </ul>
        <p>This matters because a result can look visually convincing while still failing the physical checks. The app therefore treats the printed constraint report as part of the model, not just a debugging extra.</p>
        <p>A large-looking tilt is not automatically unrealistic. In the real solar system, the Moon's orbit is inclined by about <strong>5°</strong> to the Earth-Sun orbital plane, and Earth's spin axis is tilted by about <strong>23.4°</strong>. Depending on the viewing angle, those real tilts can make the Moon path look strongly slanted relative to Earth's equator.</p>
        <h3>Spline rendering</h3>
        <p>Post-TLI outbound leg uses <strong>centripetal Catmull–Rom</strong> (\\(\\alpha=0.5\\)); return leg uses <strong>chordal</strong> (\\(\\alpha=1\\)) to prevent the spline cutting behind Earth on the final approach arc.</p>
        <h3>References</h3>
        <ul>
          <li><a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a></li>
          <li><a class="detail-link" href="https://svs.gsfc.nasa.gov/5610/" target="_blank" rel="noreferrer">NASA SVS, Artemis II visualisation</a></li>
          <li><a class="detail-link" href="https://www.nasa.gov/mission/artemis-ii/" target="_blank" rel="noreferrer">NASA Artemis II mission page</a></li>
          <li>Bate, Mueller &amp; White, <em>Fundamentals of Astrodynamics</em>, Dover 1971</li>
        </ul>
      </div>
    `,
    termsHtml: `
      <dl class="terms-list">
        <dt>ICRF</dt><dd>International Celestial Reference Frame, the standard inertial (non-rotating) reference frame for space navigation, defined by distant quasars. All HORIZONS vector data is given in ICRF.</dd>
        <dt>J2000</dt><dd>Epoch Julian Date 2000.0 (2000-Jan-1.5 TDB). Defines the orientation of ICRF axes: X toward the vernal equinox, Z toward the north celestial pole.</dd>
        <dt>Geocentric</dt><dd>Earth-centred. HORIZONS <code>CENTER=500@399</code> places the coordinate origin at Earth's centre of mass, so all position vectors are measured from Earth.</dd>
        <dt>MECO</dt><dd>Main Engine Cut-Off, the moment the SLS RS-25 core-stage engines shut down, about 8 minutes after launch at about 160 km altitude.</dd>
        <dt>ICPS</dt><dd>Interim Cryogenic Propulsion Stage, the liquid hydrogen/oxygen upper stage of SLS that performs the parking-orbit insertion and TLI burns.</dd>
        <dt>TLI</dt><dd>Trans-Lunar Injection, the ICPS burn (~388 m/s ΔV, ≈5 min 51 s) that places Orion on a trajectory toward the Moon.</dd>
        <dt>ΔV (Delta-V)</dt><dd>The change in velocity produced by a rocket burn, measured in m/s or km/s. Each manoeuvre "costs" ΔV, which must be budgeted against propellant mass.</dd>
        <dt>Vis-viva equation</dt><dd>The fundamental energy equation of orbital mechanics: \\(v^2 = \\mu(2/r - 1/a)\\). Gives speed at any point on a conic orbit from radius \\(r\\) and semi-major axis \\(a\\).</dd>
        <dt>Perigee / Apogee</dt><dd>Closest / farthest point of an Earth orbit. For Artemis II's parking orbit: perigee ≈ 185 km altitude, apogee ≈ 43,730 km altitude.</dd>
        <dt>Free-return trajectory</dt><dd>A lunar trajectory shaped so the spacecraft swings around the Moon and returns to Earth with no additional propulsion. It is used as an abort-safe option for crewed missions.</dd>
        <dt>ESM</dt><dd>European Service Module, the Airbus-built propulsion, power, and life-support module attached to the Orion crew module. It is jettisoned about 45 minutes before re-entry.</dd>
        <dt>SLS</dt><dd>Space Launch System, NASA's heavy-lift vehicle producing 39.1 MN (8.8 million lbf) at liftoff, the most powerful rocket ever to fly.</dd>
        <dt>Skip entry</dt><dd>A re-entry technique where the vehicle briefly "skips" off the upper atmosphere, generating lift to control the landing footprint and limit peak g-forces before final re-entry.</dd>
        <dt>NAIF / SPICE</dt><dd>Navigation and Ancillary Information Facility, the NASA JPL group that maintains the SPICE toolkit for spacecraft geometry. HORIZONS uses NAIF body IDs (Artemis II = -1024, Moon = 301, Earth = 399).</dd>
        <dt>Catmull–Rom spline</dt><dd>A smooth interpolating spline used here to render a continuous trajectory tube through discrete HORIZONS data points. Centripetal parameterisation (α = 0.5) avoids cusps; chordal (α = 1) follows data points most faithfully.</dd>
      </dl>
      <p class="about-note" style="margin-top:12px">
        App development notes and build instructions: <a class="detail-link" href="https://github.com/jackyko1991/space-track" target="_blank" rel="noreferrer">GitHub repository →</a>
      </p>
    `,
  },
  "zh-Hant": {
    languageName: "繁體中文",
    pageTitle: "阿提米絲飛行追蹤器",
    topEyebrow: "即時任務視圖",
    title: "阿提米絲飛行追蹤器",
    aboutButton: "關於",
    techButton: "技術說明",
    termsButton: "術語",
    languageLabel: "語言",
    fitScreen: "符合畫面",
    viewerFootnote: "月球顯示已做視覺調整，以便更容易閱讀飛越畫面。",
    missionSnapshot: "任務概況",
    metricEarthMoon: "地球到月球",
    metricArtemisEarth: "獵戶座太空船距離地球",
    metricArtemisMoon: "獵戶座太空船距離月球",
    metricSpeed: "獵戶座太空船速度",
    missionNodes: "任務節點與即時新聞",
    liveNews: "即時新聞",
    openNasa: "開啟 NASA 原始來源",
    upcoming: "即將到來",
    completed: "已完成",
    orionStatus: "獵戶座太空船即時狀態",
    missionProgress: "任務進度",
    timeLabel: "時間",
    distanceEarthLabel: "距離地球",
    distanceMoonLabel: "距離月球",
    speedLabel: "速度",
    loading: "載入中",
    trajectoryLoading: "軌跡：合成中（載入中…）",
    dataUnavailable: "軌跡：資料不可用",
    trajectoryBadge: ({ orionCount, moonCount, tliRadiusKm, maxBridgeTurnDeg }) =>
      `軌跡：NASA JPL HORIZONS · 獵戶座太空船 ${orionCount} 點 · 月球 ${moonCount} 點 · 驗證後 TLI ${tliRadiusKm} km · 轉向 ${maxBridgeTurnDeg}°`,
    aboutHtml: `
      <h3>阿提米絲二號</h3>
      <p>阿提米絲二號是 NASA SLS 火箭與獵戶座太空船的首次載人飛行，也是自 1972 年阿波羅 17 號後首次載人深空任務。四名太空人將驗證太空船在深空環境中的各項系統，為未來阿提米絲三號登月任務做準備。</p>
      <h3>機組成員</h3>
      <ul>
        <li><strong>Reid Wiseman</strong>：指揮官（NASA）</li>
        <li><strong>Victor Glover</strong>：駕駛員（NASA）</li>
        <li><strong>Christina Koch</strong>：任務專家（NASA）</li>
        <li><strong>Jeremy Hansen</strong>：任務專家（CSA）</li>
      </ul>
      <h3>自由返回軌道</h3>
      <a href="./assets/artemis2_map.jpg" target="_blank" rel="noopener noreferrer" class="about-map-link">
        <img src="./assets/artemis2_map.jpg" alt="Artemis II trajectory map" class="about-map">
      </a>
      <p>從甘迺迪太空中心發射後，月球轉移注入（TLI）點火會把獵戶座送入<strong>自由返回軌道</strong>。任務不需要月球軌道插入點火，月球重力會自然把軌跡彎回地球。橘色弧線是已飛行路徑，藍色弧線是後續規劃路徑。</p>
      <h3>關鍵數字</h3>
      <ul>
        <li>距離地球最遠：<strong>406,840 km</strong>，新的載人飛行紀錄</li>
        <li>最近月球距離：距月表 <strong>約 6,500 km</strong></li>
        <li>總飛行距離：<strong>約 110 萬 km</strong></li>
        <li>任務時間：<strong>約 10 天</strong></li>
        <li>再入速度：<strong>約 40,000 km/h</strong>，隔熱罩溫度可達 2,760 °C</li>
      </ul>
      <h3>資料來源</h3>
      <ul>
        <li><strong>獵戶座軌跡：</strong><a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a>，太空船 ID&nbsp;-1024，地心 ICRF，3&nbsp;小時解析度</li>
        <li><strong>月球星曆：</strong><a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a>，月球 ID&nbsp;301，地心 ICRF，3&nbsp;小時解析度</li>
        <li><strong>即時任務新聞：</strong><a class="detail-link" href="https://www.nasa.gov/missions/artemis/" target="_blank" rel="noreferrer">NASA Artemis 新聞摘要</a></li>
        <li><strong>任務影像：</strong><a class="detail-link" href="https://images.nasa.gov" target="_blank" rel="noreferrer">NASA Images API</a></li>
      </ul>
      <p class="about-note">軌跡使用發射前 HORIZONS 規劃資料（3 小時間隔）。實際最近月球距離（約 8,200 km）落在資料點之間。各檢查點時間來自 NASA 任務規劃文件。</p>
      <p class="about-note" style="margin-top:8px"><a class="detail-link" href="https://github.com/jackyko1991/space-track" target="_blank" rel="noreferrer">開發文件與原始碼 →</a></p>
    `,
    techHtml: `
      <div class="tech-col">
        <h3>座標系統與資料流程</h3>
        <p>軌跡資料來自 <a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a> 的 <strong>ICRF 地心 J2000</strong> 座標框架：X 軸指向春分點，Z 軸指向北天極。</p>
        <p>場景使用 Y 向上的右手座標系，轉換方式為：</p>
        $$\\vec{r}_{\\text{scene}} = s\\,\\begin{pmatrix}x_\\text{ICRF}\\\\z_\\text{ICRF}\\\\-y_\\text{ICRF}\\end{pmatrix}, \\quad s = \\frac{D_{\\text{scene}}}{D_{\\text{Moon}}} = \\frac{19.2}{384\\,400} \\approx 4.996\\times10^{-5}$$
        <h3>軌跡資料如何取得</h3>
        <p><a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">JPL HORIZONS</a> 已經提供獵戶座位置資料表。在該系統中，獵戶座的天體代號是 <strong>−1024</strong>。位置以地球中心為原點，每 <strong>3 小時</strong> 取樣一次，因此整個 10 天任務共有 72 個資料點。應用程式會把這份資料檔案本地打包，所以瀏覽時不需要即時 API 呼叫。</p>
        <h3>軌道力學：停泊軌道</h3>
        <p>在 MECO 之後，獵戶座進入 <strong>43,730 × 185 km</strong> 的橢圓停泊軌道。主要參數（\\(\\mu = 398\\,600\\text{ km}^3\\text{s}^{-2}\\)）為：</p>
        $$a = \\frac{r_a + r_p}{2} \\approx 28{,}329\\text{ km}$$
        $$e = \\frac{r_a - r_p}{r_a + r_p} \\approx 0.768 \\qquad T \\approx 13.2\\text{ h}$$
        <p>Vis-viva 方程可給出半徑 \\(r\\) 處的速度：</p>
        $$v = \\sqrt{\\mu\\!\\left(\\tfrac{2}{r} - \\tfrac{1}{a}\\right)}$$
        <h3>HORIZONS 資料缺口與合成弧線</h3>
        <p>以 3 小時間隔來看，HORIZONS 對整段停泊軌道只提供 <strong>8 個點</strong>（T+3.4 h 到 T+24.4 h）。ICPS 在第二次近地點進行 TLI 點火，該位置 \\(r_p = 6{,}556\\text{ km}\\) 落在兩個資料點之間：</p>
        <table class="tech-table">
          <tr><th>點位</th><th>r (km)</th><th>任務時間</th></tr>
          <tr><td>idx&nbsp;7</td><td>19,087</td><td>T + 24.4 h</td></tr>
          <tr><td><em>TLI 近地點</em></td><td><em>6,556</em></td><td><em>T + 25.1 h，缺失</em></td></tr>
          <tr><td>idx&nbsp;8</td><td>40,839</td><td>T + 27.4 h</td></tr>
        </table>
        <p>如果只在 idx&nbsp;7 與 idx&nbsp;8 間做插值，路徑最低只會到 19,087 km，看起來就像 TLI 節點漂浮在地球上方很遠處，而不是在近地點附近點火。</p>
      </div>
      <div class="tech-col">
        <h3>月球轉移注入（TLI）</h3>
        <p>TLI 是在近地點進行的順行 ICPS 點火。自由返回軌道所需的 \\(\\Delta v\\) 約為：</p>
        $$\\Delta v_\\text{TLI} \\approx \\sqrt{\\mu\\!\\left(\\tfrac{2}{r_p} - \\tfrac{1}{a_\\text{TLI}}\\right)} - \\sqrt{\\tfrac{\\mu}{r_p}} \\approx 0.388\\text{ km/s}$$
        <p>所得圓錐曲線的遠地點約為 413,174 km，創下新的載人飛行最遠距離紀錄。</p>
        <h3>自由返回軌道</h3>
        <p>這是一條 <strong>8 字形</strong> 圓錐曲線。月球重力會轉動速度向量，使太空船在不進行大型追加點火的情況下返回地球。近似條件為：</p>
        $$r_\\text{apoapsis} \\approx r_\\text{Moon} = 384{,}400\\text{ km}$$
        <p>最近月球距離：約為 <strong>8,200 km</strong>（中心到中心）。</p>
        <h3>再入：跳躍式再入</h3>
        <p>獵戶座會在約 121 km 高度切入上層大氣，利用 32° 配平角產生升力，先短暫跳出再重新進入。再入速度約 11 km/s；隔熱罩溫度可達 <strong>2,760 °C</strong>；最大減速度約 4 g。</p>
        <h3>克卜勒合成解法</h3>
        <p>為了補回缺失的近地點，程式直接從 HORIZONS 資料推導軌道要素，不需要外部 API：</p>
        <ol>
          <li><strong>軌道平面</strong>：由前兩個資料點計算 \\(\\hat{h} = \\vec{r}_0 \\times \\vec{r}_1\\)</li>
          <li><strong>遠地點</strong>：找出 TLI 前半徑最大的點，得到 \\(r_a\\)、\\(\\hat{r}_a\\)</li>
          <li><strong>軌道要素</strong>：\\(a = (r_a + r_p)/2\\)，\\(e = (r_a - r_p)/(r_a + r_p)\\)，\\(T = 2\\pi\\sqrt{a^3/\\mu}\\)</li>
          <li><strong>相位</strong>：計算第一個資料點的真近點角 \\(\\nu_0\\)，再回推出第一個近地點時間 \\(t_{\\pi_1}\\)</li>
        </ol>
        <p>接著以 20 分鐘步長，透過 <strong>牛頓–拉弗森</strong> 法求解克卜勒方程：</p>
        $$M = E - e\\sin E \\quad\\Longrightarrow\\quad E_{n+1} = E_n + \\frac{M - E_n + e\\sin E_n}{1 - e\\cos E_n}$$
        <p>這樣可產生從第一個近地點、經過遠地點，再到第二次 TLI 近地點的平滑且物理上合理的弧線，把 3 小時資料缺口補起來，時間誤差小於 9 分鐘。之後再用切線匹配的外推橋接段，把合成近地點接到 40,839 km 的第一個 TLI 後 HORIZONS 點，讓離地轉向保持平順。</p>
        <h3>月球對齊說明</h3>
        <p>月球顯示為了閱讀性做了視覺調整。程式先從原始 HORIZONS 月球星曆出發，盡量維持它接近觀測到的星圖位置，再只加入小幅相位修正，讓飛越畫面比較容易閱讀。目標是在保留真實月球運動感的前提下，避免飛越檢查點看起來明顯錯開。</p>
        <h3>約束導向代理式微調</h3>
        <p>目前的渲染做法採用 <strong>約束導向代理式微調</strong>。簡單說，程式會測試多組候選顯示轉換，用物理與觀測約束去評分，列出結果數值，再保留整體上最合理的一組，而不是直接寫死單一視覺答案。</p>
        <p>目前的驗證流程：</p>
        <ol>
          <li><strong>先處理月球：</strong>從原始 HORIZONS 月球星曆出發，只允許小幅相位修正，並用星圖觀測值與運動方向檢查。</li>
          <li><strong>再處理獵戶座：</strong>盡量保留獵戶座軌跡形狀，再用剛體顯示擬合，也就是旋轉加上等比例縮放，讓飛越環繞更接近月球，而不是局部硬彎軌跡。</li>
          <li><strong>輸出約束報告：</strong>把結果和飛越幾何約束逐項比對，輸出 pass/fail 清單，讓調整不是只靠肉眼判斷。</li>
        </ol>
        <p>目前使用的約束包括：</p>
        <ul>
          <li><strong>觀測檢查：</strong>把飛越前後的參考天象觀測值，拿來比對地面觀測的赤經／赤緯、方位角、高度角與距離。</li>
          <li><strong>小時調整：</strong>因為如果只知道日期、不知道觀測小時，月球位置可能明顯偏移，所以會把觀測小時差納入考量。</li>
          <li><strong>運動方向：</strong>顯示出的月球在飛越前，必須維持預期的俯視運動方向。</li>
          <li><strong>飛越距離：</strong>月球與獵戶座飛越點的距離，會盡量靠近任務規劃與網路資料中的最近飛越距離。</li>
          <li><strong>飛越角度：</strong>從地心看出去，獵戶座飛越方向與月球方向之間的夾角需要保持夠小。</li>
          <li><strong>包絡關係：</strong>獵戶座飛越環應該大致把月球包在中央附近。</li>
          <li><strong>接近原始資料：</strong>如果月球顯示偏離原始星曆太多，就會被扣分，因此會優先把顯示調整放在獵戶座那一側。</li>
          <li><strong>轉換量檢查：</strong>獵戶座剛體擬合後，會回報它偏離原始軌跡多少，方便判斷這個顯示修正是否仍然合理。</li>
        </ul>
        <p>這一點很重要，因為有些結果看起來順眼，實際上卻可能違反物理條件。所以這裡會把輸出的約束報告視為模型的一部分，而不是單純的除錯資訊。</p>
        <p>看起來傾角很大，不一定代表不合理。在真實太陽系中，月球軌道相對地球繞日平面約傾斜 <strong>5°</strong>，而地球自轉軸本身又有約 <strong>23.4°</strong> 的傾角。從某些視角觀察時，月球路徑相對地球赤道看起來就會明顯傾斜。</p>
        <h3>樣條渲染</h3>
        <p>TLI 後外飛段使用 <strong>centripetal Catmull–Rom</strong>（\\(\\alpha=0.5\\)）；返回段使用 <strong>chordal</strong>（\\(\\alpha=1\\)），避免樣條在最後接近地球時從地球後方切過去。</p>
        <h3>參考資料</h3>
        <ul>
          <li><a class="detail-link" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA JPL HORIZONS</a></li>
          <li><a class="detail-link" href="https://svs.gsfc.nasa.gov/5610/" target="_blank" rel="noreferrer">NASA SVS，Artemis II 視覺化</a></li>
          <li><a class="detail-link" href="https://www.nasa.gov/mission/artemis-ii/" target="_blank" rel="noreferrer">NASA Artemis II 任務頁面</a></li>
          <li>Bate、Mueller、White，《Fundamentals of Astrodynamics》，Dover 1971</li>
        </ul>
      </div>
    `,
    termsHtml: `
      <dl class="terms-list">
        <dt>ICRF</dt><dd>國際天球參考架構，是以遙遠類星體定義的標準慣性（不旋轉）座標框架。所有 HORIZONS 向量資料都以 ICRF 表示。</dd>
        <dt>J2000</dt><dd>儒略曆元 2000.0（2000 年 1 月 1 日 12:00 TDB），用來定義 ICRF 軸向：X 指向春分點，Z 指向北天極。</dd>
        <dt>Geocentric</dt><dd>地心座標。HORIZONS 的 <code>CENTER=500@399</code> 代表座標原點在地球質心，所以所有位置向量都是從地球量起。</dd>
        <dt>MECO</dt><dd>Main Engine Cut-Off，指 SLS RS-25 核心級引擎關機的時刻，約在發射後 8 分鐘、高度約 160 km。</dd>
        <dt>ICPS</dt><dd>Interim Cryogenic Propulsion Stage，是 SLS 的液氫／液氧上面級，負責停泊軌道插入與 TLI 點火。</dd>
        <dt>TLI</dt><dd>Trans-Lunar Injection，即月球轉移注入，是 ICPS 的一次點火（約 388 m/s ΔV，約 5 分 51 秒），把獵戶座送上前往月球的軌道。</dd>
        <dt>ΔV (Delta-V)</dt><dd>火箭點火產生的速度變化，單位通常是 m/s 或 km/s。每次機動都要消耗 ΔV，因此必須和推進劑預算一起考慮。</dd>
        <dt>Vis-viva equation</dt><dd>軌道力學中的基本能量方程：\\(v^2 = \\mu(2/r - 1/a)\\)。它可用半徑 \\(r\\) 與半長軸 \\(a\\) 算出圓錐曲線上任一點的速度。</dd>
        <dt>Perigee / Apogee</dt><dd>地球軌道上的最近點與最遠點。阿提米絲二號停泊軌道的近地點約 185 km 高度，遠地點約 43,730 km 高度。</dd>
        <dt>Free-return trajectory</dt><dd>一種月球軌道設計，讓太空船繞過月球後在不追加推進的情況下回到地球，常作為載人任務的安全中止方案。</dd>
        <dt>ESM</dt><dd>European Service Module，歐洲服務艙，由 Airbus 製造，負責獵戶座的推進、電力與生命維持，在再入前約 45 分鐘拋棄。</dd>
        <dt>SLS</dt><dd>Space Launch System，NASA 的重型運載火箭，起飛推力達 39.1 MN（880 萬磅），是有史以來推力最大的現役火箭之一。</dd>
        <dt>Skip entry</dt><dd>一種再入技術，讓太空船短暫「彈跳」出上層大氣，利用升力控制降落範圍並限制峰值過載，再進行最後再入。</dd>
        <dt>NAIF / SPICE</dt><dd>Navigation and Ancillary Information Facility，是 NASA JPL 維護 SPICE 幾何工具組的團隊。HORIZONS 使用 NAIF 天體代號（Artemis II = -1024，Moon = 301，Earth = 399）。</dd>
        <dt>Catmull–Rom spline</dt><dd>一種平滑插值樣條，用來把離散的 HORIZONS 資料點渲染成連續軌跡管線。Centripetal 參數化（α = 0.5）可避免尖點；Chordal（α = 1）則最忠實追隨資料點。</dd>
      </dl>
      <p class="about-note" style="margin-top:12px">
        應用程式開發筆記與建置說明：<a class="detail-link" href="https://github.com/jackyko1991/space-track" target="_blank" rel="noreferrer">GitHub 儲存庫 →</a>
      </p>
    `,
  },
};

export function getSupportedLanguages() {
  return ["en", "zh-Hant"];
}

export function getInitialLanguage() {
  const stored = window.localStorage.getItem("app-language");
  return getSupportedLanguages().includes(stored) ? stored : "en";
}

export function getTranslations(lang) {
  return TRANSLATIONS[lang] || TRANSLATIONS.en;
}

export function applyCheckpointTranslations(targetMissionData, lang) {
  const set = CHECKPOINT_TEXT[lang] || CHECKPOINT_TEXT.en;
  targetMissionData.checkpoints.forEach((checkpoint) => {
    const translated = set[checkpoint.id];
    if (!translated) return;
    checkpoint.label = translated.label;
    checkpoint.summary = translated.summary;
  });
}
