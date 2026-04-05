import * as missionModule from "./mission.js";
import { getSceneTimeMs, isCheckpointFuture } from "./mission.js";
import { applyCheckpointTranslations, getInitialLanguage, getSupportedLanguages, getTranslations } from "./i18n.js";

const newsModal = document.querySelector("#news-modal");
const newsDialog = document.querySelector(".news-dialog");
export const isTouchPrimary = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
const langSelect = document.querySelector("#lang-select");
let currentLanguage = getInitialLanguage();
let desktopNewsCloseTimer = null;

function cancelDesktopNewsClose() {
  if (desktopNewsCloseTimer) {
    window.clearTimeout(desktopNewsCloseTimer);
    desktopNewsCloseTimer = null;
  }
}

function scheduleDesktopNewsClose() {
  cancelDesktopNewsClose();
  desktopNewsCloseTimer = window.setTimeout(() => {
    closeNewsModal();
  }, 80);
}

export function getCurrentLanguage() {
  return currentLanguage;
}

function getInterfaceCopy() {
  return getTranslations(currentLanguage);
}

function getPanelLabel(key) {
  const copy = getInterfaceCopy();
  if (key === "about") return copy.aboutButton;
  if (key === "tech") return copy.techButton;
  return copy.termsButton;
}

export function applyLanguage(lang, options = {}) {
  currentLanguage = getSupportedLanguages().includes(lang) ? lang : "en";
  window.localStorage.setItem("app-language", currentLanguage);
  const copy = getInterfaceCopy();
  document.documentElement.lang = currentLanguage;
  document.title = copy.pageTitle;
  document.querySelector("#top-eyebrow").textContent = copy.topEyebrow;
  document.querySelector("#app-title").textContent = copy.title;
  document.querySelector("#pane-about").innerHTML = copy.aboutHtml;
  document.querySelector("#pane-tech").innerHTML = copy.techHtml;
  document.querySelector("#pane-terms").innerHTML = copy.termsHtml;
  document.querySelector("#viewer-footnote").textContent = copy.viewerFootnote;
  document.querySelector("#mission-eyebrow").textContent = copy.missionSnapshot;
  document.querySelector("#metric-label-em").textContent = copy.metricEarthMoon;
  document.querySelector("#metric-label-ae").textContent = copy.metricArtemisEarth;
  document.querySelector("#metric-label-am").textContent = copy.metricArtemisMoon;
  document.querySelector("#metric-label-speed").textContent = copy.metricSpeed;
  document.querySelector("#feed-eyebrow").textContent = copy.missionNodes;
  document.querySelector("#news-eyebrow").textContent = copy.liveNews;
  document.querySelector("#news-link").textContent = copy.openNasa;
  document.querySelector("#fit-screen").textContent = copy.fitScreen;
  langSelect.value = currentLanguage;

  applyCheckpointTranslations(missionModule.missionData, currentLanguage);
  const panelMap = {
    "about-btn": copy.aboutButton,
    "tech-btn": copy.techButton,
    "terms-btn": copy.termsButton,
  };
  Object.entries(panelMap).forEach(([id, label]) => {
    const button = document.querySelector(`#${id}`);
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.textContent = `${label} ${expanded ? "▴" : "▾"}`;
  });

  if (!options.skipListRender) {
    renderCheckpointList();
  }
  if (typeof window.renderMathInElement === "function") {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
    });
  }
  window.dispatchEvent(new CustomEvent("app-languagechange", { detail: { lang: currentLanguage } }));
}

export function openNewsModalAt(checkpointId, anchorElement = null) {
  cancelDesktopNewsClose();
  const checkpoint = missionModule.getCheckpoint(checkpointId);
  if (!checkpoint) return;

  document.querySelector("#news-title").textContent = checkpoint.label;
  document.querySelector("#news-time").textContent = new Date(checkpoint.time).toUTCString();
  document.querySelector("#news-summary").textContent = checkpoint.summary;
  document.querySelector("#news-link").href = checkpoint.sourceUrl;
  const newsImg = document.querySelector("#news-image");
  const imageUrl = checkpoint.imageUrl || missionModule.getCachedNewsImage(checkpointId);
  if (imageUrl) {
    newsImg.style.display = "";
    newsImg.onerror = () => { newsImg.style.display = "none"; };
    newsImg.src = imageUrl;
  } else {
    newsImg.removeAttribute("src");
    newsImg.style.display = "none";
    newsImg.onerror = null;
  }
  newsImg.alt = checkpoint.label;

  if (anchorElement && window.innerWidth > 1200) {
    const rect = anchorElement.getBoundingClientRect();
    const modalWidth = Math.min(360, window.innerWidth * 0.28);
    newsModal.style.bottom = "auto";
    newsModal.style.right = "auto";
    newsModal.style.width = `${modalWidth}px`;
    newsModal.removeAttribute("hidden");

    requestAnimationFrame(() => {
      const dialogHeight = newsDialog?.offsetHeight || 0;
      const preferredLeft = rect.left - modalWidth - 14;
      const fallbackLeft = rect.right + 14;
      const left = preferredLeft >= 16
        ? preferredLeft
        : Math.min(fallbackLeft, window.innerWidth - modalWidth - 16);
      const top = Math.min(
        Math.max(16, rect.top),
        Math.max(16, window.innerHeight - dialogHeight - 16)
      );
      newsModal.style.left = `${left}px`;
      newsModal.style.top = `${top}px`;
    });
    newsModal.style.display = "block";
    return;
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

export function closeNewsModal() {
  cancelDesktopNewsClose();
  newsModal.setAttribute("hidden", "");
  newsModal.style.display = "none";
}

export function renderCheckpointList() {
  const checkpointList = document.querySelector("#checkpoint-list");
  checkpointList.innerHTML = "";
  missionModule.missionData.checkpoints.slice().reverse().forEach((checkpoint) => {
    const item = document.createElement("li");
    item.className = "checkpoint-item";

    const button = document.createElement("button");
    button.dataset.id = checkpoint.id;
    button.innerHTML = `<strong>${checkpoint.label}</strong><span>${new Date(checkpoint.time).toUTCString()}</span>`;

    if (isTouchPrimary) {
      // Touch: tap once to show card, tap modal to dismiss (no URL auto-open)
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        missionModule.setDetail(checkpoint.id);
        missionModule.focusRef.fn?.(checkpoint.id);
        const isOpen = !newsModal.hasAttribute("hidden") &&
          document.querySelector("#news-title").textContent === checkpoint.label;
        if (isOpen) {
          closeNewsModal();
        } else {
          openNewsModalAt(checkpoint.id, button);
        }
      });
    } else {
      // Desktop: hover previews the card, click opens the NASA source
      const showDesktopPreview = () => {
        cancelDesktopNewsClose();
        missionModule.setDetail(checkpoint.id);
        openNewsModalAt(checkpoint.id, button);
      };
      button.addEventListener("click", () => {
        missionModule.setDetail(checkpoint.id);
        missionModule.focusRef.fn?.(checkpoint.id);
        if (checkpoint.sourceUrl) {
          window.open(checkpoint.sourceUrl, "_blank", "noopener,noreferrer");
        }
      });
      button.addEventListener("mouseenter", showDesktopPreview);
      button.addEventListener("mousemove", showDesktopPreview);
      button.addEventListener("mouseleave", (e) => {
        if (!e.relatedTarget?.closest?.(".news-dialog")) {
          scheduleDesktopNewsClose();
        }
      });
      button.addEventListener("focus", () => {
        missionModule.setDetail(checkpoint.id);
        openNewsModalAt(checkpoint.id, button);
      });
      button.addEventListener("blur", closeNewsModal);
    }

    item.appendChild(button);
    checkpointList.appendChild(item);
  });

  refreshCheckpointListState(getSceneTimeMs());
}

export function refreshCheckpointListState(nowMs) {
  const checkpointList = document.querySelector("#checkpoint-list");
  checkpointList.querySelectorAll("button").forEach((button) => {
    const checkpoint = missionModule.getCheckpoint(button.dataset.id);
    button.classList.toggle("is-future", Boolean(checkpoint && isCheckpointFuture(checkpoint, nowMs)));
    button.classList.toggle("active", button.dataset.id === missionModule.selectedCheckpointId);
  });
}

export function showSceneError(error) {
  const sceneError = document.querySelector("#scene-error");
  sceneError.hidden = false;
  sceneError.textContent = `Scene failed to initialize: ${error.message}`;
}

// --- News modal event listeners ---

// Clicking the modal backdrop closes it
newsModal.addEventListener("click", closeNewsModal);

// Prevent clicks inside the dialog from bubbling up to the modal close listener
document.querySelector(".news-dialog").addEventListener("click", (e) => {
  e.stopPropagation();
});

newsDialog.addEventListener("mouseenter", () => {
  cancelDesktopNewsClose();
});

// Close button inside dialog
document.querySelector(".news-close-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  closeNewsModal();
});

// On desktop, close modal when the mouse leaves the modal unless it's going back to a checkpoint button
newsModal.addEventListener("mouseleave", (e) => {
  if (!e.relatedTarget?.closest?.(".checkpoint-item")) {
    scheduleDesktopNewsClose();
  }
});

// --- Three independent info panel toggles ---
const INFO_PANELS = [
  { btnId: "about-btn",  panelId: "about-panel",  key: "about" },
  { btnId: "tech-btn",   panelId: "tech-panel",   key: "tech" },
  { btnId: "terms-btn",  panelId: "terms-panel",  key: "terms" },
];

function closeAllInfoPanels() {
  INFO_PANELS.forEach(({ btnId, panelId, key }) => {
    const panel = document.querySelector(`#${panelId}`);
    const button = document.querySelector(`#${btnId}`);
    panel.setAttribute("hidden", "");
    panel.style.display = "none";
    button.textContent = `${getPanelLabel(key)} ▾`;
    button.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  });
}

INFO_PANELS.forEach(({ btnId, panelId, key }) => {
  const button = document.querySelector(`#${btnId}`);
  const panel = document.querySelector(`#${panelId}`);
  button.setAttribute("aria-expanded", "false");

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = panel.hasAttribute("hidden");
    closeAllInfoPanels();

    if (opening) {
      panel.removeAttribute("hidden");
      panel.style.display = "block";
      button.textContent = `${getPanelLabel(key)} ▴`;
      button.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".info-block")) {
    closeAllInfoPanels();
  }
});

langSelect.addEventListener("change", () => {
  applyLanguage(langSelect.value);
});

applyLanguage(currentLanguage, { skipListRender: true });
