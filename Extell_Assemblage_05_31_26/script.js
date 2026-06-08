const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
const GEOJSON_PATH = "Extell_Assemblage_geocoded.geojson";

const storyEl = document.getElementById("story");
const stepTemplate = document.getElementById("stepTemplate");
const totalSpendEl = document.getElementById("totalSpend");
const progressLabelEl = document.getElementById("progressLabel");
const largestSoFarEl = document.getElementById("largestSoFar");
const largestDealLabelEl = document.getElementById("largestDealLabel");
const tokenWarningEl = document.getElementById("tokenWarning");
const mapLegendEl = document.getElementById("mapLegend");
const mapOverlayEl = document.getElementById("mapOverlay");
const overlayToggleEl = document.getElementById("overlayToggle");
const overlaySummaryEl = document.getElementById("overlaySummary");
const legendToggleEl = document.getElementById("legendToggle");

const MOBILE_MEDIA = window.matchMedia("(max-width: 820px)");
const REDUCED_MOTION_MEDIA = window.matchMedia("(prefers-reduced-motion: reduce)");
const isMobileViewport = () => MOBILE_MEDIA.matches;
const prefersReducedMotion = () => REDUCED_MOTION_MEDIA.matches;

const GROUP_COLORS = {
  Prospect: "#d08f22",
  Land: "#124784",
  Office: "#148a64",
  Other: "#bf3f2f",
  "Multi-Family Dwelling": "#6b4ea2",
};

const GROUP_LABELS = {
  "Multi-Family Dwelling": "Multi-Family",
};

const GROUP_ORDER = ["Prospect", "Land", "Office", "Other", "Multi-Family Dwelling"];

const STATE = {
  map: null,
  mapLoaded: false,
  features: [],
  steps: [],
  activeStepId: null,
  observer: null,
};

function parseAmount(amountText) {
  if (!amountText) return 0;
  const cleaned = String(amountText).replace(/[^\d.-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function parseDate(dateText) {
  if (!dateText) return null;
  const d = new Date(dateText);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(dateText) {
  const d = parseDate(dateText);
  if (!d) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatHeadlineFromUrl(urlText) {
  if (!urlText) return null;

  try {
    const url = new URL(urlText);
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] || "";
    if (!slug) return null;

    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  } catch {
    return null;
  }
}

function getPropertyGroupColor(group) {
  return GROUP_COLORS[group] || "#7f8ba0";
}

function getPropertyGroupLabel(group) {
  return GROUP_LABELS[group] || group || "Uncategorized";
}

function buildLegend(features) {
  if (!mapLegendEl) return;

  const legendBody = mapLegendEl.querySelector(".legend-body") || mapLegendEl;
  legendBody.querySelectorAll(".legend-row").forEach((row) => row.remove());
  const groups = [...new Set(features.map((feature) => feature.propertyGroup || "Uncategorized"))];

  groups.sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a);
    const indexB = GROUP_ORDER.indexOf(b);
    const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    if (rankA !== rankB) return rankA - rankB;
    return getPropertyGroupLabel(a).localeCompare(getPropertyGroupLabel(b));
  });

  groups.forEach((group) => {
    const row = document.createElement("p");
    row.className = "legend-row";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = getPropertyGroupColor(group);

    row.appendChild(swatch);
    row.append(document.createTextNode(getPropertyGroupLabel(group)));
    legendBody.appendChild(row);
  });
}

function normalizeFeatures(rawFeatures) {
  return rawFeatures
    .filter((f) => f && f.geometry && Array.isArray(f.geometry.coordinates))
    .map((feature, idx) => {
      const props = feature.properties || {};
      const recordedDate = props.recorded_date || "";
      const recordedDateValue = parseDate(recordedDate)?.getTime() || 0;
      const recordStatus = (props.record_status || "").toLowerCase() === "prospect"
        ? "prospect"
        : "confirmed";
      return {
        id: props.source_doc_id || `record-${idx}`,
        title: props.address || "Address unavailable",
        storyUrl: props.Clip_Notes || "",
        storyTitle: formatHeadlineFromUrl(props.Clip_Notes || "") || "",
        amountText: props.doc_amount || "Amount undisclosed",
        amountValue: parseAmount(props.doc_amount),
        recordedDate,
        recordedDateValue,
        recordStatus,
        borough: props.borough || "",
        neighborhood: props.neighborhood || "",
        classification: props.classification || "",
        propertyGroup: props.property_group || (recordStatus === "prospect" ? "Prospect" : "Other"),
        docType: props.doc_type || "",
        sourceUrl: props.link_url || "",
        clipNotes: props.Clip_Notes || "",
        coordinates: feature.geometry.coordinates,
      };
    })
    .sort((a, b) => {
      if (a.recordStatus !== b.recordStatus) {
        return a.recordStatus === "confirmed" ? -1 : 1;
      }
      if (a.recordStatus === "prospect") {
        return a.title.localeCompare(b.title);
      }
      // Push confirmed records that lack both a recorded date and an amount
      // to the end of the confirmed group so the timeline doesn't open on them.
      const aHasData = a.recordedDateValue > 0 || a.amountValue > 0;
      const bHasData = b.recordedDateValue > 0 || b.amountValue > 0;
      if (aHasData !== bHasData) return aHasData ? -1 : 1;
      return a.recordedDateValue - b.recordedDateValue;
    });
}

function buildSteps(features) {
  const steps = [];
  features.forEach((feature, index) => {
    steps.push({
      kind: "record",
      id: `record-${feature.id}`,
      feature,
      statsIndex: index,
    });
  });

  return steps;
}

function buildStoryCards(steps) {
  storyEl.innerHTML = "";

  steps.forEach((step) => {
    const feature = step.feature;
    const fragment = stepTemplate.content.cloneNode(true);
    const article = fragment.querySelector(".step");

    article.dataset.stepId = step.id;

    fragment.querySelector(".step-kicker").textContent =
      feature.recordStatus === "prospect"
        ? "Future prospect"
        : `Deal ${step.statsIndex + 1} of ${STATE.features.length}`;

    const titleEl = fragment.querySelector(".step-title");
    if (feature.storyUrl) {
      const storyLink = document.createElement("a");
      storyLink.href = feature.storyUrl;
      storyLink.target = "_blank";
      storyLink.rel = "noopener noreferrer";
      storyLink.className = "step-title-link";
      storyLink.textContent = feature.storyTitle || "Linked story";
      titleEl.replaceChildren(storyLink);
    } else {
      titleEl.textContent = feature.title;
    }

    const metaParts = [
      feature.recordStatus === "prospect" ? "Prospect" : formatDate(feature.recordedDate),
      feature.borough,
      feature.neighborhood,
      feature.docType,
    ].filter(Boolean);
    fragment.querySelector(".step-meta").textContent = metaParts.join(" • ");

    fragment.querySelector(".step-amount").textContent =
      feature.recordStatus === "prospect" ? "Status: Prospect" : `Paid: ${feature.amountText}`;

    const detailParts = [
      `Address: ${feature.title}`,
      `Property group: ${feature.propertyGroup}`,
      feature.classification,
      feature.sourceUrl ? "Includes source document" : "No source document link",
    ]
      .filter(Boolean)
      .join(" • ");
    fragment.querySelector(".step-detail").textContent = detailParts || "Acquisition record";

    const link = fragment.querySelector(".step-link");
    if (feature.sourceUrl) {
      link.href = feature.sourceUrl;
    } else {
      link.remove();
    }

    storyEl.appendChild(fragment);
  });
}

function getStepById(stepId) {
  return STATE.steps.find((step) => step.id === stepId) || null;
}

function getVisibleFeatures(statsIndex) {
  if (statsIndex < 0) return [];
  return STATE.features.slice(0, statsIndex + 1);
}

function getVisibleConfirmedFeatures(statsIndex) {
  return getVisibleFeatures(statsIndex).filter((feature) => feature.recordStatus === "confirmed");
}

function updateRunningMetrics(statsIndex) {
  const visibleFeatures = getVisibleConfirmedFeatures(statsIndex);
  const runningTotal = visibleFeatures.reduce((sum, f) => sum + f.amountValue, 0);

  totalSpendEl.textContent = formatCurrency(runningTotal);

  if (!visibleFeatures.length) {
    largestSoFarEl.textContent = "$0";
    largestDealLabelEl.textContent = "Waiting for first step...";
  } else {
    const largest = visibleFeatures.reduce((max, feature) =>
      feature.amountValue > max.amountValue ? feature : max
    );
    largestSoFarEl.textContent = formatCurrency(largest.amountValue);
    largestDealLabelEl.textContent = largest.title;
  }

  if (overlaySummaryEl) {
    const totalConfirmed = STATE.features.filter((f) => f.recordStatus === "confirmed").length;
    const dealNumber = Math.min(visibleFeatures.length, totalConfirmed);
    overlaySummaryEl.textContent = totalConfirmed
      ? `${formatCurrency(runningTotal)} \u00b7 Deal ${dealNumber}/${totalConfirmed}`
      : formatCurrency(runningTotal);
  }
}

function flyToRecord(feature) {
  if (!STATE.map) return;

  const mobile = isMobileViewport();
  const cameraOptions = {
    center: feature.coordinates,
    zoom: mobile ? 13.8 : 14.8,
    pitch: mobile ? 0 : 38,
    bearing: mobile ? 0 : -15,
  };

  if (prefersReducedMotion()) {
    STATE.map.jumpTo(cameraOptions);
    return;
  }

  STATE.map.flyTo({
    ...cameraOptions,
    speed: mobile ? 0.9 : 0.72,
    curve: 1.15,
    essential: true,
  });
}

function updateActivePoint(feature) {
  if (!STATE.map || !STATE.mapLoaded) return;
  const source = STATE.map.getSource("active-point");
  if (!source) return;

  source.setData({
    type: "FeatureCollection",
    features: feature
      ? [
          {
            type: "Feature",
            properties: {
              title: feature.title,
              amount: feature.amountText,
              date: formatDate(feature.recordedDate),
            },
            geometry: {
              type: "Point",
              coordinates: feature.coordinates,
            },
          },
        ]
      : [],
  });
}

function activateStep(stepId, options = {}) {
  const { updateHash = true, scrollIntoView = false, force = false } = options;
  const step = getStepById(stepId);
  if (!step || (!force && stepId === STATE.activeStepId)) {
    return;
  }

  STATE.activeStepId = stepId;

  document.querySelectorAll(".step").forEach((el) => {
    const isActive = el.dataset.stepId === stepId;
    el.classList.toggle("active", isActive);
    if (isActive && scrollIntoView) {
      el.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: isMobileViewport() ? "start" : "center",
      });
    }
  });

  updateRunningMetrics(step.statsIndex);

  const feature = step.feature;
  if (feature.recordStatus === "prospect") {
    progressLabelEl.textContent = `Prospect: ${feature.title}`;
  } else {
    progressLabelEl.textContent = `${step.statsIndex + 1} of ${STATE.features.length}: ${feature.amountText} at ${feature.title}`;
  }
  flyToRecord(feature);
  updateActivePoint(feature);

  if (updateHash) {
    history.replaceState(null, "", `#step=${encodeURIComponent(step.id)}`);
  }
}

function syncMobileMapHeightVar() {
  if (!isMobileViewport()) {
    document.documentElement.style.removeProperty("--map-height");
    return 0;
  }
  const mapEl = document.querySelector(".map-wrap");
  if (!mapEl) return 0;
  const height = Math.round(mapEl.getBoundingClientRect().height);
  if (height > 0) {
    document.documentElement.style.setProperty("--map-height", `${height}px`);
  }
  return height;
}

function setupScrollObserver() {
  if (STATE.observer) {
    STATE.observer.disconnect();
  }

  const mobile = isMobileViewport();
  let rootMargin;
  if (mobile) {
    const mapHeight = syncMobileMapHeightVar();
    const viewportH = window.innerHeight || 1;
    const topPct = Math.max(30, Math.min(85, Math.round((mapHeight / viewportH) * 100)));
    rootMargin = `-${topPct}% 0px -10% 0px`;
  } else {
    rootMargin = "-18% 0px -55% 0px";
  }
  const options = {
    root: null,
    rootMargin,
    threshold: 0.01,
  };

  STATE.observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const stepId = entry.target.dataset.stepId;
      if (stepId) {
        activateStep(stepId);
      }
    });
  }, options);

  document.querySelectorAll(".step[data-step-id]").forEach((stepEl) => {
    STATE.observer.observe(stepEl);
  });
}

function updateAllPointsSource() {
  if (!STATE.map || !STATE.mapLoaded) return;
  const source = STATE.map.getSource("all-points");
  if (!source) return;

  source.setData({
    type: "FeatureCollection",
    features: STATE.features.map((f) => ({
      type: "Feature",
      properties: {
        id: f.id,
        amount: f.amountText,
        amountValue: f.amountValue,
        title: f.title,
        propertyGroup: f.propertyGroup,
      },
      geometry: {
        type: "Point",
        coordinates: f.coordinates,
      },
    })),
  });
}

function getStepIdFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw.startsWith("step=")) return null;
  return decodeURIComponent(raw.slice(5));
}

function setupStoryEvents() {
  window.addEventListener("hashchange", () => {
    const stepId = getStepIdFromHash();
    if (stepId && getStepById(stepId)) {
      activateStep(stepId, { updateHash: false, scrollIntoView: true });
    }
  });
}

function setupOverlayToggles() {
  const bindToggle = (toggleEl, containerEl) => {
    if (!toggleEl || !containerEl) return;
    toggleEl.addEventListener("click", () => {
      const open = containerEl.classList.toggle("is-open");
      toggleEl.setAttribute("aria-expanded", String(open));
    });
  };
  bindToggle(overlayToggleEl, mapOverlayEl);
  bindToggle(legendToggleEl, mapLegendEl);
}

function setupResponsiveRefresh() {
  let pending = null;
  const refresh = () => {
    pending = null;
    syncMobileMapHeightVar();
    setupScrollObserver();
  };
  const schedule = () => {
    if (pending) return;
    pending = window.requestAnimationFrame(refresh);
  };
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  if (typeof MOBILE_MEDIA.addEventListener === "function") {
    MOBILE_MEDIA.addEventListener("change", schedule);
  } else if (typeof MOBILE_MEDIA.addListener === "function") {
    MOBILE_MEDIA.addListener(schedule);
  }
}

function showTokenWarning() {
  tokenWarningEl.hidden = false;
  progressLabelEl.textContent = "Map unavailable until token is set";
}

function initMap() {
  const firstFeature = STATE.features[0];
  const [startLng, startLat] = firstFeature.coordinates;
  const mobile = isMobileViewport();

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [startLng, startLat],
    zoom: mobile ? 10.8 : 11.5,
    pitch: mobile ? 0 : 34,
    bearing: mobile ? 0 : -15,
    antialias: true,
    interactive: mobile,
  });

  STATE.map = map;

  if (mobile) {
    // Allow pinch/drag for exploration, but keep page scroll working and
    // prevent accidental rotation/pitch gestures on touch.
    map.scrollZoom.disable();
    map.dragRotate.disable();
    if (map.touchPitch) map.touchPitch.disable();
    if (map.touchZoomRotate) map.touchZoomRotate.disableRotation();
  }

  map.on("load", () => {
    STATE.mapLoaded = true;

    map.addSource("all-points", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "all-points-layer",
      type: "circle",
      source: "all-points",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "amountValue"],
          0,
          4,
          10000000,
          7,
          100000000,
          11,
          500000000,
          15,
          1000000000,
          18,
        ],
        "circle-color": [
          "match",
          ["get", "propertyGroup"],
          "Prospect",
          GROUP_COLORS.Prospect,
          "Land",
          GROUP_COLORS.Land,
          "Office",
          GROUP_COLORS.Office,
          "Other",
          GROUP_COLORS.Other,
          "Multi-Family Dwelling",
          GROUP_COLORS["Multi-Family Dwelling"],
          "#7f8ba0",
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.3,
        "circle-opacity": 0.5,
      },
    });

    map.addSource("active-point", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "active-point-glow",
      type: "circle",
      source: "active-point",
      paint: {
        "circle-radius": 19,
        "circle-color": "#bf3f2f",
        "circle-opacity": 0.22,
      },
    });

    map.addLayer({
      id: "active-point-core",
      type: "circle",
      source: "active-point",
      paint: {
        "circle-radius": 8,
        "circle-color": "#bf3f2f",
        "circle-stroke-color": "#fff6f0",
        "circle-stroke-width": 2.5,
      },
    });

    updateAllPointsSource();
    if (STATE.activeStepId) {
      activateStep(STATE.activeStepId, { updateHash: false, force: true });
    }

    if (mobile) {
      const activateFromMapFeature = (mapFeature) => {
        if (!mapFeature) return;
        const featureId = mapFeature.properties && mapFeature.properties.id;
        if (!featureId) return;
        const step = STATE.steps.find((s) => s.feature.id === featureId);
        if (step) activateStep(step.id, { scrollIntoView: true });
      };
      map.on("click", "all-points-layer", (e) => {
        activateFromMapFeature(e.features && e.features[0]);
      });
    }
  });
}

async function init() {
  const token = (MAPBOX_ACCESS_TOKEN || "").trim();
  const isPlaceholder = token.includes("YOUR_MAPBOX_ACCESS_TOKEN");
  const isPublicToken = token.startsWith("pk.");

  if (!token || isPlaceholder || !isPublicToken) {
    showTokenWarning();
    return;
  }

  mapboxgl.accessToken = token;

  let data;
  try {
    const response = await fetch(GEOJSON_PATH);
    if (!response.ok) {
      throw new Error(`Failed to fetch GeoJSON (${response.status})`);
    }
    data = await response.json();
  } catch (err) {
    progressLabelEl.textContent = "Could not load GeoJSON. Serve this folder with a local web server.";
    console.error(err);
    return;
  }

  const rawFeatures = Array.isArray(data.features) ? data.features : [];
  const features = normalizeFeatures(rawFeatures);
  if (!features.length) {
    progressLabelEl.textContent = "No valid map points found in GeoJSON.";
    return;
  }

  STATE.features = features;
  STATE.steps = buildSteps(features);

  buildLegend(STATE.features);
  buildStoryCards(STATE.steps);
  setupScrollObserver();
  setupStoryEvents();
  setupOverlayToggles();
  setupResponsiveRefresh();

  if (!STATE.steps.length) {
    progressLabelEl.textContent = "No steps available to render.";
    return;
  }

  const hashStepId = getStepIdFromHash();
  const targetStepId = hashStepId && getStepById(hashStepId) ? hashStepId : STATE.steps[0].id;
  activateStep(targetStepId, { updateHash: !hashStepId });

  initMap();
}

init();
