const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
const GEOJSON_PATH = "Extell_Assemblage_geocoded.geojson";
const PARCELS_PATH = "Extell_Assemblage_parcels.geojson";

const storyEl = document.getElementById("story");
const stepTemplate = document.getElementById("stepTemplate");
const tokenWarningEl = document.getElementById("tokenWarning");
const mapLegendEl = document.getElementById("mapLegend");
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

const GROUP_FALLBACK_COLOR = "#7f8ba0";

function groupColorMatchExpression(getter) {
  const stops = [];
  Object.entries(GROUP_COLORS).forEach(([group, color]) => {
    stops.push(group, color);
  });
  return ["match", getter, ...stops, GROUP_FALLBACK_COLOR];
}

const STATE = {
  map: null,
  mapLoaded: false,
  features: [],
  steps: [],
  activeStepId: null,
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
  return GROUP_COLORS[group] || GROUP_FALLBACK_COLOR;
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

function formatAddress(rawAddress) {
  if (!rawAddress) return "";
  // Strip a trailing city/state suffix (", NEW YORK, NY", ", NY", etc.) and
  // title-case all-caps addresses so cards read like prose rather than ACRIS labels.
  let cleaned = String(rawAddress)
    .replace(/,\s*new york\s*,\s*ny\s*$/i, "")
    .replace(/,\s*new york\s*$/i, "")
    .replace(/,\s*ny\s*$/i, "")
    .trim();
  if (cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned;
}

function normalizeFeatures(rawFeatures) {
  const idCounts = {};
  return rawFeatures
    .filter((f) => f && f.geometry && Array.isArray(f.geometry.coordinates))
    .map((feature, idx) => {
      const props = feature.properties || {};
      const recordedDate = props.recorded_date || "";
      const recordedDateValue = parseDate(recordedDate)?.getTime() || 0;
      const recordStatus =
        (props.record_status || "").toLowerCase() === "prospect" ||
        (props.source_doc_id || "").toLowerCase() === "future prospect"
          ? "prospect"
          : "confirmed";
      const baseId = props.source_doc_id || `record-${idx}`;
      idCounts[baseId] = (idCounts[baseId] || 0) + 1;
      const id = idCounts[baseId] > 1 ? `${baseId}-${idCounts[baseId]}` : baseId;
      return {
        id,
        sourceDocId: baseId,
        title: formatAddress(props.address) || "Address unavailable",        storyUrl: props.Clip_Notes || "",
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
    const addressTitle = feature.title;
    if (feature.storyUrl) {
      const storyLink = document.createElement("a");
      storyLink.dataset.href = feature.storyUrl;
      storyLink.target = "_blank";
      storyLink.rel = "noopener noreferrer";
      storyLink.className = "step-title-link";
      storyLink.textContent = addressTitle;
      titleEl.replaceChildren(storyLink);
    } else {
      titleEl.textContent = addressTitle;
    }

    fragment.querySelector(".step-meta").textContent =
      feature.recordStatus === "prospect"
        ? "Future prospect, date unknown"
        : formatDate(feature.recordedDate);

    fragment.querySelector(".step-amount").textContent =
      feature.recordStatus === "prospect"
        ? "Price: Undisclosed"
        : `Price: ${feature.amountText}`;

    const link = fragment.querySelector(".step-link");
    if (feature.sourceUrl) {
      link.dataset.href = feature.sourceUrl;
    } else {
      link.remove();
    }

    article.addEventListener("click", (event) => {
      // Let active, real links keep their native behavior so users can
      // open the source document or story.
      if (event.target.closest("a, button")) return;
      activateStep(step.id, { scrollIntoView: true });
    });

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

function flyToRecord(feature) {
  if (!STATE.map) return;

  const mobile = isMobileViewport();
  const cameraOptions = {
    center: feature.coordinates,
    zoom: mobile ? 16.4 : 17,
    pitch: mobile ? 0 : 38,
    bearing: mobile ? 0 : -15,
  };

  if (prefersReducedMotion()) {
    STATE.map.jumpTo(cameraOptions);
    return;
  }

  STATE.map.flyTo({
    ...cameraOptions,
    speed: mobile ? 0.75 : 0.6,
    curve: 1.3,
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
              propertyGroup: feature.propertyGroup,
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

function updateActiveParcel(feature) {
  if (!STATE.map || !STATE.mapLoaded) return;
  const sourceDocId = feature && feature.sourceDocId;
  const filter = sourceDocId
    ? ["==", ["get", "source_doc_id"], sourceDocId]
    : ["==", ["get", "source_doc_id"], "__none__"];
  if (STATE.map.getLayer("parcels-fill-active")) {
    STATE.map.setFilter("parcels-fill-active", filter);
  }
  if (STATE.map.getLayer("parcels-outline-active")) {
    STATE.map.setFilter("parcels-outline-active", filter);
  }
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
    el.querySelectorAll("a[data-href]").forEach((a) => {
      if (isActive) {
        a.setAttribute("href", a.dataset.href);
        a.removeAttribute("tabindex");
        a.removeAttribute("aria-disabled");
      } else {
        a.removeAttribute("href");
        a.setAttribute("tabindex", "-1");
        a.setAttribute("aria-disabled", "true");
      }
    });
    if (isActive && scrollIntoView) {
      el.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: isMobileViewport() ? "start" : "center",
      });
    }
  });

  const feature = step.feature;
  flyToRecord(feature);
  updateActivePoint(feature);
  updateActiveParcel(feature);

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
  if (!legendToggleEl || !mapLegendEl) return;
  legendToggleEl.addEventListener("click", () => {
    const open = mapLegendEl.classList.toggle("is-open");
    legendToggleEl.setAttribute("aria-expanded", String(open));
  });
}

function setupResponsiveRefresh() {
  let pending = null;
  const refresh = () => {
    pending = null;
    syncMobileMapHeightVar();
    if (STATE.map) STATE.map.resize();
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
    interactive: true,
  });

  STATE.map = map;

  map.addControl(
    new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
    "top-right"
  );

  if (mobile) {
    // Allow pinch/drag for exploration, but keep page scroll working and
    // prevent accidental rotation/pitch gestures on touch.
    map.scrollZoom.disable();
    map.dragRotate.disable();
    if (map.touchPitch) map.touchPitch.disable();
    if (map.touchZoomRotate) map.touchZoomRotate.disableRotation();
  } else {
    // Desktop: keep the map visually static; navigation is driven by card
    // clicks, pin/parcel clicks, and the +/- zoom buttons.
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    if (map.touchZoomRotate) map.touchZoomRotate.disable();
  }

  map.on("load", () => {
    STATE.mapLoaded = true;

    map.addSource("parcels", {
      type: "geojson",
      data: STATE.parcels || { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "parcels-fill",
      type: "fill",
      source: "parcels",
      paint: {
        "fill-color": groupColorMatchExpression(["get", "property_group"]),
        "fill-opacity": 0.2,
      },
    });

    map.addLayer({
      id: "parcels-outline",
      type: "line",
      source: "parcels",
      paint: {
        "line-color": groupColorMatchExpression(["get", "property_group"]),
        "line-width": 1,
        "line-opacity": 0.6,
      },
    });

    map.addLayer({
      id: "parcels-fill-active",
      type: "fill",
      source: "parcels",
      filter: ["==", ["get", "source_doc_id"], "__none__"],
      paint: {
        "fill-color": groupColorMatchExpression(["get", "property_group"]),
        "fill-opacity": 0.45,
      },
    });

    map.addLayer({
      id: "parcels-outline-active",
      type: "line",
      source: "parcels",
      filter: ["==", ["get", "source_doc_id"], "__none__"],
      paint: {
        "line-color": groupColorMatchExpression(["get", "property_group"]),
        "line-width": 2.4,
        "line-opacity": 0.95,
      },
    });

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
        "circle-color": groupColorMatchExpression(["get", "propertyGroup"]),
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
        "circle-radius": 22,
        "circle-color": groupColorMatchExpression(["get", "propertyGroup"]),
        "circle-opacity": 0.22,
      },
    });

    map.addLayer({
      id: "active-point-core",
      type: "circle",
      source: "active-point",
      paint: {
        "circle-radius": 10,
        "circle-color": groupColorMatchExpression(["get", "propertyGroup"]),
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });

    updateAllPointsSource();
    if (STATE.activeStepId) {
      activateStep(STATE.activeStepId, { updateHash: false, force: true });
    }

    // Belt-and-suspenders: if the container's height settled after Mapbox
    // measured it (e.g. svh recalculation, late font load), force a resize
    // so the canvas fills the visible map area.
    map.resize();
    requestAnimationFrame(() => map.resize());

    const activateFromMapFeature = (mapFeature) => {
      if (!mapFeature) return;
      const props = mapFeature.properties || {};
      let step = null;
      if (props.id) {
        step = STATE.steps.find((s) => s.feature.id === props.id);
      }
      if (!step && props.source_doc_id) {
        step = STATE.steps.find((s) => s.feature.sourceDocId === props.source_doc_id);
      }
      if (step) activateStep(step.id, { scrollIntoView: true });
    };

    const clickableLayers = ["all-points-layer", "parcels-fill"];
    clickableLayers.forEach((layerId) => {
      map.on("click", layerId, (e) => {
        activateFromMapFeature(e.features && e.features[0]);
      });
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    });
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
    console.error("Could not load GeoJSON. Serve this folder with a local web server.", err);
    return;
  }

  const rawFeatures = Array.isArray(data.features) ? data.features : [];
  const features = normalizeFeatures(rawFeatures);
  if (!features.length) {
    console.error("No valid map points found in GeoJSON.");
    return;
  }

  let parcelsData = { type: "FeatureCollection", features: [] };
  try {
    const parcelsResponse = await fetch(PARCELS_PATH);
    if (parcelsResponse.ok) {
      parcelsData = await parcelsResponse.json();
    }
  } catch (err) {
    console.warn("Parcel overlay unavailable", err);
  }

  STATE.features = features;
  STATE.parcels = parcelsData;
  STATE.steps = buildSteps(features);

  buildLegend(STATE.features);
  buildStoryCards(STATE.steps);
  setupStoryEvents();
  setupOverlayToggles();
  setupResponsiveRefresh();
  syncMobileMapHeightVar();

  if (!STATE.steps.length) {
    console.error("No steps available to render.");
    return;
  }

  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  activateStep(STATE.steps[0].id, { updateHash: false });

  initMap();
}

init();
